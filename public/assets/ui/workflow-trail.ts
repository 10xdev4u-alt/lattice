/**
 * Workflow trail UI — the killer feature.
 *
 * A vertical timeline of every tool call the agent has made in the
 * current session. Each step shows: timestamp (mono), tool name (mono),
 * one-line args, status, duration. Click to expand: full args, full
 * result, copy buttons, "Show in document" button.
 *
 * The "Save as routine" export (WebMCP #261) is a Markdown methods
 * appendix the user can attach to a paper or thesis.
 *
 * Closes #109, #94, #43 (UI half).
 */

import { getSession, toMarkdownAppendix, type WorkflowStep } from '../workflow-trail';
import { mountTimelineScrubber } from './timeline-scrubber';

export function mountWorkflowTrail(root: HTMLElement): void {
  render(root);

  document.addEventListener('lattice:trail-changed', () => render(root));
  document.addEventListener('webmcp:toolcall', () => render(root));
}

function render(root: HTMLElement): void {
  const session = getSession();
  const steps = [...session.steps].reverse(); // newest first
  root.innerHTML = `
    <div class="trail-header">
      <h2>Workflow trail</h2>
      <p class="trail-subtitle">${session.steps.length} step${session.steps.length === 1 ? '' : 's'} in this session</p>
      <div class="trail-actions">
        <button data-action="toggle-prisma">Show PRISMA flow</button>
        <button data-action="export-md">Export as methods appendix</button>
        <button data-action="export-jsonl">Export as JSONL</button>
      </div>
    </div>
    <div data-scrubber-host></div>
    ${steps.length === 0
      ? '<p class="trail-empty">No tool calls yet. The audit log fills in as the agent acts.</p>'
      : `<ol class="trail-list" role="list">${steps.map((s) => stepRow(s)).join('')}</ol>`}
  `;

  const scrubberHost = root.querySelector<HTMLElement>('[data-scrubber-host]');
  if (scrubberHost) mountTimelineScrubber(scrubberHost);

  const exportMd = root.querySelector<HTMLButtonElement>('[data-action="export-md"]');
  exportMd?.addEventListener('click', () => downloadFile(toMarkdownAppendix(session), 'lattice-methods-appendix.md', 'text/markdown'));
  const exportJsonl = root.querySelector<HTMLButtonElement>('[data-action="export-jsonl"]');
  exportJsonl?.addEventListener('click', () =>
    downloadFile(session.steps.map((s) => JSON.stringify(s)).join('\n'), 'lattice-trail.jsonl', 'application/x-ndjson'),
  );
  const prismaBtn = root.querySelector<HTMLButtonElement>('[data-action="toggle-prisma"]');
  prismaBtn?.addEventListener('click', async () => {
    const { mountPrismaDiagram } = await import('./prisma');
    const host = document.createElement('div');
    host.className = 'prisma-overlay';
    host.innerHTML = `<div class="prisma-modal" role="dialog" aria-modal="true"><button data-action="close">Close</button><div data-prisma-host></div></div>`;
    host.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.action === 'close' || t === host) host.remove();
    });
    document.body.appendChild(host);
    const inner = host.querySelector<HTMLElement>('[data-prisma-host]');
    if (inner) mountPrismaDiagram(inner);
  });

  root.querySelectorAll<HTMLLIElement>('[data-step-id]').forEach((li) => {
    const toggle = li.querySelector<HTMLDivElement>('[data-step-toggle]');
    const detail = li.querySelector<HTMLDivElement>('[data-step-detail]');
    if (!toggle || !detail) return;
    toggle.addEventListener('click', () => {
      const open = detail.hasAttribute('hidden');
      if (open) detail.removeAttribute('hidden');
      else detail.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
}

function stepRow(step: WorkflowStep): string {
  const argsSummary = oneLineSummary(step.args);
  return `
    <li class="trail-step" data-step-id="${step.step_id}">
      <div class="trail-step-toggle" data-step-toggle role="button" tabindex="0" aria-expanded="false">
        <span class="trail-step-num">#${step.step_id}</span>
        <code class="trail-step-name">${escapeHtml(step.tool_name)}</code>
        <span class="trail-step-args">${escapeHtml(argsSummary)}</span>
        <span class="trail-step-status trail-step-status-${step.status}">${escapeHtml(step.status)}</span>
        <time class="trail-step-time" datetime="${escapeHtml(step.timestamp)}">${escapeHtml(formatTime(step.timestamp))}</time>
      </div>
      <div class="trail-step-detail" data-step-detail hidden>
        <dl>
          <dt>Timestamp</dt><dd>${escapeHtml(step.timestamp)}</dd>
          <dt>Duration</dt><dd>${step.duration_ms}ms</dd>
          <dt>Args</dt><dd><pre>${escapeHtml(JSON.stringify(step.args, null, 2))}</pre></dd>
          <dt>Result summary</dt><dd><pre>${escapeHtml(step.result_summary.slice(0, 2000))}</pre></dd>
        </dl>
        <div class="trail-step-detail-actions">
          <button data-copy="${escapeHtml(JSON.stringify(step, null, 2))}">Copy full step</button>
        </div>
      </div>
    </li>
  `;
}

function oneLineSummary(args: unknown): string {
  try {
    const s = JSON.stringify(args);
    if (!s || s === '{}') return '—';
    return s.length > 80 ? s.slice(0, 77) + '…' : s;
  } catch {
    return '—';
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
