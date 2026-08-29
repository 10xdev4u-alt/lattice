/**
 * Stats page — a single panel summarizing feedback, library,
 * and agent activity. Used to be the "stats panel" opened via
 * 'g s'; the stats panel from PR #161 already renders a
 * minimal version. This module is the upgraded real stats page
 * with feedback aggregates and per-tool counts.
 */

import { getAllFeedback } from '../feedback';
import { getLibrary } from '../library';
import { getSession } from '../workflow-trail';
import { listRoutines } from '../routines';

export function mountStatsPageOverlay(): void {
  const library = getLibrary();
  const session = getSession();
  const feedback = getAllFeedback();
  const routines = listRoutines();

  const upCount = feedback.filter((f) => f.feedback === 'up').length;
  const downCount = feedback.filter((f) => f.feedback === 'down').length;
  const approval = upCount + downCount > 0 ? Math.round((upCount / (upCount + downCount)) * 100) : null;

  const totalDuration = session.steps.reduce((acc, s) => acc + s.duration_ms, 0);
  const errored = session.steps.filter((s) => s.status === 'err').length;
  const denied = session.steps.filter((s) => s.status === 'denied').length;
  const toolCounts: Record<string, number> = {};
  for (const s of session.steps) toolCounts[s.tool_name] = (toolCounts[s.tool_name] ?? 0) + 1;
  const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal stats-modal" role="dialog" aria-modal="true" style="width: 92vw; max-width: 720px; padding: var(--sp-4)">
      <button data-action="close">Close</button>
      <h2>Stats</h2>
      <section class="stats-section">
        <h3>Library</h3>
        <ul>
          <li><span class="stats-num">${library.length}</span> paper${library.length === 1 ? '' : 's'}</li>
          <li><span class="stats-num">${routines.length}</span> saved routine${routines.length === 1 ? '' : 's'}</li>
        </ul>
      </section>
      <section class="stats-section">
        <h3>Agent activity (this session)</h3>
        <ul>
          <li><span class="stats-num">${session.steps.length}</span> tool call${session.steps.length === 1 ? '' : 's'}</li>
          <li>total time: <span class="stats-num">${(totalDuration / 1000).toFixed(1)}s</span></li>
          ${errored > 0 ? `<li><span class="stats-num stats-warn">${errored}</span> error${errored === 1 ? '' : 's'}</li>` : ''}
          ${denied > 0 ? `<li><span class="stats-num stats-warn">${denied}</span> denied by you</li>` : ''}
        </ul>
        ${topTools.length > 0 ? `<h4>Top tools</h4><ul>${topTools.map(([t, c]) => `<li><code>${escapeHtml(t)}</code> × ${c}</li>`).join('')}</ul>` : ''}
      </section>
      <section class="stats-section">
        <h3>Feedback</h3>
        <ul>
          <li><span class="stats-num stats-good">${upCount}</span> thumbs up</li>
          <li><span class="stats-num stats-warn">${downCount}</span> thumbs down</li>
          ${approval !== null ? `<li>approval: <span class="stats-num ${approval >= 70 ? 'stats-good' : approval >= 40 ? 'stats-warn' : 'stats-bad'}">${approval}%</span></li>` : '<li>no ratings yet</li>'}
        </ul>
      </section>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
