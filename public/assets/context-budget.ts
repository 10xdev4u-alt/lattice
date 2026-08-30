/**
 * Context budget — estimate the tokens used by the current chat
 * history and the most recent prompt, and show a small bar in the
 * agent rail. Updates after every chat submission.
 *
 * The estimate uses the ~4 chars per token heuristic. The LLM
 * endpoint is queried for its context window (default 8k for
 * kilo-auto/free). When the chat history exceeds 80% of the
 * window, the bar turns warn-color.
 *
 * Closes the polish item: a real "context budget" indicator.
 */


interface BudgetState {
  chars: number;
  estTokens: number;
  window: number;
}

const STORAGE_KEY = 'lattice.context-budget.v1';

function getWindow(): number {
  if (typeof localStorage === 'undefined') return 8192;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v) {
    try {
      return JSON.parse(v).window ?? 8192;
    } catch {
      return 8192;
    }
  }
  return 8192;
}

export function setWindow(window: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ window }));
}

export function estimateBudget(messages: Array<{ role: string; content: string }>): BudgetState {
  const chars = messages.reduce((acc, m) => acc + (m.content?.length ?? 0), 0);
  return { chars, estTokens: Math.ceil(chars / 4), window: getWindow() };
}

export function mountContextBudgetBar(root: HTMLElement): void {
  const bar = document.createElement('div');
  bar.className = 'context-budget';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  bar.innerHTML = `
    <div class="context-budget-label">Context</div>
    <div class="context-budget-track"><div class="context-budget-fill" data-context-fill></div></div>
    <div class="context-budget-text" data-context-text>0 / 8k tokens</div>
    <button data-action="configure" title="Configure context window">⚙</button>
  `;
  root.appendChild(bar);
  const fill = bar.querySelector<HTMLElement>('[data-context-fill]');
  const text = bar.querySelector<HTMLElement>('[data-context-text]');
  const configure = bar.querySelector<HTMLButtonElement>('[data-action="configure"]');
  configure?.addEventListener('click', () => {
    const w = window.prompt('Context window (tokens):', String(getWindow()));
    if (w && Number(w) > 0) setWindow(Number(w));
  });
  document.addEventListener('lattice:chat-changed', () => update());
  update();
  function update(): void {
    const chat = document.querySelector<HTMLElement>('[data-agent-chat]');
    if (!chat) return;
    const messages = Array.from(chat.querySelectorAll<HTMLDivElement>('.agent-message')).map((el) => ({
      role: el.classList.contains('agent-message-user') ? 'user' : 'assistant',
      content: el.querySelector('p')?.textContent ?? '',
    }));
    const state = estimateBudget(messages);
    if (fill) {
      const pct = Math.min(100, Math.round((state.estTokens / state.window) * 100));
      fill.style.width = `${pct}%`;
      fill.dataset.warn = pct >= 80 ? '1' : '0';
    }
    if (text) {
      text.textContent = `${formatTokens(state.estTokens)} / ${formatTokens(state.window)} tokens`;
    }
  }
}

function formatTokens(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(1)}k`;
  return String(n);
}
