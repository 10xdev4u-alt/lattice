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

import { getSession, recordStep, toMarkdownAppendix, type WorkflowStep } from '../workflow-trail';
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
  // The step lookup the row actions use (re-run, skeptic,
  // inspect): rebuilt on every render so it always reflects the
  // steps actually shown.
  STEP_INDEX.clear();
  for (const s of session.steps) {
    STEP_INDEX.set(s.step_id, { tool_name: s.tool_name, result_summary: s.result_summary, args: s.args });
  }
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
    void (async () => {
      const { buildShareUrlAsync } = await import('../share');
      const { askConfirm, askText, notice } = await import('./overlays');
      const wantPass = await askConfirm(
        'Encrypt the share URL?',
        'A passphrase-protected link can only be opened by someone you give the passphrase to.',
        'Set a passphrase',
      );
      let url: string;
      if (wantPass) {
        const choice = await askText('Passphrase', 'The recipient will need this to open the shared session.', {
          placeholder: 'passphrase',
        });
        if (!choice.ok || !choice.value) return;
        url = await buildShareUrlAsync(choice.value);
      } else {
        url = await buildShareUrlAsync();
      }
      void navigator.clipboard?.writeText(url).catch(() => undefined);
      await notice('Share URL copied', url);
    })();
  });

  const forkBtn = root.querySelector<HTMLButtonElement>('[data-action="fork-branch"]');
  forkBtn?.addEventListener('click', () => {
    void (async () => {
      const { startFreshBranch, listBranches } = await import('../branches');
      const { askText } = await import('./overlays');
      const choice = await askText('Name the new branch', 'Branches record tool calls separately so you can try a different path.', {
        initial: `Branch ${listBranches().length + 1}`,
      });
      if (!choice.ok || !choice.value) return;
      const branch = startFreshBranch(choice.value);
      appendBranchRow(root, branch);
    })();
  });

  const saveRoutineBtn = root.querySelector<HTMLButtonElement>('[data-action="save-routine"]');
  saveRoutineBtn?.addEventListener('click', () => {
    void (async () => {
      const { saveRoutineFromTrail } = await import('../routines');
      const { askText } = await import('./overlays');
      const nameChoice = await askText('Save this workflow as a routine', 'Routines replay the recorded tool calls against any new paper.', {
        initial: 'My routine',
      });
      if (!nameChoice.ok || !nameChoice.value) return;
      const desc = await askText('Short description', 'What this routine does, in one line.', {
        placeholder: 'e.g. summarize + extract quotes',
      });
      saveRoutineFromTrail(nameChoice.value, desc.ok ? (desc.value ?? '') : '');
    })();
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
    // The action buttons (anchor, rerun, skeptic, branch, inspect)
    // live in the DETAIL panel — a sibling of the toggle — so the
    // action dispatch must listen on the row, not the toggle, or
    // those clicks never reach a handler.
    const handleAction = (e: Event): void => {
      const t = e.target as HTMLElement;
      if (t.dataset.action === 'anchor') {
        const id = Number(t.dataset.stepId);
        void (async () => {
          const { askText } = await import('./overlays');
          const choice = await askText('Anchor label', 'Mark this step as a milestone in the audit trail.', {
            initial: `Milestone ${id}`,
          });
          if (choice.ok && choice.value) setAnchor(id, choice.value);
          render(root);
        })();
        return;
      }
      if (t.dataset.action === 'unanchor') {
        clearAnchor(Number(t.dataset.stepId));
        render(root);
        return;
      }
      if (t.dataset.action === 'branch-from') {
        void (async () => {
          const { forkFromStep, listBranches } = await import('../branches');
          const { askText } = await import('./overlays');
          const choice = await askText(
            `Branch from step #${t.dataset.stepId}`,
            'The audit trail forks here; new tool calls record on the branch.',
            { initial: `Branch from #${t.dataset.stepId}` },
          );
          if (!choice.ok || !choice.value) return;
          forkFromStep(Number(t.dataset.stepId), choice.value);
          listBranches();
        })();
        return;
      }
      if (t.dataset.action === 'rerun') {
        const id = Number(t.dataset.stepId);
        const step = STEP_INDEX.get(id);
        if (!step) return;
        void rerunStep(step);
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
      if (t.dataset.action === 'inspect') {
        const id = Number(t.dataset.stepId);
        const step = STEP_INDEX.get(id);
        if (!step) return;
        void import('./tool-inspector').then(({ mountToolInspectorOverlay }) => {
          mountToolInspectorOverlay(step as any);
        });
        return;
      }
      if (t.closest('[data-step-detail]')) {
        // A click inside the open detail that wasn't an action
        // button (the copy row) shouldn't collapse the panel.
        return;
      }
      const open = detail.hasAttribute('hidden');
      if (open) detail.removeAttribute('hidden');
      else detail.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    li.addEventListener('click', handleAction);
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const open = detail.hasAttribute('hidden');
        if (open) detail.removeAttribute('hidden');
        else detail.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
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
        ${anchor ? `<span class="trail-step-anchor" data-anchor-color="${anchor.color}">anchored: ${escapeHtml(anchor.label)}</span>` : ''}
        <button class="trail-step-anchor-btn" data-action="${anchor ? 'unanchor' : 'anchor'}" data-step-id="${step.step_id}" title="${anchor ? 'Remove anchor' : 'Mark as anchor'}">${anchor ? 'unanchor' : 'anchor'}</button>
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
          <button data-action="rerun" data-step-id="${step.step_id}" title="Run this tool again with the same arguments">Re-run</button>
          <button data-action="skeptic" data-step-id="${step.step_id}" title="What would the skeptic say?">Skeptic</button>
          <button data-action="branch-from" data-step-id="${step.step_id}" title="Branch the audit log from this step">Branch from here</button>
          <button data-action="inspect" data-step-id="${step.step_id}" title="See the full request and response JSON">Inspect</button>
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

function appendBranchRow(host: HTMLElement, branch: { id: string; name: string; createdAt: string }): void {
  const list = host.querySelector<HTMLElement>('[data-branch-list]') ?? host;
  const row = document.createElement('div');
  row.className = 'branch-row';
  row.innerHTML = `
    <span>${escapeHtml(branch.name)}</span>
    <time>${escapeHtml(new Date(branch.createdAt).toLocaleTimeString())}</time>
    <button data-action="view">View</button>
  `;
  list.appendChild(row);
  row.querySelector('[data-action="view"]')?.addEventListener('click', () => {
    void import('./overlays').then(({ toast }) =>
      toast(`Branch "${branch.name}" active — new tool calls record on it`),
    );
  });
}

const STEP_INDEX = new Map<number, { tool_name: string; result_summary: string; args: unknown }>();

/**
 * Re-run a recorded step: the same tool, the same arguments, a
 * fresh execution — appended to the trail as a new entry. This
 * is the honest form of replay: same input, new result, and the
 * audit log grows rather than being rewritten.
 */
async function rerunStep(step: {
  tool_name: string;
  result_summary: string;
  args: unknown;
}): Promise<void> {
  const ctx = (
    document as unknown as {
      modelContext?: { executeTool?: (t: { name: string }, a: string, o?: { signal?: AbortSignal }) => Promise<unknown> };
    }
  ).modelContext;
  if (!ctx?.executeTool) return;
  const start = performance.now();
  try {
    const result = await ctx.executeTool(
      { name: step.tool_name },
      JSON.stringify(step.args ?? {}),
      { signal: new AbortController().signal },
    );
    const summary =
      typeof result === 'string' ? result : JSON.stringify(result).slice(0, 500);
    recordStep({
      tool_name: step.tool_name,
      args: step.args,
      result_summary: `re-run: ${summary.slice(0, 490)}`,
      result_full: result,
      duration_ms: Math.round(performance.now() - start),
      status: 'ok',
    });
  } catch (err) {
    recordStep({
      tool_name: step.tool_name,
      args: step.args,
      result_summary: `re-run failed: ${(err as Error).message.slice(0, 400)}`,
      result_full: { error: (err as Error).message },
      duration_ms: Math.round(performance.now() - start),
      status: 'err',
    });
  }
  render(rootOfTrail());
}

/** The trail's own mount root — the panel it renders into. */
function rootOfTrail(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-workflow-trail]') ?? document.body;
}

function buildClaimFromStep(step: { tool_name: string; result_summary: string; args: unknown }): string {
  const args = (step.args ?? {}) as Record<string, unknown>;
  if (typeof args.query === 'string') return `Search for "${args.query}" returned ${step.result_summary.slice(0, 200)}`;
  if (typeof args.claim === 'string') return `The user claims: "${args.claim}"`;
  if (typeof args.paper_id === 'string') return `${step.tool_name} on ${args.paper_id}: ${step.result_summary.slice(0, 200)}`;
  return `${step.tool_name}: ${step.result_summary.slice(0, 200)}`;
}

function showSkepticPopover(target: HTMLElement, claim: string): void {
  document.querySelectorAll('.skeptic-popover').forEach((el) => el.remove());
  const pop = document.createElement('div');
  pop.className = 'skeptic-popover';
  pop.setAttribute('role', 'status');
  pop.setAttribute('aria-live', 'polite');
  pop.textContent = 'Skeptic: thinking…';
  document.body.appendChild(pop);
  const rect = target.getBoundingClientRect();
  pop.style.position = 'absolute';
  pop.style.left = `${rect.left + window.scrollX}px`;
  pop.style.top = `${rect.bottom + window.scrollY + 4}px`;
  pop.style.zIndex = '100';
  pop.style.maxWidth = '420px';
  void import('../ui/peer-reviewer').then(async ({ challengeClaim }) => {
    try {
      const challenge = await challengeClaim(claim);
      pop.textContent = `Skeptic: ${challenge}`;
    } catch (err) {
      pop.textContent = `Skeptic: unavailable (${(err as Error).message})`;
    }
  });
  setTimeout(() => pop.remove(), 8000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
