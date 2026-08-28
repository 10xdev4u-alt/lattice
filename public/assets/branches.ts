/**
 * Branch sessions — "what if the agent had cited paper Z instead?"
 *
 * At any step in the audit log, the user can branch. The branch is
 * a fresh session that starts from the same context but can take
 * different tool calls. Branches persist independently and show
 * up in the workflow trail as a tree.
 *
 * Closes the polish item: branch the audit log.
 */

import { getSession, resetSession } from './workflow-trail';
import { recordStep } from './workflow-trail';
import type { WorkflowStep } from './workflow-trail';

interface Branch {
  id: string;
  name: string;
  parentStepId: number | null;
  createdAt: string;
}

const STORAGE_KEY = 'lattice.branches.v1';

function read(): Branch[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Branch[];
  } catch {
    return [];
  }
}

function write(branches: Branch[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(branches));
}

export function listBranches(): Branch[] {
  return read();
}

export function createBranch(name: string, parentStepId: number | null = null): Branch {
  const branches = read();
  const branch: Branch = {
    id: `br_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    parentStepId,
    createdAt: new Date().toISOString(),
  };
  branches.push(branch);
  write(branches);
  document.dispatchEvent(new CustomEvent('lattice:branches-changed'));
  return branch;
}

export function forkFromStep(stepId: number, name?: string): Branch {
  const session = getSession();
  const step = session.steps.find((s) => s.step_id === stepId);
  if (!step) throw new Error(`No step ${stepId} in the current session.`);
  const branch = createBranch(name ?? `Branch from step ${stepId}`, stepId);
  // Seed the branch's workflow trail with a copy of the steps up to
  // and including the parent. The next tool call lands in the new
  // session (which the harness will create when the user resumes).
  const prefix = session.steps.filter((s) => s.step_id <= stepId);
  for (const s of prefix) {
    recordStep({ ...s, status: 'ok' });
  }
  return branch;
}

export function startFreshBranch(name: string): Branch {
  resetSession();
  return createBranch(name, null);
}
