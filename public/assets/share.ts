/**
 * Share by URL — generate a read-only link to a Lattice session.
 *
 * The session is encoded into the URL fragment as base64-encoded
 * JSON. The recipient opens the URL in any browser and sees a
 * read-only view of the audit log AND the chat history. No
 * server round-trip; the privacy model is "the URL is the data."
 *
 * For the demo the shared view lives at /share/ in the index shell.
 * In production this would be a separate route.
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

export function encodeSessionToFragment(session: WorkflowSession): string {
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
        duration_ms: s.duration_ms,
        status: s.status,
      })),
    },
    chat,
  };
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSessionFromFragment(fragment: string): SharedPayload | null {
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(fragment))));
    return JSON.parse(json) as SharedPayload;
  } catch {
    return null;
  }
}

export function buildShareUrl(): string {
  const session = getSession();
  if (session.steps.length === 0) return window.location.href;
  const fragment = encodeSessionToFragment(session);
  const url = new URL(window.location.href);
  url.hash = `share=${fragment}`;
  url.pathname = url.pathname.replace(/index\.html$/, 'share.html');
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
