/**
 * Trail watcher — counts the number of new audit-log steps that
 * have arrived since the user last looked at the Log tab. Renders
 * a small badge on the tab button. Resets to 0 when the user
 * clicks the tab.
 *
 * Closes the polish item: a "new steps since you last looked" badge.
 */

import { getSession } from './workflow-trail';

const STORAGE_KEY = 'lattice.trail-watcher.v1';
let lastSeenStepId = 0;
let pendingRender: (() => void) | null = null;

function readLastSeen(): number {
  if (typeof localStorage === 'undefined') return 0;
  const v = localStorage.getItem(STORAGE_KEY);
  return v ? Number(v) : 0;
}

function writeLastSeen(n: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(n));
}

function computeNewCount(): number {
  const session = getSession();
  const last = session.steps[session.steps.length - 1];
  if (!last) return 0;
  const since = session.steps.filter((s) => s.step_id > lastSeenStepId).length;
  return since;
}

function paint(): void {
  const tab = document.querySelector<HTMLElement>('[data-tab="log"]');
  if (!tab) return;
  let badge = tab.querySelector<HTMLElement>('.trail-badge');
  const since = computeNewCount();
  if (since > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'trail-badge';
      tab.appendChild(badge);
    }
    badge.textContent = String(since > 99 ? '99+' : since);
  } else if (badge) {
    badge.remove();
  }
}

export function initTrailWatcher(): void {
  lastSeenStepId = readLastSeen();
  pendingRender = paint;
  document.addEventListener('webmcp:toolcall', () => {
    if (pendingRender) pendingRender();
  });
  // Initial paint
  paint();
  // Reset the counter when the user opens the Log tab
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset?.tab === 'log') {
      const session = getSession();
      const last = session.steps[session.steps.length - 1];
      if (last) {
        lastSeenStepId = last.step_id;
        writeLastSeen(lastSeenStepId);
      }
      paint();
    }
  });
}
