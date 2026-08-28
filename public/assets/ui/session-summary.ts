/**
 * Session summary — a one-line rollup of the workflow trail.
 *
 * "3 searches, 2 summaries, 1 comparison, 4 writes, 0 errors,
 * 12 total". Calculated from the audit log. The user can read
 * the summary at a glance, without expanding each step.
 *
 * Closes the polish item: session summary header.
 */

import { getSession } from '../workflow-trail';

interface Summary {
  total: number;
  byTool: Record<string, number>;
  byStatus: Record<'ok' | 'err' | 'denied', number>;
  reads: number;
  writes: number;
  searchHits: number;
  compareRuns: number;
}

export function computeSessionSummary(): Summary {
  const session = getSession();
  const byTool: Record<string, number> = {};
  const byStatus: Record<'ok' | 'err' | 'denied', number> = { ok: 0, err: 0, denied: 0 };
  let reads = 0;
  let writes = 0;
  let searchHits = 0;
  let compareRuns = 0;
  for (const step of session.steps) {
    byTool[step.tool_name] = (byTool[step.tool_name] ?? 0) + 1;
    byStatus[step.status] = (byStatus[step.status] ?? 0) + 1;
    if (step.tool_name === 'search_library') searchHits++;
    if (step.tool_name === 'compare_claims') compareRuns++;
    if (step.tool_name === 'add_to_bibliography' || step.tool_name === 'remove_from_bibliography' || step.tool_name === 'export_bibliography' || step.tool_name === 'peer_review_invite' || step.tool_name === 'compose_review' || step.tool_name === 'challenge_claim') {
      writes++;
    } else {
      reads++;
    }
  }
  return { total: session.steps.length, byTool, byStatus, reads, writes, searchHits, compareRuns };
}

export function renderSessionSummary(root: HTMLElement): void {
  const s = computeSessionSummary();
  if (s.total === 0) {
    root.innerHTML = '<p class="session-summary-empty">No tool calls yet.</p>';
    return;
  }
  const errorCount = s.byStatus.err ?? 0;
  const deniedCount = s.byStatus.denied ?? 0;
  const topTools = Object.entries(s.byTool)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `<code>${escapeHtml(name)}</code>×${count}`)
    .join(' ');
  root.innerHTML = `
    <div class="session-summary">
      <span class="summary-pill summary-total">${s.total} call${s.total === 1 ? '' : 's'}</span>
      <span class="summary-pill summary-reads">${s.reads} read</span>
      <span class="summary-pill summary-writes">${s.writes} write</span>
      ${s.searchHits > 0 ? `<span class="summary-pill">${s.searchHits} search</span>` : ''}
      ${s.compareRuns > 0 ? `<span class="summary-pill">${s.compareRuns} compare</span>` : ''}
      ${errorCount > 0 ? `<span class="summary-pill summary-err">${errorCount} error</span>` : ''}
      ${deniedCount > 0 ? `<span class="summary-pill summary-denied">${deniedCount} denied</span>` : ''}
      ${topTools ? `<span class="summary-top">${topTools}</span>` : ''}
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
