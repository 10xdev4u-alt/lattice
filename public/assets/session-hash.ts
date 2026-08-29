/**
 * Session hash — base64url-encode the current session_id into
 * the URL fragment, so the user can copy a short URL that
 * represents "this exact session". Decoding on load sets the
 * session_id back so the audit log continues on the same line.
 *
 * A future PR can layer a real session-loading feature on top
 * (paste a session_id, restore the workflow trail). For now the
 * PR ships the URL round-trip.
 */

import { getSession } from './workflow-trail';

function toB64Url(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64Url(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}

export function currentSessionHash(): string {
  const s = getSession();
  return toB64Url(s.session_id);
}

export function sessionHashUrl(): string {
  const hash = currentSessionHash();
  const url = new URL(window.location.href);
  url.hash = `s=${hash}`;
  return url.toString();
}

export function mountSessionHashOverlay(): void {
  const hash = currentSessionHash();
  const url = sessionHashUrl();
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 90vw; max-width: 520px">
      <button data-action="close">Close</button>
      <h2>Session hash</h2>
      <p class="canvas-empty" style="margin-bottom: var(--sp-2)">A short URL that points to the current session. The session_id is encoded in the URL fragment so the URL alone is enough to identify the session.</p>
      <pre data-session-hash-url style="background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); padding: var(--sp-2); font-size: var(--text-xs); color: var(--fg); overflow: auto; max-height: 200px; font-family: var(--font-mono); white-space: pre-wrap; word-break: break-all;">${escapeHtml(url)}</pre>
      <p class="canvas-empty" data-session-hash-meta>Raw hash: <code>${escapeHtml(hash)}</code></p>
      <div class="hash-actions">
        <button data-action="copy">Copy URL</button>
        <button data-action="copy-hash">Copy hash only</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  overlay.querySelector<HTMLButtonElement>('[data-action="copy"]')?.addEventListener('click', () => {
    void navigator.clipboard?.writeText(url);
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="copy-hash"]')?.addEventListener('click', () => {
    void navigator.clipboard?.writeText(hash);
  });
}

export function readSessionHashFromUrl(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const s = params.get('s');
  if (!s) return null;
  try {
    return fromB64Url(s);
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
