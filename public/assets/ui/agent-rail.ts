/**
 * Agent rail — the right rail.
 *
 * Hosts the chat input, the live tool array (DevTools Network tab for
 * agents), the tool call log, and the peer-reviewer banner. The actual
 * model call lives in the page-level chat handler; this component is
 * the UI shell.
 *
 * Closes #38.
 */

import { getModelContext } from '../model-context-polyfill';
import { getSession } from '../workflow-trail';

export function mountAgentRail(root: HTMLElement): void {
  render(root);

  const input = root.querySelector<HTMLInputElement>('[data-agent-input]');
  const form = root.querySelector<HTMLFormElement>('[data-agent-form]');
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      appendMessage(root, 'user', text);
      input.value = '';
      void runUserPrompt(root, text);
    });
  }

  document.addEventListener('webmcp:toolcall', () => render(root));
}

async function runUserPrompt(root: HTMLElement, _text: string): Promise<void> {
  // The actual model call is intentionally out of scope here — it would
  // call an MCP-compatible chat agent (Claude / GPT / etc.). For the
  // demo we surface a placeholder reply and let the user trigger tools
  // directly via the Live Tool Array.
  appendMessage(root, 'agent', 'I can see the tools you have access to in the panel below. Try clicking one, or use the page actions (drop a PDF, paste an arXiv ID).');
}

function render(root: HTMLElement): void {
  const tools = listTools();
  const session = getSession();
  root.innerHTML = `
    <div class="agent-rail-tabs" role="tablist">
      <button data-tab="chat" role="tab" aria-selected="true">Chat</button>
      <button data-tab="tools" role="tab" aria-selected="false">Tools (${tools.length})</button>
      <button data-tab="log" role="tab" aria-selected="false">Log (${session.steps.length})</button>
    </div>
    <div class="agent-rail-tab" data-tab-content="chat">
      <div class="agent-chat" data-agent-chat>
        <p class="agent-chat-empty">No messages yet. Ask the agent anything about your library.</p>
      </div>
      <form class="agent-input" data-agent-form>
        <input type="text" data-agent-input placeholder="Ask about your library" aria-label="Ask the agent" />
        <button type="submit">Send</button>
      </form>
    </div>
    <div class="agent-rail-tab" data-tab-content="tools" hidden>
      <ul class="tool-array" role="list">
        ${tools.map((t) => toolRow(t)).join('')}
      </ul>
    </div>
    <div class="agent-rail-tab" data-tab-content="log" hidden>
      ${session.steps.length === 0
        ? '<p class="agent-log-empty">No tool calls yet. The audit trail lands here when the agent acts.</p>'
        : `<ol class="tool-log" role="list">${session.steps
            .slice(-50)
            .reverse()
            .map(
              (s) =>
                `<li class="tool-log-row"><code>${escapeHtml(s.tool_name)}</code> <span class="tool-log-status">${escapeHtml(s.status)}</span> <time>${escapeHtml(s.timestamp)}</time></li>`,
            )
            .join('')}</ol>`}
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
}

function appendMessage(root: HTMLElement, role: 'user' | 'agent', text: string): void {
  const chat = root.querySelector<HTMLDivElement>('[data-agent-chat]');
  if (!chat) return;
  chat.classList.remove('agent-chat-empty');
  const empty = chat.querySelector('.agent-chat-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = `agent-message agent-message-${role}`;
  div.innerHTML = `<span class="agent-message-role">${role === 'user' ? 'You' : 'Agent'}</span><p>${escapeHtml(text)}</p>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function listTools(): Array<{ name: string; description: string; readOnly: boolean }> {
  // The actual list comes from the registered tools. We can't call
  // getTools() synchronously, so we maintain a small client-side
  // mirror populated when the harness runs. For the demo we hard-code
  // the 9 always-on tools and let the Live Tool Array re-render when
  // per-paper tools register via toolchange.
  return ALWAYS_ON_TOOLS.map((t) => ({ ...t }));
}

const ALWAYS_ON_TOOLS = [
  { name: 'list_papers', description: 'List every paper in the library', readOnly: true },
  { name: 'open_paper', description: 'Open a paper by ID', readOnly: false },
  { name: 'search_library', description: 'Search the library by free text', readOnly: true },
  { name: 'add_to_bibliography', description: 'Add a paper to the export list', readOnly: false },
  { name: 'remove_from_bibliography', description: 'Remove a paper from the export list', readOnly: false },
  { name: 'export_bibliography', description: 'Export the bibliography as a file', readOnly: false },
  { name: 'explain_evidence', description: 'List papers supporting a claim', readOnly: true },
  { name: 'show_workflow_trail', description: 'Show the audit log', readOnly: true },
  { name: 'compose_review', description: 'Draft a peer review', readOnly: false },
];

function toolRow(t: { name: string; description: string; readOnly: boolean }): string {
  return `
    <li class="tool-row" data-tool-name="${escapeHtml(t.name)}">
      <code class="tool-name">${escapeHtml(t.name)}</code>
      <span class="tool-readonly">${t.readOnly ? 'read' : 'write'}</span>
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
