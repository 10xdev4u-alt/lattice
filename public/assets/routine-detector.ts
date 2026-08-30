/**
 * Routine detector — runs each saved routine against the current
 * library (or a chosen paper) and reports which tools errored
 * or returned empty results. Helps the user identify stale
 * routines after a tool surface change.
 */

import { listRoutines, type Routine, type RoutineStep } from './routines';
import { getLibrary } from './library';
import { getModelContext } from './model-context-polyfill';
import { recordStep } from './workflow-trail';

export interface DetectionReport {
  routine: Routine;
  stepCount: number;
  ok: number;
  errored: Array<{ step: RoutineStep; message: string }>;
}

export async function detectBrokenRoutines(opts: { signal: AbortSignal; paperId?: string }): Promise<DetectionReport[]> {
  const routines = listRoutines();
  const ctx = getModelContext();
  const reports: DetectionReport[] = [];
  for (const routine of routines) {
    let ok = 0;
    const errored: Array<{ step: RoutineStep; message: string }> = [];
    for (const step of routine.steps) {
      if (opts.signal.aborted) break;
      const args: Record<string, unknown> = { ...(step.args ?? {}) };
      if (opts.paperId && step.tool === 'open_paper' || step.tool === 'summarize_paper' || step.tool === 'extract_quote') {
        args['paper_id'] = opts.paperId;
      }
      const start = performance.now();
      try {
        await ctx.executeTool(
          { name: step.tool } as any,
          JSON.stringify(args),
          { signal: opts.signal },
        );
        recordStep({
          tool_name: `routine-detect:${step.tool}`,
          args,
          result_summary: 'ok',
          result_full: {},
          duration_ms: Math.round(performance.now() - start),
          status: 'ok',
        });
        ok++;
      } catch (err) {
        const message = (err as Error).message;
        recordStep({
          tool_name: `routine-detect:${step.tool}`,
          args,
          result_summary: `error: ${message}`,
          result_full: { error: message },
          duration_ms: Math.round(performance.now() - start),
          status: 'err',
        });
        errored.push({ step, message });
      }
    }
    reports.push({ routine, stepCount: routine.steps.length, ok, errored });
  }
  return reports;
}

export function mountRoutineDetectorOverlay(): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 92vw; max-width: 880px; padding: var(--sp-4)">
      <button data-action="close">Close</button>
      <h2>Routine detector</h2>
      <p class="canvas-empty">Runs each saved routine against the current library (or a chosen paper). Reports which tools errored.</p>
      <div data-detector-controls>
        <label>Paper: <select data-paper><option value="">(use current library)</option></select></label>
        <button data-action="run">Run detector</button>
      </div>
      <div data-detector-results></div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const sel = overlay.querySelector<HTMLSelectElement>('[data-paper]');
  const library = getLibrary();
  if (sel) {
    for (const p of library) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.title} (${p.id})`;
      sel.appendChild(opt);
    }
  }
  overlay.querySelector<HTMLButtonElement>('[data-action="run"]')?.addEventListener('click', async () => {
    const controller = new AbortController();
    const out = overlay.querySelector<HTMLElement>('[data-detector-results]');
    if (out) out.innerHTML = '<p>Running...</p>';
    const paperId = sel?.value || undefined;
    const reports = await detectBrokenRoutines({ signal: controller.signal, paperId });
    if (out) {
      out.innerHTML = reports.length === 0
        ? '<p>No saved routines.</p>'
        : reports
            .map(
              (r) => `<div class="report">
              <h3>${escapeHtml(r.routine.name)} (${r.ok}/${r.stepCount} ok)</h3>
              ${r.errored.length === 0 ? '<p class="canvas-empty">All tools passed.</p>' : '<ul>' + r.errored.map((e) => `<li><code>${escapeHtml(e.step.tool)}</code>: ${escapeHtml(e.message)}</li>`).join('') + '</ul>'}
            </div>`,
            )
            .join('');
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
