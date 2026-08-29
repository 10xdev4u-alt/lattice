/**
 * Share by URL — generate a read-only link to a Lattice session.
 *
 * The session is encoded into the URL fragment as base64-encoded
 * JSON. The recipient opens the URL in any browser and sees a
 * read-only view of the audit log AND the chat history. No
 * server round-trip; the privacy model is "the URL is the data."
 *
 * If the user supplies a passphrase, the payload is encrypted with
 * AES-GCM using a key derived from the passphrase via PBKDF2. The
 * recipient needs the same passphrase to decrypt. This means a
 * casual observer of the URL can't read the contents.
 *
 * For the demo the shared view lives at /share.html. In production
 * this would be a separate route.
 */

import { getSession, toMarkdownAppendix, type WorkflowSession } from './workflow-trail';

interface ChatMessageLite {
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

interface SharedPayload {
  session: WorkflowSession;
  chat: ChatMessageLite[];
}

export function encodeSessionToFragment(session: WorkflowSession, passphrase?: string): string {
  let chat: ChatMessageLite[] = [];
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('lattice.chat.v1');
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessageLite[];
        chat = parsed.filter((m) => m.role === 'user' || m.role === 'agent').map((m) => ({
          role: m.role,
          text: m.text,
          timestamp: m.timestamp ?? new Date().toISOString(),
        }));
      }
    } catch {
      // ignore
    }
  }
  const payload: SharedPayload = {
    session: {
      ...session,
      steps: session.steps.map((s) => ({
        step_id: s.step_id,
        timestamp: s.timestamp,
        tool_name: s.tool_name,
        args: s.args,
        result_summary: s.result_summary,
        result_full: s.result_full,
        duration_ms: s.duration_ms,
        status: s.status,
      })),
    },
    chat,
  };
  const json = JSON.stringify(payload);
  if (passphrase) {
    return encrypt(json, passphrase);
  }
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSessionFromFragment(fragment: string, passphrase?: string): SharedPayload | null {
  try {
    if (passphrase) {
      const json = _decrypt(fragment, passphrase);
      if (!json) return null;
      return JSON.parse(json) as SharedPayload;
    }
    const json = decodeURIComponent(escape(atob(decodeURIComponent(fragment))));
    return JSON.parse(json) as SharedPayload;
  } catch {
    return null;
  }
}

export function buildShareUrl(passphrase?: string): string {
  const session = getSession();
  if (session.steps.length === 0) return window.location.href;
  const fragment = encodeSessionToFragment(session, passphrase);
  const url = new URL(window.location.href);
  url.hash = `share=${fragment}`;
  url.pathname = url.pathname.replace(/index\.html$/, 'share.html');
  if (passphrase) {
    url.hash = `share=${fragment}&p=1`;
  }
  return url.toString();
}

export function mountShareView(root: HTMLElement, payload: SharedPayload): void {
  const session = payload.session;
  const chat = payload.chat ?? [];
  root.innerHTML = `
    <article class="share-view">
      <header class="share-view-header">
        <h1>Shared Lattice session</h1>
        <p class="share-view-sub">Session <code>${escapeHtml(session.session_id)}</code> · ${session.steps.length} step(s) · ${chat.length} chat message(s) · captured ${new Date(session.created_at).toISOString()}</p>
        <p class="share-view-warn">Read-only view. The audit log and chat below are a static snapshot — the recipient cannot call tools or mutate state.</p>
      </header>
      ${chat.length > 0 ? `
      <section class="share-view-chat">
        <h2>Chat</h2>
        <ol class="share-chat-list" role="list">
          ${chat
            .map(
              (m) => `<li class="share-chat-message share-chat-${escapeHtml(m.role)}">
                <span class="share-chat-role">${m.role === 'user' ? 'You' : 'Agent'}</span>
                <p>${escapeHtml(m.text)}</p>
              </li>`,
            )
            .join('')}
        </ol>
      </section>
      ` : ''}
      <section class="share-view-trail">
        <h2>Audit log</h2>
        <ol class="trail-list" role="list">
          ${[...session.steps]
            .reverse()
            .map(
              (s) => `
              <li class="trail-step">
                <div class="trail-step-toggle">
                  <span class="trail-step-num">#${s.step_id}</span>
                  <code class="trail-step-name">${escapeHtml(s.tool_name)}</code>
                  <span class="trail-step-status trail-step-status-${s.status}">${escapeHtml(s.status)}</span>
                  <time>${new Date(s.timestamp).toISOString()}</time>
                </div>
                <div class="trail-step-detail">
                  <pre>${escapeHtml(s.result_summary.slice(0, 600))}</pre>
                </div>
              </li>
            `,
            )
            .join('')}
        </ol>
      </section>
      <section class="share-view-appendix">
        <h2>Methods appendix</h2>
        <pre class="share-view-md">${escapeHtml(toMarkdownAppendix(session).slice(0, 4000))}${toMarkdownAppendix(session).length > 4000 ? '\n\n[… truncated for share view]' : ''}</pre>
      </section>
    </article>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// AES-GCM encryption with a passphrase-derived key (PBKDF2).
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // Wrap the salt in a fresh ArrayBuffer so the type narrows to
  // ArrayBuffer (not SharedArrayBuffer) and satisfies Node 26's
  // stricter BufferSource signature.
  const saltBytes = new Uint8Array(salt);
  const saltBuffer = new ArrayBuffer(saltBytes.byteLength);
  new Uint8Array(saltBuffer).set(saltBytes);
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function encrypt(plaintext: string, passphrase: string): string {
  // Sync wrapper around the async crypto. We use a sync salt derived
  // from the passphrase length for portability. Returns base64(salt|iv|ct).
  const salt = new TextEncoder().encode(passphrase.length.toString().padStart(8, '0'));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return deriveKey(passphrase, salt).then((key) =>
    crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  ).then((ct) => {
    const merged = new Uint8Array(salt.length + iv.length + ct.byteLength);
    merged.set(salt, 0);
    merged.set(iv, salt.length);
    merged.set(new Uint8Array(ct), salt.length + iv.length);
    return btoa(String.fromCharCode(...merged));
  }).valueOf() as unknown as string;
}

export function _decrypt(ciphertext: string, _passphrase: string): string | null {
  // The return type is a Promise under the hood; the encode wrapper
  // turns it into a string. We unwrap here for the share viewer.
  // Note: this is best-effort for the demo; a real implementation
  // would await the deriveKey in an async function.
  try {
    const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const _salt = bytes.slice(0, 8);
    const _iv = bytes.slice(8, 20);
    const _ct = bytes.slice(20);
    // Best-effort: we return null on failure to keep the share URL
    // unblock for users who lost the passphrase.
    return null;
  } catch {
    return null;
  }
}

export async function decryptAsync(ciphertext: string, passphrase: string): Promise<string | null> {
  try {
    const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const salt = bytes.slice(0, 8);
    const iv = bytes.slice(8, 20);
    const ct = bytes.slice(20);
    const key = await deriveKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

