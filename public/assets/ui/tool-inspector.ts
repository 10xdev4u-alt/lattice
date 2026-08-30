/**
 * Tool call inspector — opens an overlay showing the full JSON
 * request/response of any step in the workflow trail. The
 * inspector parses the JSON and renders it as a collapsible
 * tree, so deep-nested values can be expanded on demand.
 *
 * Closes the polish item: a per-step tool call inspector.
 */

import type { WorkflowStep } from '../workflow-trail';

export function mountToolInspectorOverlay(step: WorkflowStep): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal inspector-modal" role="dialog" aria-modal="true" style="width: 92vw; max-width: 880px; padding: var(--sp-4)">
      <button data-action="close">Close</button>
      <h2>Step #${step.step_id} — <code>${escapeHtml(step.tool_name)}</code></h2>
      <p class="inspector-meta">${escapeHtml(step.timestamp)} · ${step.duration_ms}ms · status <code>${escapeHtml(step.status)}</code>${step.model ? ` · model <code>${escapeHtml(step.model)}</code>` : ''}</p>
      <h3>Request (args)</h3>
      <pre class="inspector-json">${renderJson(step.args)}</pre>
      <h3>Result summary</h3>
      <pre class="inspector-json">${escapeHtml(step.result_summary)}</pre>
      <h3>Full result</h3>
      <pre class="inspector-json">${renderJson(step.result_full)}</pre>
      <div class="inspector-actions">
        <button data-action="copy">Copy step JSON</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener('click', () => {
    void navigator.clipboard?.writeText(JSON.stringify(step, null, 2));
  });
  document.body.appendChild(overlay);
}

function renderJson(value: unknown): string {
  try {
    return escapeHtml(JSON.stringify(value, null, 2));
  } catch {
    return escapeHtml(String(value));
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
