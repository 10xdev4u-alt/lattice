/**
 * Stats page — your library size, most-cited paper, agent accuracy.
 *
 * Aggregates across the library, the workflow trail, and the
 * feedback log. Renders as a single panel with three sections.
 * Open from the workspace menu or via 'g s' shortcut.
 *
 * Closes the polish item: a stats page.
 */

import { getLibrary } from './library';
import { getSession } from './workflow-trail';
import { getAllFeedback } from './feedback';
import { listRoutines } from './routines';
import { getPinnedIds } from './pins';

export function mountStatsPanel(root: HTMLElement): void {
  const library = getLibrary();
  const session = getSession();
  const feedback = getAllFeedback();
  const routines = listRoutines();
  const pinned = getPinnedIds();

  const totalSteps = session.steps.length;
  const readCalls = session.steps.filter((s) => !isWriteTool(s.tool_name)).length;
  const writeCalls = session.steps.filter((s) => isWriteTool(s.tool_name)).length;
  const errors = session.steps.filter((s) => s.status === 'err').length;
  const denied = session.steps.filter((s) => s.status === 'denied').length;
  const totalDuration = session.steps.reduce((acc, s) => acc + s.duration_ms, 0);
  const upCount = feedback.filter((f) => f.feedback === 'up').length;
  const downCount = feedback.filter((f) => f.feedback === 'down').length;
  const approval = upCount + downCount > 0 ? Math.round((upCount / (upCount + downCount)) * 100) : null;
  const mostUsedTool = mostFrequent(session.steps.map((s) => s.tool_name));
  const mostRecentPaper = library.sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0];

  root.innerHTML = `
    <div class="stats-panel">
      <header class="stats-header">
        <h2>Your Lattice stats</h2>
        <p class="stats-subtitle">Across the library, the audit log, and the feedback log.</p>
      </header>

      <section class="stats-section">
        <h3>Library</h3>
        <ul>
          <li><span class="stats-num">${library.length}</span> paper${library.length === 1 ? '' : 's'}</li>
          <li><span class="stats-num">${pinned.length}</span> pinned</li>
          <li><span class="stats-num">${routines.length}</span> saved routine${routines.length === 1 ? '' : 's'}</li>
          ${mostRecentPaper ? `<li>most recent: <code>${escapeHtml(mostRecentPaper.id)}</code></li>` : ''}
        </ul>
      </section>

      <section class="stats-section">
        <h3>Agent activity (this session)</h3>
        <ul>
          <li><span class="stats-num">${totalSteps}</span> tool call${totalSteps === 1 ? '' : 's'}</li>
          <li><span class="stats-num">${readCalls}</span> read · <span class="stats-num">${writeCalls}</span> write</li>
          ${mostUsedTool ? `<li>most used: <code>${escapeHtml(mostUsedTool)}</code></li>` : ''}
          ${errors > 0 ? `<li><span class="stats-num stats-warn">${errors}</span> error${errors === 1 ? '' : 's'}</li>` : ''}
          ${denied > 0 ? `<li><span class="stats-num stats-warn">${denied}</span> denied by you</li>` : ''}
          <li>total time: <span class="stats-num">${(totalDuration / 1000).toFixed(1)}s</span></li>
        </ul>
      </section>

      <section class="stats-section">
        <h3>Feedback (your rating)</h3>
        <ul>
          <li><span class="stats-num stats-good">${upCount}</span> thumbs up</li>
          <li><span class="stats-num stats-warn">${downCount}</span> thumbs down</li>
          ${approval !== null ? `<li>approval rate: <span class="stats-num ${approval >= 70 ? 'stats-good' : approval >= 40 ? 'stats-warn' : 'stats-bad'}">${approval}%</span></li>` : '<li>no ratings yet</li>'}
        </ul>
      </section>

      <section class="stats-section">
        <h3>Build</h3>
        <ul>
          <li>Lattice v0.1.0 · <code>main</code> · Apache 2.0</li>
          <li><a href="https://github.com/10xdev4u-alt/lattice" target="_blank" rel="noopener">Source on GitHub</a></li>
        </ul>
      </section>
    </div>
  `;
}

function isWriteTool(name: string): boolean {
  return [
    'add_to_bibliography',
    'remove_from_bibliography',
    'export_bibliography',
    'peer_review_invite',
    'compose_review',
    'challenge_claim',
  ].includes(name);
}

function mostFrequent(items: string[]): string | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]![0];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
