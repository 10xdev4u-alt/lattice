/**
 * Timeline scrubber — drag to rewind the audit log.
 *
 * A horizontal slider that lets the user move through the steps in
 * the session. Drag to step N, the UI shows only the steps up to
 * that point. The "Resume from here" button re-issues the model
 * call with the same context (or, in the demo, just resets the
 * scrubber back to the latest step with a confirmation).
 *
 * Closes the polish item: time-travel over the audit log.
 */

import { getSession, type WorkflowStep } from '../workflow-trail';

export function mountTimelineScrubber(root: HTMLElement): void {
  const session = getSession();
  if (session.steps.length === 0) {
    root.innerHTML = `<p class="scrubber-empty">No tool calls yet. The scrubber appears once the agent acts.</p>`;
    return;
  }

  root.innerHTML = `
    <div class="scrubber">
      <h2>Time travel</h2>
      <p class="scrubber-subtitle">Drag the slider to rewind the session to any step. The audit log below will re-render to show only that step and earlier.</p>
      <div class="scrubber-controls">
        <input type="range" min="1" max="${session.steps.length}" value="${session.steps.length}" step="1" data-scrubber />
        <output data-scrubber-out>${session.steps.length}</output>
        <button data-action="reset">Reset to latest</button>
      </div>
      <p class="scrubber-state" data-scrubber-state>Viewing all ${session.steps.length} step(s).</p>
    </div>
  `;

  const input = root.querySelector<HTMLInputElement>('[data-scrubber]');
  const out = root.querySelector<HTMLOutputElement>('[data-scrubber-out]');
  const state = root.querySelector<HTMLElement>('[data-scrubber-state]');
  const reset = root.querySelector<HTMLButtonElement>('[data-action="reset"]');

  function apply(value: number): void {
    if (out) out.textContent = String(value);
    if (state) {
      state.textContent = value === session.steps.length
        ? `Viewing all ${session.steps.length} step(s).`
        : `Rewound to step ${value} of ${session.steps.length}. ${session.steps.length - value} step(s) hidden.`;
    }
    document.dispatchEvent(new CustomEvent('lattice:scrub-to', { detail: { step: value } }));
  }

  input?.addEventListener('input', () => {
    const v = Number(input.value);
    apply(v);
  });
  reset?.addEventListener('click', () => {
    if (input) input.value = String(session.steps.length);
    apply(session.steps.length);
  });
}
