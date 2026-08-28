/**
 * "What just changed" toast — when a new step lands in the audit
 * log, show a small toast at the bottom-right with the last 2
 * steps. Click to open the Log tab. Auto-dismisses after 6s.
 *
 * Closes the polish item: a "what just changed" toast.
 */

import { getSession } from './workflow-trail';

let lastSeenStepId = 0;

function readLastSeen(): number {
  if (typeof localStorage === 'undefined') return 0;
  const v = localStorage.getItem('lattice.toast.last-seen');
  return v ? Number(v) : 0;
}

function writeLastSeen(n: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('lattice.toast.last-seen', String(n));
}

export function mountWhatJustChanged(): void {
  lastSeenStepId = readLastSeen();
  document.addEventListener('webmcp:toolcall', () => {
    const session = getSession();
    const last = session.steps[session.steps.length - 1];
    if (!last) return;
    if (last.step_id <= lastSeenStepId) return;
    lastSeenStepId = last.step_id;
    writeLastSeen(last.step_id);
    const prev = session.steps[session.steps.length - 2];
    showToast(last, prev);
  });
}

function showToast(last: { tool_name: string; duration_ms: number }, prev?: { tool_name: string }): void {
  document.querySelectorAll('.what-just-changed').forEach((el) => el.remove());
  const toast = document.createElement('div');
  toast.className = 'what-just-changed';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <div class="wjc-content">
      <div class="wjc-title">Audit log updated</div>
      <div class="wjc-steps">
        ${prev ? `<code>${escapeHtml(prev.tool_name)}</code> → ` : ''}<code>${escapeHtml(last.tool_name)}</code>
        <span class="wjc-meta">${last.duration_ms}ms</span>
      </div>
    </div>
    <button data-action="open">View log</button>
    <button data-action="dismiss" aria-label="Dismiss">×</button>
  `;
  document.body.appendChild(toast);
  toast.querySelector('[data-action="open"]')?.addEventListener('click', () => {
    document.querySelector<HTMLElement>('[data-tab="log"]')?.click();
    toast.remove();
  });
  toast.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => toast.remove());
  setTimeout(() => toast.remove(), 6000);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
