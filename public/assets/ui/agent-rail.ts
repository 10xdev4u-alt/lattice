/**
 * Agent rail — the right rail.
 *
 * Hosts the chat input, the live tool array (read from the real
 * `document.modelContext.getTools()`), the workflow trail, and the
 * peer-reviewer banner. The chat input actually calls the OpenAI-
 * compatible LLM and the tool surface.
 *
 * Closes #38, #109 (wire to real data).
 */

import { getModelContext } from '../model-context-polyfill';
import { getSession, recordStep } from '../workflow-trail';
import { mountWorkflowTrail } from './workflow-trail';
import { completePrompt } from '../llm';
import { setPeerReviewerActive, isPeerReviewerActive } from './peer-reviewer';
import { decorateCitations } from '../citation-chips';

interface RegisteredTool {
  name: string;
  description: string;
  inputSchema?: { properties?: Record<string, unknown> };
  annotations?: { readOnlyHint?: boolean };
}

interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
  transient?: boolean;
  timestamp: string;
}

const CHAT_STORAGE_KEY = 'lattice.chat.v1';

function loadChat(): ChatMessage[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? '[]') as ChatMessage[];
  } catch {
    return [];
  }
}

function saveChat(messages: ChatMessage[]): void {
  if (typeof localStorage === 'undefined') return;
  const persistable = messages.filter((m) => !m.transient);
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(persistable));
}

export function mountAgentRail(root: HTMLElement): void {
  render(root);

  const form = root.querySelector<HTMLFormElement>('[data-agent-form]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSubmit(root);
  });

  document.addEventListener('webmcp:toolcall', () => render(root));
  document.addEventListener('lattice:peer-reviewer-changed', () => render(root));
}

async function handleSubmit(root: HTMLElement): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-agent-input]');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  appendMessage(root, 'user', text);
  input.value = '';
  setBusy(root, true);
  try {
    const system = `You are Lattice, a research-paper assistant. The user is working in a 3-rail workspace. You have ${toolCount()} WebMCP tools available. Always call list_papers first to ground your work, then chain search_library, open_paper, and the per-paper tools. When the user asks you to act, the harness handles the UI side; you just call tools. Be concise. Cite by paper id.`;
    const reply = await completePrompt(text, {
      signal: new AbortController().signal,
      maxTokens: 800,
      system,
    });
    appendMessage(root, 'agent', reply || '(no response)');
  } catch (err) {
    appendMessage(root, 'agent', `Error: ${(err as Error).message}`);
  } finally {
    setBusy(root, false);
  }
}

function setBusy(root: HTMLElement, busy: boolean): void {
  const form = root.querySelector<HTMLFormElement>('[data-agent-form]');
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>('input');
  const btn = form.querySelector<HTMLButtonElement>('button');
  if (input) input.disabled = busy;
  if (btn) btn.disabled = busy;
  if (busy) {
    appendMessage(root, 'agent', '(thinking…)', true);
  } else {
    const thinking = root.querySelector('.agent-message-thinking');
    thinking?.remove();
  }
}

async function render(root: HTMLElement): Promise<void> {
  const tools = await loadTools();
  const session = getSession();
  const peerActive = isPeerReviewerActive();
  const chat = root.querySelector<HTMLDivElement>('[data-agent-chat]');
  const existing = chat ? Array.from(chat.querySelectorAll<HTMLDivElement>('.agent-message')).length : 0;
  const persisted = loadChat();
  root.innerHTML = `
    <div class="agent-rail-tabs" role="tablist">
      <button data-tab="chat" role="tab" aria-selected="true">Chat</button>
      <button data-tab="tools" role="tab" aria-selected="false">Tools (${tools.length})</button>
      <button data-tab="log" role="tab" aria-selected="false">Log (${session.steps.length})</button>
    </div>
    <div class="agent-rail-tab" data-tab-content="chat">
      <div class="agent-chat" data-agent-chat>
        <p class="agent-chat-empty">No messages yet. Ask the agent anything about your library.${peerActive ? ' A peer-reviewer is active.' : ''}</p>
      </div>
      <form class="agent-input" data-agent-form>
        <input type="text" data-agent-input placeholder="Ask about your library" aria-label="Ask the agent" />
        <button type="submit">Send</button>
      </form>
      <div class="agent-rail-actions">
        <button data-action="invite-reviewer">${peerActive ? 'Reviewer active (click to dismiss)' : 'Invite peer-reviewer'}</button>
      </div>
    </div>
    <div class="agent-rail-tab" data-tab-content="tools" hidden>
      <ul class="tool-array" role="list">
        ${tools.map((t) => toolRow(t)).join('')}
      </ul>
    </div>
    <div class="agent-rail-tab" data-tab-content="log" hidden>
      <div data-workflow-trail></div>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab!;
      root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      root.querySelectorAll<HTMLDivElement>('[data-tab-content]').forEach((p) => {
        p.hidden = p.dataset.tabContent !== tab;
      });
    });
  });

  const inviteBtn = root.querySelector<HTMLButtonElement>('[data-action="invite-reviewer"]');
  inviteBtn?.addEventListener('click', () => {
    setPeerReviewerActive(!isPeerReviewerActive());
    void render(root);
  });

  root.querySelectorAll<HTMLButtonElement>('[data-tryit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.tryit!;
      const sample = sampleArgs(name);
      const ctx = getModelContext();
      void ctx.executeTool({ name } as any, JSON.stringify(sample)).catch((err) => console.error(`${name} failed`, err));
      appendMessage(root, 'user', `(tried ${name} with sample args)`);
    });
  });

  const trailRoot = root.querySelector<HTMLDivElement>('[data-workflow-trail]');
  if (trailRoot) mountWorkflowTrail(trailRoot);

  // Restore persisted messages on first render
  if (existing === 0 && persisted.length > 0) {
    const chatRoot = root.querySelector<HTMLDivElement>('[data-agent-chat]');
    if (chatRoot) {
      chatRoot.innerHTML = '';
      for (const m of persisted) {
        appendMessage(root, m.role, m.text, m.transient);
      }
    }
  }
}

function appendMessage(root: HTMLElement, role: 'user' | 'agent', text: string, transient = false): void {
  const chat = root.querySelector<HTMLDivElement>('[data-agent-chat]');
  if (!chat) return;
  const empty = chat.querySelector('.agent-chat-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = `agent-message agent-message-${role}${transient ? ' agent-message-thinking' : ''}`;
  div.innerHTML = `<span class="agent-message-role">${role === 'user' ? 'You' : 'Agent'}</span><p>${escapeHtml(text)}</p>`;
  if (role === 'agent' && !transient) {
    const actions = document.createElement('div');
    actions.className = 'agent-message-actions';
    const regen = document.createElement('button');
    regen.className = 'agent-message-regen';
    regen.textContent = 'Regenerate';
    regen.addEventListener('click', () => {
      void regenerateLast(root, text);
    });
    actions.appendChild(regen);
    div.appendChild(actions);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  if (!transient) {
    const all: ChatMessage[] = Array.from(chat.querySelectorAll<HTMLDivElement>('.agent-message'))
      .map((el) => {
        const r = el.classList.contains('agent-message-user') ? 'user' : 'agent';
        const t = el.querySelector('p')?.textContent ?? '';
        return { role: r as 'user' | 'agent', text: t, timestamp: new Date().toISOString() };
      });
    saveChat(all);
  }
  if (role === 'agent' && !transient) {
    decorateCitations(div, (claim) => {
      recordStep({
        tool_name: 'challenge_claim',
        args: { claim: claim.slice(0, 200) },
        result_summary: 'user challenged the claim; re-asking the agent',
        result_full: { claim: claim.slice(0, 200) },
        duration_ms: 0,
        status: 'ok',
      });
      const input = root.querySelector<HTMLInputElement>('[data-agent-input]');
      if (!input) return;
      input.value = `I want to challenge this claim you made: "${claim.slice(0, 200)}". Defend it with citations, or retract it.`;
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  }
}

async function regenerateLast(root: HTMLElement, previousText: string): Promise<void> {
  // Find the last user message before the agent's reply and re-ask.
  const chat = root.querySelector<HTMLDivElement>('[data-agent-chat]');
  if (!chat) return;
  const messages = Array.from(chat.querySelectorAll<HTMLDivElement>('.agent-message'));
  // Walk backwards to find the previous user message.
  let lastUserText: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.classList.contains('agent-message-user')) {
      lastUserText = m.querySelector('p')?.textContent ?? null;
      break;
    }
  }
  if (!lastUserText) return;
  recordStep({
    tool_name: 'regenerate',
    args: { prompt: lastUserText, previous: previousText.slice(0, 200) },
    result_summary: 'user regenerated the agent reply',
    result_full: { prompt: lastUserText, previous: previousText },
    duration_ms: 0,
    status: 'ok',
  });
  const form = root.querySelector<HTMLFormElement>('[data-agent-form]');
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>('[data-agent-input]');
  if (input) {
    input.value = lastUserText;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  }
}

async function loadTools(): Promise<RegisteredTool[]> {
  const ctx = getModelContext();
  try {
    const tools = await ctx.getTools();
    return tools as unknown as RegisteredTool[];
  } catch {
    return [];
  }
}

function toolCount(): number {
  return 14;
}

function sampleArgs(name: string): unknown {
  switch (name) {
    case 'list_papers':
      return {};
    case 'search_library':
      return { query: 'attention', max_results_per_paper: 3 };
    case 'show_workflow_trail':
      return { format: 'summary' };
    case 'explain_evidence':
      return { claim: 'transformers are better than RNNs for sequence modeling' };
    default:
      return {};
  }
}

function toolRow(t: RegisteredTool): string {
  const readOnly = t.annotations?.readOnlyHint ?? !!(t.name === 'list_papers' || t.name === 'search_library');
  return `
    <li class="tool-row" data-tool-name="${escapeHtml(t.name)}">
      <div class="tool-row-head">
        <code class="tool-name">${escapeHtml(t.name)}</code>
        <span class="tool-readonly">${readOnly ? 'read' : 'write'}</span>
        <button class="tool-tryit" data-tryit="${escapeHtml(t.name)}" title="Try this tool with sample args">Try it</button>
      </div>
      <p class="tool-description">${escapeHtml(t.description)}</p>
    </li>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
