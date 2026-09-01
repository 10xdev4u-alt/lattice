/**
 * Share by URL — generate a read-only link to a Lattice session.
 *
 * The session is encoded into the URL fragment. The recipient opens
 * the URL in any browser and sees a read-only view of the audit log
 * AND the chat history. No server round-trip; the privacy model is
 * "the URL is the data."
 *
 * Encryption: AES-GCM 256 with a PBKDF2-derived key (100k iterations,
 * SHA-256). 16-byte random salt + 12-byte random IV per encryption.
 * Wire format: `v1.<b64url(salt|iv|ct)>` so future migrations can
 * version-detect. Plain (no passphrase) paths stay base64url JSON
 * for backwards compatibility with v0.0.0 share URLs.
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

const VERSION = 'v1';
const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITER = 100_000;

function collectChat(): ChatMessageLite[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem('lattice.chat.v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessageLite[];
    return parsed
      .filter((m) => (m.role === 'user' || m.role === 'agent') && m.text && m.text.trim() !== '')
      .map((m) => ({ role: m.role, text: m.text, timestamp: m.timestamp ?? new Date().toISOString() }));
  } catch {
    return [];
  }
}

function buildPayload(session: WorkflowSession): SharedPayload {
  return {
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
    chat: collectChat(),
  };
}

/** base64url encode/decode (no padding) — safe in URL fragment. */
function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const norm = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const saltBytes = new Uint8Array(salt);
  const saltBuffer = new ArrayBuffer(saltBytes.byteLength);
  new Uint8Array(saltBuffer).set(saltBytes);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuffer, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptAsync(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  );
  const merged = new Uint8Array(salt.length + iv.length + ct.length);
  merged.set(salt, 0);
  merged.set(iv, salt.length);
  merged.set(ct, salt.length + iv.length);
  return `${VERSION}.${b64urlEncode(merged)}`;
}

export async function decryptAsync(ciphertext: string, passphrase: string): Promise<string | null> {
  try {
    if (!ciphertext.startsWith(`${VERSION}.`)) return null;
    const bytes = b64urlDecode(ciphertext.slice(VERSION.length + 1));
    if (bytes.length < SALT_BYTES + IV_BYTES + 1) return null;
    const salt = bytes.slice(0, SALT_BYTES);
    const iv = bytes.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
    const ct = bytes.slice(SALT_BYTES + IV_BYTES);
    const key = await deriveKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/**
 * Synchronous share URL — used for plain (no-passphrase) export only.
 * For passphrase exports callers MUST await `buildShareUrlAsync`.
 */
export function buildShareUrl(passphrase?: string): string {
  if (passphrase) {
    // Legacy path kept for back-compat; callers should use buildShareUrlAsync.
    const session = getSession();
    if (session.steps.length === 0) return window.location.href;
    return window.location.href;
  }
  const session = getSession();
  if (session.steps.length === 0) return window.location.href;
  const json = JSON.stringify(buildPayload(session));
  const fragment = b64urlEncode(new TextEncoder().encode(json));
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/index\.html$/, 'share.html');
  url.hash = `share=${fragment}`;
  return url.toString();
}

/** Async build — required when a passphrase is involved. */
export async function buildShareUrlAsync(passphrase?: string): Promise<string> {
  const session = getSession();
  if (session.steps.length === 0) return window.location.href;
  const json = JSON.stringify(buildPayload(session));
  let fragment: string;
  if (passphrase) {
    fragment = await encryptAsync(json, passphrase);
  } else {
    fragment = b64urlEncode(new TextEncoder().encode(json));
  }
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/index\.html$/, 'share.html');
  url.hash = passphrase ? `share=${fragment}&p=1` : `share=${fragment}`;
  return url.toString();
}

export async function decodeSessionFromFragmentAsync(
  fragment: string,
  passphrase?: string,
): Promise<SharedPayload | null> {
  try {
    if (passphrase) {
      const json = await decryptAsync(fragment, passphrase);
      if (!json) return null;
      return JSON.parse(json) as SharedPayload;
    }
    const bytes = b64urlDecode(fragment);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as SharedPayload;
  } catch {
    return null;
  }
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
