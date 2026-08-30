/**
 * Session restore — paste a session_id (or a share URL with a
 * session hash) and fetch that session's workflow trail from the
 * /api/sessions/<id> endpoint. Replaces the local trail with the
 * returned one.
 *
 * Closes the polish item: a session-restore affordance.
 */

export function mountSessionRestoreOverlay(): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 480px; max-width: 92vw; padding: var(--sp-4)">
      <button data-action="close">Close</button>
      <h2>Restore a session</h2>
      <p class="canvas-empty">Paste a session id (e.g. sess_abc123) or a share URL (with #s=... in it). The workflow trail will be replaced with that session's audit log.</p>
      <form data-form>
        <input data-input placeholder="session id or share URL" required />
        <button type="submit">Restore</button>
      </form>
      <p data-status></p>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const form = overlay.querySelector<HTMLFormElement>('[data-form]');
  const status = overlay.querySelector<HTMLElement>('[data-status]');
  if (!form || !status) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = overlay.querySelector<HTMLInputElement>('[data-input]');
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;
    // Accept a share URL with #s=<hash>
    let sessionId = raw;
    const hashMatch = raw.match(/#s=([\w-]+)/);
    if (hashMatch?.[1]) {
      sessionId = atob(hashMatch[1].replace(/-/g, '+').replace(/_/g, '/'));
    }
    status.textContent = `Fetching session ${sessionId}...`;
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
      if (!res.ok) {
        status.textContent = `Not found (${res.status}). Check the session id and try again.`;
        return;
      }
      const data = (await res.json()) as { steps?: unknown[] };
      if (typeof localStorage !== 'undefined') {
        const key = 'lattice.workflow-trail.v1';
        const existing = JSON.parse(localStorage.getItem(key) ?? '{}');
        localStorage.setItem(
          key,
          JSON.stringify({ ...existing, ...data, session_id: sessionId }),
        );
      }
      document.dispatchEvent(new CustomEvent('lattice:trail-changed'));
      status.textContent = 'Restored. Open the Log tab to see the audit trail.';
      input.value = '';
    } catch (err) {
      status.textContent = `Error: ${(err as Error).message}`;
    }
  });
}
