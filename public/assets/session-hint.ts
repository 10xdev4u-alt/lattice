/**
 * Session hint — a small bubble that appears after the user has
 * been on the page for 90 seconds. It suggests the single most
 * useful next action based on the current state of the library
 * and the audit log.
 *
 * Suggestions:
 *  - library empty -> "Load sample library"
 *  - library loaded, no searches -> "Search the library"
 *  - paper open, no summary -> "Summarize this paper"
 *  - paper open, no comparison -> "Compare with another paper"
 *  - many tool calls, never branched -> "Fork a branch to try a different path"
 *  - audit log long, never exported -> "Export as methods appendix"
 *
 * Closes the polish item: a smart next-action hint.
 */

import { getLibrary } from './library';
import { getSession } from './workflow-trail';

interface Suggestion {
  cta: string;
  reason: string;
  action: 'load-sample' | 'open-feed' | 'search' | 'summarize' | 'compare' | 'export' | 'branch' | 'tour' | 'share';
}

function suggest(): Suggestion {
  const library = getLibrary();
  const session = getSession();
  if (library.length === 0) {
    return { cta: 'Load sample library', reason: 'No papers yet — start with the 5 well-known arXiv picks', action: 'load-sample' };
  }
  const hasSearched = session.steps.some((s) => s.tool_name === 'search_library');
  if (!hasSearched) {
    return { cta: 'Open the arXiv feed', reason: 'No searches yet — see what is new in cs.LG', action: 'open-feed' };
  }
  const hasExported = session.steps.some((s) => s.tool_name === 'export_bibliography');
  const longSession = session.steps.length >= 5;
  if (longSession && !hasExported) {
    return { cta: 'Export as methods appendix', reason: `${session.steps.length} tool calls in the audit log — share your work`, action: 'export' };
  }
  const hasBranch = session.steps.some((s) => s.tool_name.startsWith('routine:'));
  if (longSession && !hasBranch) {
    return { cta: 'Save as routine', reason: 'Capture this workflow as a reusable playbook', action: 'branch' };
  }
  if (library.length >= 2) {
    return { cta: 'Compare two papers', reason: 'You have multiple papers — run compare_claims to surface conflicts', action: 'compare' };
  }
  return { cta: 'Take the 30-second tour', reason: 'See the demo in action', action: 'tour' };
}

export function mountSessionHint(root: HTMLElement): void {
  setTimeout(() => {
    const tip = suggest();
    if (sessionStorage.getItem('lattice.hint.dismissed') === '1') return;
    root.innerHTML = `
      <div class="session-hint" role="status" aria-live="polite">
        <p class="hint-cta">${escapeHtml(tip.cta)}</p>
        <p class="hint-reason">${escapeHtml(tip.reason)}</p>
        <button data-action="dismiss" aria-label="Dismiss hint">×</button>
      </div>
    `;
    root.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
      sessionStorage.setItem('lattice.hint.dismissed', '1');
      root.innerHTML = '';
    });
  }, 90_000);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
