/**
 * Confirmation modal — the per-write-tool gate.
 *
 * Per the WebMCP secure-tools guide: every write tool requires user
 * confirmation on the first call in a session. Subsequent calls in
 * the same session are allowed if the user clicks "Allow for this
 * session". The modal renders inline at the body root and returns a
 * promise that resolves to the user's choice.
 *
 * The harness (public/assets/tools/register.ts) wraps every write
 * tool's execute() in a call to this modal. The user-facing flow:
 *
 *   1. Agent calls a write tool.
 *   2. Modal appears: title, body, "View full args" expander, three
 *      buttons (Allow / Allow for this session / Deny).
 *   3. User clicks one. The promise resolves.
 *   4. Deny throws a USER_DENIED structured error the model can read.
 *
 * Closes #38.
 */

export type ConfirmationChoice = 'allow' | 'always' | 'deny';

export interface ConfirmationRequest {
  toolName: string;
  description: string;
  args: unknown;
  body?: string;
}

export function requestConfirmation(req: ConfirmationRequest): Promise<ConfirmationChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title-${cssId(req.toolName)}">
        <h2 id="confirm-title-${cssId(req.toolName)}" class="confirm-title">
          The agent wants to <code>${escapeHtml(req.toolName)}</code>
        </h2>
        <p class="confirm-body">${escapeHtml(req.body ?? req.description)}</p>
        <details class="confirm-args">
          <summary>View full args</summary>
          <pre>${escapeHtml(JSON.stringify(req.args, null, 2))}</pre>
        </details>
        <div class="confirm-actions">
          <button data-action="deny" class="confirm-deny">Deny</button>
          <button data-action="allow" class="confirm-allow">Allow</button>
          <button data-action="always" class="confirm-always">Allow for this session</button>
        </div>
        <p class="confirm-hint">This is a write tool. The agent can describe what it wants to do and why, but only you can decide.</p>
      </div>
    `;

    function cleanup(choice: ConfirmationChoice): void {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(choice);
    }

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') cleanup('deny');
      if (e.key === 'Enter') cleanup('allow');
    }

    overlay.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const action = t.dataset.action as ConfirmationChoice | undefined;
      if (action) cleanup(action);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    const first = overlay.querySelector<HTMLButtonElement>('button[data-action="allow"]');
    first?.focus();
  });
}

function cssId(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
