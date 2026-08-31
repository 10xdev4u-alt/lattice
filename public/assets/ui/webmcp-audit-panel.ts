/**
 * WebMCP self-audit panel — the overlay that runs buildAuditChecks().
 *
 * Opened from the command palette ("WebMCP self-audit") or the
 * g-a keyboard sequence. One click, every check executes live
 * against this page, and the results stream in as they resolve.
 * No emoji, no decoration: a numbered checklist in the data
 * voice, the semantic colors doing the verdicts — verdigris
 * for passing, red for failing — with each row expandable to
 * the probe's note.
 */

import { buildAuditChecks, type AuditCheck } from '../webmcp-audit';

interface CheckState {
  id: string;
  label: string;
  detail: string;
  spec: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  note?: string;
}

export function mountWebmcpAuditOverlay(): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-title">
      <header class="audit-header">
        <div>
          <p class="audit-eyebrow">Compliance, verified on this page</p>
          <h2 id="audit-title">WebMCP self-audit</h2>
          <p class="audit-lede" data-audit-runtime></p>
          <p class="audit-lede">
            Every check below is a live probe against this document's modelContext, its registered
            tools, and the spec rules that govern them. Nothing is pre-baked — press run and watch.
          </p>
        </div>
        <div class="audit-actions">
          <button data-action="run" class="btn-primary" type="button">Run the checks</button>
          <button data-action="close" type="button" class="btn-ghost">Close</button>
        </div>
      </header>
      <div class="audit-summary" data-audit-summary hidden>
        <span class="audit-count" data-audit-pass></span>
        <span class="audit-count audit-count-fail" data-audit-fail></span>
      </div>
      <ol class="audit-list" data-audit-list aria-live="polite"></ol>
      <p class="audit-footnote">
        The security headers are served on every response from this origin
        (<code>${escapeHtml(window.location.origin)}</code>) — the isolation check above
        reads them live from the same server that shipped this page.
      </p>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
    if (t.dataset.action === 'run') void runAudit(overlay);
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove();
  });
  document.body.appendChild(overlay);

  // The honesty line, before any checks run: state which runtime
  // this page actually has. Verification of a shim is not
  // verification of the protocol, and the panel says so.
  void import('../model-context-polyfill').then(({ webmcpRuntime }) => {
    const el = overlay.querySelector<HTMLElement>('[data-audit-runtime]');
    if (!el) return;
    const kind = webmcpRuntime();
    if (kind === 'native') {
      el.textContent =
        'This browser ships native document.modelContext — the checks below probe the real protocol implementation.';
    } else if (kind === 'polyfill') {
      el.innerHTML =
        `<strong>This browser has no native WebMCP</strong> — Lattice's own polyfill is answering these ` +
        `probes. The checks exercise the spec's API surface faithfully (shapes, budgets, events, ` +
        `abort scoping), but they are verification of our implementation, not of a browser's. ` +
        `Open this page in Chrome 149+ with the WebMCP flag, or in the ChatGPT desktop browser, ` +
        `to audit the native runtime.`;
      el.style.borderLeft = '2px solid var(--machine)';
      el.style.paddingLeft = 'var(--sp-3)';
    } else {
      el.textContent = 'No modelContext runtime detected on this page.';
    }
  });

  overlay.querySelector<HTMLButtonElement>('[data-action="run"]')?.focus();
}

async function runAudit(overlay: HTMLElement): Promise<void> {
  const list = overlay.querySelector<HTMLOListElement>('[data-audit-list]');
  const summary = overlay.querySelector<HTMLElement>('[data-audit-summary]');
  const passEl = overlay.querySelector<HTMLElement>('[data-audit-pass]');
  const failEl = overlay.querySelector<HTMLElement>('[data-audit-fail]');
  const runBtn = overlay.querySelector<HTMLButtonElement>('[data-action="run"]');
  if (!list || !summary || !passEl || !failEl) return;
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = 'Running…';
  }

  const checks: AuditCheck[] = buildAuditChecks();
  // The header check lives here rather than in webmcp-audit.ts:
  // it reads the isolation and tools-permissions headers from a
  // fixed same-origin endpoint — the raw evidence the server
  // actually sent, the same bytes a network inspector shows.
  const headerCheck: AuditCheck = {
    id: 'served-headers',
    label: 'Isolation + tools-permission headers, read live',
    detail:
      'The server ships Origin-Agent-Cluster and the tools permissions policy on every response; without them registerTool rejects with NotAllowedError. This check reads both from this origin, live.',
    spec: 'Spec §3.4–3.5',
    run: async () => {
      try {
        const res = await fetch('/api/healthz', { method: 'HEAD' });
        const oac = res.headers.get('origin-agent-cluster');
        const pp = res.headers.get('permissions-policy') ?? '';
        const toolsPolicy = /tools\s*=\s*\(([^)]*)\)/.exec(pp)?.[1] ?? '';
        const pass = !!oac && toolsPolicy.includes('self');
        return {
          pass,
          note: `OAC ${oac ?? 'missing'}; tools ${toolsPolicy.trim() || 'missing'}`,
        };
      } catch {
        return { pass: false, note: 'Could not read the headers from this origin' };
      }
    },
  };
  const all = [...checks.slice(0, 5), headerCheck, ...checks.slice(5)];
  const states: CheckState[] = all.map((c) => ({
    id: c.id,
    label: c.label,
    detail: c.detail,
    spec: c.spec,
    status: 'pending',
  }));
  renderList(list, states);

  let pass = 0;
  let fail = 0;
  for (let i = 0; i < all.length; i++) {
    states[i]!.status = 'running';
    renderList(list, states);
    try {
      const result = await all[i]!.run();
      states[i]!.status = result.pass ? 'pass' : 'fail';
      states[i]!.note = result.note;
      if (result.pass) pass++;
      else fail++;
    } catch (err) {
      states[i]!.status = 'fail';
      states[i]!.note = `Probe threw: ${(err as Error).message.slice(0, 80)}`;
      fail++;
    }
    renderList(list, states);
  }

  summary.removeAttribute('hidden');
  passEl.textContent = `${pass} passing`;
  failEl.textContent = `${fail} failed`;
  if (runBtn) {
    runBtn.disabled = false;
    runBtn.textContent = 'Run again';
  }
}

function renderList(list: HTMLOListElement, states: CheckState[]): void {
  list.innerHTML = states
    .map(
      (s, i) => `
      <li class="audit-row audit-row-${s.status}" data-audit-id="${s.id}">
        <div class="audit-row-head">
          <span class="audit-row-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="audit-row-label">${escapeHtml(s.label)}</span>
          <span class="audit-row-spec">${escapeHtml(s.spec)}</span>
          <span class="audit-row-status">${statusWord(s.status)}</span>
        </div>
        <p class="audit-row-detail">${escapeHtml(s.detail)}</p>
        ${s.note ? `<p class="audit-row-note">${escapeHtml(s.note)}</p>` : ''}
      </li>
    `,
    )
    .join('');
}

function statusWord(status: CheckState['status']): string {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'running':
      return 'probing';
    case 'pass':
      return 'pass';
    case 'fail':
      return 'fail';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
