/**
 * Routines — saved workflows the user can replay.
 *
 * A routine is a named sequence of tool calls (with their args)
 * extracted from a past audit log. The user can save the current
 * session's steps as a routine, then replay it against any new
 * paper (the user is prompted for variable inputs).
 *
 * Closes WebMCP #261 (preserve completed tasks as reviewable
 * workflow documents) and the polish item for routines.
 *
 * Routines persist to localStorage and export as Markdown
 * playbooks the user can read or share.
 */

import { getSession, type WorkflowStep } from './workflow-trail';

export interface RoutineStep {
  tool: string;
  args: unknown;
  inputName?: string;
  inputDefault?: unknown;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  steps: RoutineStep[];
  createdAt: string;
  parentSessionId: string;
}

const STORAGE_KEY = 'lattice.routines.v1';

function read(): Routine[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Routine[];
  } catch {
    return [];
  }
}

function write(routines: Routine[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
  document.dispatchEvent(new CustomEvent('lattice:routines-changed'));
}

export function listRoutines(): Routine[] {
  return read();
}

export function saveRoutineFromTrail(name: string, description: string): Routine {
  const session = getSession();
  const steps: RoutineStep[] = session.steps
    .filter((s) => s.status === 'ok')
    .map((s) => ({
      tool: s.tool_name,
      args: s.args,
      inputName: extractInputName(s.tool_name, s.args),
      inputDefault: s.args,
    }));
  const routine: Routine = {
    id: `rt_${Date.now().toString(36)}`,
    name,
    description,
    steps,
    createdAt: new Date().toISOString(),
    parentSessionId: session.session_id,
  };
  const all = read();
  all.push(routine);
  write(all);
  return routine;
}

function extractInputName(tool: string, args: unknown): string | undefined {
  const a = (args ?? {}) as Record<string, unknown>;
  if (tool === 'search_library' && typeof a.query === 'string') return 'query';
  if (tool === 'summarize_paper' && typeof a.paper_id === 'string') return 'paper_id';
  if (tool === 'compare_claims' && typeof a.topic === 'string') return 'topic';
  if (tool === 'compose_review' && typeof a.paper_id === 'string') return 'paper_id';
  return undefined;
}

export function toMarkdown(routine: Routine): string {
  const lines: string[] = [
    `# ${routine.name}`,
    '',
    routine.description,
    '',
    `Created ${new Date(routine.createdAt).toISOString()} from session \`${routine.parentSessionId}\`.`,
    '',
    '## Steps',
    '',
    ...routine.steps.map((s, i) => {
      const argStr = JSON.stringify(s.args, null, 2)
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
      const inputNote = s.inputName
        ? `  - **Input:** \`${s.inputName}\`\n`
        : '';
      return `${i + 1}. **${s.tool}**\n${inputNote}\n\`\`\`json\n${argStr}\n\`\`\``;
    }),
  ];
  return lines.join('\n');
}

export function exportRoutineMarkdown(routine: Routine): void {
  const md = toMarkdown(routine);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lattice-routine-${routine.id}.md`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface RoutineExecution {
  step: number;
  tool: string;
  status: 'pending' | 'ok' | 'err' | 'denied';
  durationMs: number;
  result?: unknown;
  error?: string;
}

export function mountRoutinesPanel(root: HTMLElement): void {
  render(root);
  document.addEventListener('lattice:routines-changed', () => render(root));
}

function render(root: HTMLElement): void {
  const routines = read();
  root.innerHTML = `
    <section class="routines-panel">
      <h2>Routines</h2>
      <p class="routines-subtitle">Saved workflows. Click 'Save current' to capture the current session as a routine. Click 'Export' to download as Markdown.</p>
      <button class="routines-save" data-action="save">Save current session as routine</button>
      <ul class="routines-list" role="list">
        ${routines
          .map(
            (r) => `<li class="routines-row" data-routine-id="${r.id}">
              <div>
                <div class="routines-name">${escapeHtml(r.name)}</div>
                <div class="routines-desc">${escapeHtml(r.description)}</div>
                <div class="routines-meta">${r.steps.length} step${r.steps.length === 1 ? '' : 's'} · ${new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div class="routines-actions">
                <button data-routine-action="export" data-routine-id="${r.id}">Export</button>
                <button data-routine-action="delete" data-routine-id="${r.id}">Delete</button>
              </div>
            </li>`,
          )
          .join('')}
      </ul>
    </section>
  `;
  root.querySelector('[data-action="save"]')?.addEventListener('click', () => {
    const name = window.prompt('Name the routine:', `Routine ${routines.length + 1}`);
    if (!name) return;
    const description = window.prompt('Short description:', '') ?? '';
    saveRoutineFromTrail(name, description);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-routine-action="export"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = routines.find((x) => x.id === btn.dataset.routineId);
      if (r) exportRoutineMarkdown(r);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-routine-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = routines.filter((x) => x.id !== btn.dataset.routineId);
      write(next);
    });
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
