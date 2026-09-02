/**
 * trail-spine — the always-visible audit spine.
 *
 * The product's thesis is "the page IS the audit log" — but the
 * log lived in a tab behind a click. The spine makes the thesis
 * literal: every tool call streams into a slim permanent column
 * between the library and the agent, newest on top. Each entry:
 * tool name, duration, status; click to expand args + summary.
 * Steps taken mid-conversation glow once as they land.
 *
 * Mounts into the workspace grid's new spine column.
 */

import { getSession } from '../workflow-trail';

interface SpineStep {
  id: number;
  tool: string;
  status: 'ok' | 'err' | 'denied';
  ms: number;
  summary: string;
  expanded: boolean;
}

let expanded = new Set<number>();

export function mountTrailSpine(root: HTMLElement): void {
  render(root);

  document.addEventListener('webmcp:toolcall', () => {
    render(root, true);
  });
  document.addEventListener('lattice:trail-changed', () => render(root));
}

function render(root: HTMLElement, glow = false): void {
  const session = getSession();
  const steps = [...session.steps].reverse().slice(0, 60).map((s, i) => ({
    id: s.step_id,
    tool: s.tool_name,
    status: (s.status === 'ok' ? 'ok' : s.status === 'denied' ? 'denied' : 'err') as SpineStep['status'],
    ms: s.duration_ms,
    summary: String(s.result_summary ?? '').slice(0, 240),
    expanded: expanded.has(s.step_id),
    fresh: glow && i === 0,
  }));

  root.innerHTML = `
    <div class="spine-head">
      <span class="spine-title">▚ AUDIT LOG</span>
      <span class="spine-count" data-spine-count>${session.steps.length}</span>
    </div>
    <ol class="spine-steps" role="list" aria-label="Workflow trail">
      ${steps.length === 0 ? `<li class="spine-empty">▚ no calls yet<br>▚ every tool lands here<br>▚ live ▮</li>` : ''}
      ${steps
        .map(
          (s) => `
        <li class="spine-step${s.fresh ? ' spine-fresh' : ''}" data-step-id="${s.id}" data-status="${s.status}">
          <button class="spine-row" type="button" aria-expanded="${s.expanded}">
            <span class="spine-t">▸</span>
            <span class="spine-tool" title="${escapeHtml(s.tool)}">${escapeHtml(s.tool)}</span>
            <span class="spine-ms">${s.ms}ms</span>
            <span class="spine-mark" aria-hidden="true"></span>
          </button>
          ${s.expanded ? `<div class="spine-detail"><code>${escapeHtml(s.summary)}</code></div>` : ''}
        </li>`,
        )
        .join('')}
    </ol>
  `;

  root.querySelectorAll<HTMLButtonElement>('.spine-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.closest('.spine-step')?.getAttribute('data-step-id'));
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      render(root);
    });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
