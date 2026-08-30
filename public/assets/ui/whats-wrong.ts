/**
 * "What's wrong" — a small overlay that lists the last 10
 * errors in the audit log, with a "Re-run" button per error.
 * Useful when the user sees something not work and wants to
 * know why.
 *
 * Closes PR #210: a "what's wrong" debug overlay.
 */

import { getSession } from '../workflow-trail';
import { getModelContext } from '../model-context-polyfill';
import { recordStep } from '../workflow-trail';

export function mountWhatsWrongOverlay(): void {
  const session = getSession();
  const errored = session.steps.filter((s) => s.status === 'err');
  if (errored.length === 0) {
    window.alert('No errors in the audit log. Everything is fine.');
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 92vw; max-width: 880px; padding: var(--sp-4); max-height: 80vh; overflow: auto">
      <button data-action="close">Close</button>
      <h2>What's wrong?</h2>
      <p class="canvas-empty">The last ${errored.length} error${errored.length === 1 ? '' : 's'} from the audit log. Click "Re-run" to retry the call with the same args.</p>
      <ul class="whats-wrong-list">
        ${errored
          .map(
            (s) => `<li class="whats-wrong-row" data-step-id="${s.step_id}">
              <div class="whats-wrong-meta">Step #${s.step_id} · ${s.tool_name} · ${s.duration_ms}ms</div>
              <div class="whats-wrong-text">${escapeHtml(s.result_summary)}</div>
              <pre class="whats-wrong-args">${escapeHtml(JSON.stringify(s.args, null, 2))}</pre>
              <button data-action="rerun" data-step-id="${s.step_id}">Re-run</button>
            </li>`,
          )
          .join('')}
      </ul>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
    if (t.dataset.action === 'rerun') {
      const id = Number(t.dataset.stepId);
      const step = session.steps.find((s) => s.step_id === id);
      if (!step) return;
      const btn = t as HTMLButtonElement;
      btn.disabled = true;
      t.textContent = 'Re-running…';
      const ctx = getModelContext();
      const start = performance.now();
      ctx
        .executeTool(
          { name: step.tool_name } as any,
          JSON.stringify(step.args ?? {}),
          { signal: new AbortController().signal },
        )
        .then((result) => {
          recordStep({
            tool_name: `${step.tool_name}_rerun`,
            args: step.args,
            result_summary: JSON.stringify(result).slice(0, 500),
            result_full: { result, rerun: true },
            duration_ms: Math.round(performance.now() - start),
            status: 'ok',
          });
          t.textContent = 'OK ✓';
        })
        .catch((err) => {
          recordStep({
            tool_name: `${step.tool_name}_rerun`,
            args: step.args,
            result_summary: `error: ${(err as Error).message}`,
            result_full: { error: (err as Error).message },
            duration_ms: Math.round(performance.now() - start),
            status: 'err',
          });
          t.textContent = `Failed: ${(err as Error).message}`;
        });
    }
  });
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
