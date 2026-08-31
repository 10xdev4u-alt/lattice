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
import { setPeerReviewerActive, isPeerReviewerActive } from './peer-reviewer';
import { mountPeerPreview } from '../peer-preview';
import { decorateCitations } from '../citation-chips';
import { inferConfidence, renderConfidenceDot } from '../confidence';
import { recordFeedback, getFeedbackForMessage } from '../feedback';
import { streamCompletePrompt } from '../llm-stream';

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

  // Event delegation on root: render() replaces root.innerHTML, which
  // would orphan any listener bound directly to the form node. The
  // submit event bubbles, so this binding survives re-renders.
  root.addEventListener('submit', (e) => {
    const form = (e.target as HTMLElement).closest('[data-agent-form]');
    if (!form) return;
    e.preventDefault();
    void handleSubmit(root);
  });

  document.addEventListener('webmcp:toolcall', () => render(root));
  document.addEventListener('lattice:peer-reviewer-changed', () => render(root));
  document.addEventListener('lattice:rate-limited', () => {
    const banner = root.querySelector<HTMLElement>('[data-rate-limit]');
    if (banner) {
      banner.removeAttribute('hidden');
      setTimeout(() => banner.setAttribute('hidden', ''), 5000);
    }
  });

  // Live tool rows: the running row shows a climbing ms counter;
  // when the call lands, it keeps its duration beside the name.
  // Durations live in a module map so the re-render that follows
  // each toolcall event can restore them into fresh rows.
  const lastDurations = new Map<string, number>();
  void import('../webmcp-live').then(({ onCallStart, onCallEnd }) => {
    let counters = new Map<string, { interval: number; start: number }>();
    const rowFor = (name: string): HTMLElement | null =>
      root.querySelector(`[data-tool-name="${cssEscape(name)}"]`);
    onCallStart(({ toolName }) => {
      const row = rowFor(toolName);
      if (!row) return;
      row.dataset.running = '1';
      const ms = row.querySelector<HTMLElement>('[data-live-ms]');
      if (!ms) return;
      ms.removeAttribute('hidden');
      const start = performance.now();
      const interval = window.setInterval(() => {
        ms.textContent = `${Math.round(performance.now() - start)}ms`;
      }, 100);
      counters.set(toolName, { interval, start });
    });
    onCallEnd(({ toolName, durationMs }) => {
      const c = counters.get(toolName);
      if (c) {
        window.clearInterval(c.interval);
        counters.delete(toolName);
      }
      lastDurations.set(toolName, durationMs);
      const row = rowFor(toolName);
      if (!row) return;
      row.dataset.running = '0';
      const live = row.querySelector<HTMLElement>('[data-live-ms]');
      const last = row.querySelector<HTMLElement>('[data-last-ms]');
      if (live) live.setAttribute('hidden', '');
      if (last) last.textContent = `${durationMs}ms`;
    });
    // After each toolcall re-render, restore the recorded
    // durations onto the fresh rows.
    document.addEventListener('webmcp:toolcall', () => {
      for (const [name, ms] of lastDurations) {
        const last = rowFor(name)?.querySelector<HTMLElement>('[data-last-ms]');
        if (last) last.textContent = `${ms}ms`;
      }
    });
  });
}

function cssEscape(s: string): string {
  return (window as unknown as { CSS?: { escape?: (v: string) => string } }).CSS?.escape?.(s) ?? s;
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
    const chat = root.querySelector<HTMLDivElement>('[data-agent-chat]');
    const controller = new AbortController();
    // Stream the answer directly into a new agent message so the user
    // sees tokens land in real time.
    const streamDiv = document.createElement('div');
    streamDiv.className = 'agent-message agent-message-agent';
    streamDiv.innerHTML = `<span class="agent-message-role">Agent</span><p data-stream-target></p>`;
    chat?.appendChild(streamDiv);
    chat?.scrollTo({ top: chat.scrollHeight });
    const target = streamDiv.querySelector<HTMLElement>('[data-stream-target]');
    let streamed = '';
    try {
      const system = `You are Lattice, a research-paper assistant. Keep answers short and direct. Use markdown for structure. Cite paper ids when referencing specific papers.`;
      await streamCompletePrompt(text, { signal: controller.signal, maxTokens: 800, system }, (delta) => {
        streamed += delta;
        if (target) target.textContent = streamed;
        chat?.scrollTo({ top: chat.scrollHeight });
      });
      if (target) target.innerHTML = escapeHtml(streamed) + renderConfidenceDot(inferConfidence(streamed));
    } catch (err) {
      if (target) target.textContent = `Error: ${(err as Error).message}`;
    } finally {
      setBusy(root, false);
      void import('../prompt-diff').then(({ recordPrompt }) => {
        recordPrompt(text, streamed, undefined);
      });
    }
  } catch (err) {
    setBusy(root, false);
    appendMessage(root, 'agent', `Error: ${(err as Error).message}`);
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
      <div class="rate-limit-banner" data-rate-limit hidden role="status">Rate limit hit. The next attempt will wait and retry.</div>
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
  div.innerHTML = `<span class="agent-message-role">${role === 'user' ? 'You' : 'Agent'}</span><p data-stream-target></p>`;
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
    // Feedback buttons
    const feedbackActions = document.createElement('div');
    feedbackActions.className = 'feedback-actions';
    const session = getSession();
    const messages = Array.from(chat?.querySelectorAll<HTMLDivElement>('.agent-message') ?? []);
    const messageIndex = messages.indexOf(div);
    const existing = getFeedbackForMessage(session.session_id, messageIndex);
    const upBtn = document.createElement('button');
    upBtn.className = `feedback-btn${existing === 'up' ? ' active-up' : ''}`;
    upBtn.textContent = 'up';
    upBtn.title = 'Helpful';
    upBtn.setAttribute('aria-label', 'Helpful');
    upBtn.addEventListener('click', () => {
      recordFeedback({ sessionId: session.session_id, messageIndex, text, feedback: 'up' });
      upBtn.classList.add('active-up');
      downBtn.classList.remove('active-down');
    });
    const downBtn = document.createElement('button');
    downBtn.className = `feedback-btn${existing === 'down' ? ' active-down' : ''}`;
    downBtn.textContent = 'down';
    downBtn.title = 'Not helpful (click to regenerate with feedback)';
    downBtn.setAttribute('aria-label', 'Not helpful');
    downBtn.addEventListener('click', () => {
      recordFeedback({ sessionId: session.session_id, messageIndex, text, feedback: 'down' });
      downBtn.classList.add('active-down');
      upBtn.classList.remove('active-up');
      // Smart re-ask: tell the agent what the user disliked and ask
      // for a different approach. The previous reply is inlined as
      // a "don't do this" reference.
      void regenerateLast(root, text, true);
    });
    feedbackActions.appendChild(upBtn);
    feedbackActions.appendChild(downBtn);
    actions.appendChild(feedbackActions);
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
      // 1. Show the peer-reviewer preview popover (real challenge)
      void mountPeerPreview(div, claim);
      // 2. Also push the challenge back into the chat as a re-ask
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
      const formEl = input.closest('form');
      formEl?.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  }
}

async function regenerateLast(root: HTMLElement, previousText: string, withFeedback = false): Promise<void> {
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
    tool_name: withFeedback ? 'regenerate_with_feedback' : 'regenerate',
    args: { prompt: lastUserText, previous: previousText.slice(0, 200) },
    result_summary: withFeedback
      ? 'user gave down feedback and asked the agent to try again'
      : 'user regenerated the agent reply',
    result_full: { prompt: lastUserText, previous: previousText, with_feedback: withFeedback },
    duration_ms: 0,
    status: 'ok',
  });
  const form = root.querySelector<HTMLFormElement>('[data-agent-form]');
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>('[data-agent-input]');
  if (input) {
    input.value = withFeedback
      ? `${lastUserText}\n\nYour previous answer was: "${previousText.slice(0, 400)}". The user marked it as unhelpful. Try a different approach: be more specific, cite a paper id, or ask a clarifying question.`
      : lastUserText;
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

// toolCount: retained for the Live Tool Array badge; deliberately
// not currently used inside this file but exported for future tabs.
export function toolCount(): number {
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
    <li class="tool-row" data-tool-name="${escapeHtml(t.name)}" data-running="0">
      <div class="tool-row-head">
        <code class="tool-name">${escapeHtml(t.name)}</code>
        <span class="tool-readonly">${readOnly ? 'read' : 'write'}</span>
        <span class="tool-live-ms" data-live-ms hidden>0ms</span>
        <span class="tool-last-ms" data-last-ms></span>
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
