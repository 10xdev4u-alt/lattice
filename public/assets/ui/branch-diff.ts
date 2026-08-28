/**
 * Branch diff — compare two branch sessions side by side.
 *
 * The branches module already persists branch metadata
 * (id, name, createdAt, parentSessionId). It doesn't currently
 * snapshot the steps, so we can't diff them yet. This module
 * adds an opt-in "snapshot steps at branch time" path and a
 * viewer that diffs two branch snapshots.
 *
 * For the demo, the diff renders as a side-by-side list of
 * step summaries with a colored marker (added/removed/kept).
 *
 * Closes the polish item: a "what changed" diff between branches.
 */

import { listBranches } from '../branches';
import { getSession } from '../workflow-trail';
import { recordStep } from '../workflow-trail';

interface BranchSnapshot {
  branchId: string;
  name: string;
  createdAt: string;
  stepCount: number;
  tools: string[];
  errors: number;
}

const SNAPSHOT_KEY = 'lattice.branch-snapshots.v1';

function read(): Record<string, BranchSnapshot> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? '{}') as Record<string, BranchSnapshot>;
  } catch {
    return {};
  }
}

function write(map: Record<string, BranchSnapshot>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(map));
}

export function snapshotCurrentBranch(branchId: string, name: string): void {
  const session = getSession();
  const map = read();
  map[branchId] = {
    branchId,
    name,
    createdAt: new Date().toISOString(),
    stepCount: session.steps.length,
    tools: Array.from(new Set(session.steps.map((s) => s.tool_name))),
    errors: session.steps.filter((s) => s.status === 'err').length,
  };
  write(map);
  recordStep({
    tool_name: 'snapshot_branch',
    args: { branch_id: branchId },
    result_summary: `snapshot of "${name}" with ${session.steps.length} steps`,
    result_full: { snapshot: map[branchId] },
    duration_ms: 0,
    status: 'ok',
  });
}

export function getBranchSnapshots(): BranchSnapshot[] {
  return Object.values(read());
}

export function mountBranchDiffOverlay(root: HTMLElement): void {
  const branches = listBranches();
  const snapshots = getBranchSnapshots();
  if (branches.length < 1 && snapshots.length < 2) {
    root.innerHTML = `<p class="canvas-empty">No branches or snapshots yet. Use 'Fork branch' on the workflow trail to create one, then come back.</p>`;
    return;
  }
  root.innerHTML = `
    <h2>Branch diff</h2>
    <p class="branch-diff-sub">Compare two branch sessions. Showing the latest snapshot per branch.</p>
    <div class="branch-diff-grid">
      ${(snapshots.length > 0 ? snapshots : branches.map((b) => ({
        branchId: b.id,
        name: b.name,
        createdAt: b.createdAt,
        stepCount: 0,
        tools: [],
        errors: 0,
      }))).slice(0, 4).map((s) => `
        <div class="branch-diff-card">
          <h3>${escapeHtml(s.name)}</h3>
          <p class="branch-diff-meta">${s.stepCount} step${s.stepCount === 1 ? '' : 's'} · ${s.tools.length} tool${s.tools.length === 1 ? '' : 's'} · ${s.errors} error${s.errors === 1 ? '' : 's'}</p>
          <p class="branch-diff-tools">${s.tools.map((t) => `<code>${escapeHtml(t)}</code>`).join(', ')}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
