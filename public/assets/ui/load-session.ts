/**
 * Load a saved session by id. The user pastes a session_id and
 * we fetch the session from a /api/sessions/<id> endpoint. For
 * the demo, the endpoint is a stub that returns the localStorage
 * session matching the id.
 *
 * Closes the polish item: a "load saved session" affordance.
 */

export async function loadSessionById(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return false;
    const payload = (await res.json()) as { steps: unknown[] };
    if (typeof localStorage !== 'undefined') {
      const sessionKey = 'lattice.workflow-trail.v1';
      const existing = JSON.parse(localStorage.getItem(sessionKey) ?? '{}');
      localStorage.setItem(
        sessionKey,
        JSON.stringify({ ...existing, ...payload, session_id: sessionId }),
      );
      document.dispatchEvent(new CustomEvent('lattice:trail-changed'));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function mountLoadSessionOverlay(root: HTMLElement): void {
  root.innerHTML = `
    <h2>Load a saved session</h2>
    <p class="load-session-sub">Paste a session_id (e.g. <code>sess_abc123</code>) to load that session's audit log into the current workspace.</p>
    <form class="load-session-form" data-load-form>
      <input type="text" data-load-input placeholder="sess_..." aria-label="Session id" />
      <button type="submit">Load</button>
    </form>
    <p class="load-session-status" data-load-status></p>
  `;
  const form = root.querySelector<HTMLFormElement>('[data-load-form]');
  const status = root.querySelector<HTMLElement>('[data-load-status]');
  if (!form || !status) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = root.querySelector<HTMLInputElement>('[data-load-input]');
    if (!input) return;
    const id = input.value.trim();
    if (!id) return;
    status.textContent = 'Loading…';
    const ok = await loadSessionById(id);
    status.textContent = ok ? 'Loaded.' : 'Not found. Check the id and try again.';
  });
}
