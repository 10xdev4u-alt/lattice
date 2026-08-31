/**
 * "What's in the prompt" — a debug view of the exact messages
 * array sent to the LLM. Shows the system prompt, the chat
 * history, and the user's last message, with token counts per
 * message and total.
 *
 * Open from the context-budget bar's Config button (or a dedicated
 * button in the agent rail). Useful for debugging why the LLM
 * is responding the way it is.
 *
 * Closes the polish item: a "what's in the prompt" debug view.
 */


interface DebugMessage {
  role: string;
  chars: number;
  estTokens: number;
  preview: string;
}

function buildMessages(chat: HTMLElement): DebugMessage[] {
  const messages = Array.from(chat.querySelectorAll<HTMLDivElement>('.agent-message')).map((el) => ({
    role: el.classList.contains('agent-message-user') ? 'user' : 'assistant',
    content: el.querySelector('p')?.textContent ?? '',
  }));
  return messages.map((m) => ({
    role: m.role,
    chars: m.content.length,
    estTokens: Math.ceil(m.content.length / 4),
    preview: m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content,
  }));
}

export function mountPromptDebugOverlay(): void {
  const chat = document.querySelector<HTMLElement>('[data-agent-chat]');
  if (!chat) return;
  const messages = buildMessages(chat);
  const totalChars = messages.reduce((acc, m) => acc + m.chars, 0);
  const totalTokens = Math.ceil(totalChars / 4);

  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal prompt-debug-modal" role="dialog" aria-modal="true">
      <button data-action="close">Close</button>
      <h2>What's in the prompt</h2>
      <p class="prompt-debug-summary">${messages.length} message(s) · ${totalChars.toLocaleString()} chars · ~${totalTokens.toLocaleString()} tokens</p>
      <ol class="prompt-debug-list" role="list">
        ${messages
          .map(
            (m, i) => `<li class="prompt-debug-item" data-role="${m.role}">
              <div class="prompt-debug-header">
                <span class="prompt-debug-index">#${i + 1}</span>
                <span class="prompt-debug-role">${m.role}</span>
                <span class="prompt-debug-tokens">${m.chars.toLocaleString()}c / ${m.estTokens}t</span>
              </div>
              <pre>${escapeHtml(m.preview)}</pre>
            </li>`,
          )
          .join('')}
      </ol>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
