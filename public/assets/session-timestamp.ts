/**
 * Session timestamp footer — shows the workflow trail's created_at
 * timestamp at the bottom-right of the app. Renders nothing
 * (clears the host) if no session has been recorded yet.
 */

import { getSession } from './workflow-trail';

export function mountSessionTimestamp(): void {
  const host = document.getElementById('session-timestamp-host');
  if (!host) return;
  const session = getSession();
  if (!session.created_at || session.steps.length === 0) {
    host.textContent = '';
    return;
  }
  const started = new Date(session.created_at);
  const ageMs = Date.now() - started.getTime();
  const minutes = Math.floor(ageMs / 60000);
  host.textContent = `session started ${started.toISOString().replace('T', ' ').slice(0, 16)} · ${minutes}m ago`;
}

export function refreshSessionTimestamp(): void {
  mountSessionTimestamp();
}
