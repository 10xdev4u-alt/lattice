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
import { renderSessionSummary } from './session-summary';
import { getAnchor, setAnchor, clearAnchor } from '../anchors';

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
        <button data-action="export-notion">Copy Notion import</button>
        <button data-action="share">Share</button>
        <button data-action="fork-branch">Fork branch</button>
        <button data-action="save-routine">Save as routine</button>
      </div>
    </div>
    <div data-scrubber-host></div>
    ${steps.length === 0
      ? '<p class="trail-empty">No tool calls yet. The audit log fills in as the agent acts.</p>'
      : `<ol class="trail-list" role="list">${steps.map((s) => stepRow(s)).join('')}</ol>`}
  `;

  const scrubberHost = root.querySelector<HTMLElement>('[data-scrubber-host]');
  if (scrubberHost) mountTimelineScrubber(scrubberHost);

  const summaryHost = root.querySelector<HTMLElement>('[data-summary-host]');
  if (summaryHost) renderSessionSummary(summaryHost);

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

  const shareBtn = root.querySelector<HTMLButtonElement>('[data-action="share"]');
  shareBtn?.addEventListener('click', () => {
    void import('../share').then(({ buildShareUrl }) => {
      const wantPass = window.confirm('Encrypt the share URL with a passphrase? Click OK to set one, Cancel to share plain.');
      let url: string;
      if (wantPass) {
        const pass = window.prompt('Enter a passphrase (the recipient will need this):') ?? '';
        if (!pass) return;
        url = buildShareUrl(pass);
      } else {
        url = buildShareUrl();
      }
      void navigator.clipboard?.writeText(url);
      window.prompt('Share URL (copied to clipboard):', url);
    });
  });

  const forkBtn = root.querySelector<HTMLButtonElement>('[data-action="fork-branch"]');
  forkBtn?.addEventListener('click', () => {
    void import('../branches').then(({ startFreshBranch, listBranches }) => {
      const name = window.prompt('Name the new branch:', `Branch ${listBranches().length + 1}`);
      if (!name) return;
      const branch = startFreshBranch(name);
      appendBranchRow(root, branch);
    });
  });

  const saveRoutineBtn = root.querySelector<HTMLButtonElement>('[data-action="save-routine"]');
  saveRoutineBtn?.addEventListener('click', () => {
    void import('../routines').then(({ saveRoutineFromTrail }) => {
      const name = window.prompt('Routine name:', 'My routine');
      if (!name) return;
      const description = window.prompt('Short description:', '') ?? '';
      saveRoutineFromTrail(name, description);
    });
  });

  const notionBtn = root.querySelector<HTMLButtonElement>('[data-action="export-notion"]');
  notionBtn?.addEventListener('click', () => {
    void import('../notion-export').then(({ buildNotionImport, copyNotionImport }) => {
      const md = buildNotionImport(session);
      void copyNotionImport(md);
    });
  });

  root.querySelectorAll<HTMLLIElement>('[data-step-id]').forEach((li) => {
    const toggle = li.querySelector<HTMLDivElement>('[data-step-toggle]');
    const detail = li.querySelector<HTMLDivElement>('[data-step-detail]');
    if (!toggle || !detail) return;
    toggle.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.action === 'anchor') {
        const id = Number(t.dataset.stepId);
        const label = window.prompt('Anchor label:', `Milestone ${id}`) ?? '';
        if (label) setAnchor(id, label);
        render(root);
        return;
      }
      if (t.dataset.action === 'unanchor') {
        clearAnchor(Number(t.dataset.stepId));
        render(root);
        return;
      }
      if (t.dataset.action === 'branch-from') {
        void import('../branches').then(({ forkFromStep, listBranches }) => {
          const name = window.prompt(`Branch from step #${t.dataset.stepId}:`, `Branch from #${t.dataset.stepId}`);
          if (!name) return;
          forkFromStep(Number(t.dataset.stepId), name);
          listBranches();
        });
        return;
      }
      if (t.dataset.action === 'skeptic') {
        const id = Number(t.dataset.stepId);
        const step = STEP_INDEX.get(id);
        if (!step) return;
        const claim = buildClaimFromStep(step);
        showSkepticPopover(t, claim);
        return;
      }
      const open = detail.hasAttribute('hidden');
      if (open) detail.removeAttribute('hidden');
      else detail.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
}

function stepRow(step: WorkflowStep): string {
  const argsSummary = oneLineSummary(step.args);
  const anchor = getAnchor(step.step_id);
  return `
    <li class="trail-step ${anchor ? 'trail-step-anchored' : ''}" data-step-id="${step.step_id}">
      <div class="trail-step-toggle" data-step-toggle role="button" tabindex="0" aria-expanded="false">
        <span class="trail-step-num">#${step.step_id}</span>
        <code class="trail-step-name">${escapeHtml(step.tool_name)}</code>
        <span class="trail-step-args">${escapeHtml(argsSummary)}</span>
        <span class="trail-step-status trail-step-status-${step.status}">${escapeHtml(step.status)}</span>
        <time class="trail-step-time" datetime="${escapeHtml(step.timestamp)}">${escapeHtml(formatTime(step.timestamp))}</time>
        ${step.model ? `<span class="trail-step-model" title="${escapeHtml(step.base_url ?? '')}">${escapeHtml(step.model)}</span>` : ''}
        ${anchor ? `<span class="trail-step-anchor" data-anchor-color="${anchor.color}">★ ${escapeHtml(anchor.label)}</span>` : ''}
        <button class="trail-step-anchor-btn" data-action="${anchor ? 'unanchor' : 'anchor'}" data-step-id="${step.step_id}" title="${anchor ? 'Remove anchor' : 'Mark as anchor'}">${anchor ? '★' : '☆'}</button>
      </div>
      <div class="trail-step-detail" data-step-detail hidden>
        <dl>
          <dt>Timestamp</dt><dd>${escapeHtml(step.timestamp)}</dd>
          <dt>Duration</dt><dd>${step.duration_ms}ms</dd>
          <dt>Model</dt><dd>${escapeHtml(step.model ?? 'n/a')}</dd>
          <dt>Args</dt><dd><pre>${escapeHtml(JSON.stringify(step.args, null, 2))}</pre></dd>
          <dt>Result summary</dt><dd><pre>${escapeHtml(step.result_summary.slice(0, 2000))}</pre></dd>
        </dl>
        <div class="trail-step-detail-actions">
          <button data-action="skeptic" data-step-id="${step.step_id}" title="What would the skeptic say?">Skeptic</button>
          <button data-action="branch-from" data-step-id="${step.step_id}" title="Branch the audit log from this step">Branch from here</button>
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
