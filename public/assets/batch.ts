/**
 * Batch apply — run a tool against every paper in the library at once.
 *
 * Useful for: summarize every paper, search every paper, extract
 * quotes for the same concept across the library, add every paper
 * to a bibliography. Iterates serially (no thundering herd), shows
 * a progress bar in a small overlay, and records every call in the
 * audit log with a 'batch:<tool>:<paper>' prefix.
 *
 * Closes the polish item: a "do this for every paper" button.
 */

import { getLibrary } from './library';
import { getModelContext } from './model-context-polyfill';
import { recordStep } from './workflow-trail';

interface BatchOptions {
  tool: 'summarize_paper' | 'extract_quote' | 'search_library' | 'add_to_bibliography';
  extraArgs: Record<string, unknown>;
  signal: AbortSignal;
  onProgress?: (done: number, total: number, last: string) => void;
}

export async function runBatch(opts: BatchOptions): Promise<{ ok: number; err: number }> {
  const library = getLibrary();
  const ctx = getModelContext();
  let ok = 0;
  let err = 0;
  for (let i = 0; i < library.length; i++) {
    if (opts.signal.aborted) break;
    const paper = library[i]!;
    const args: Record<string, unknown> = { paper_id: paper.id, ...opts.extraArgs };
    const start = performance.now();
    try {
      const result = await ctx.executeTool(
        { name: opts.tool } as any,
        JSON.stringify(args),
        { signal: opts.signal },
      );
      recordStep({
        tool_name: `batch:${opts.tool}:${paper.id}`,
        args,
        result_summary: JSON.stringify(result).slice(0, 500),
        result_full: result,
        duration_ms: Math.round(performance.now() - start),
        status: 'ok',
      });
      ok++;
    } catch (e) {
      recordStep({
        tool_name: `batch:${opts.tool}:${paper.id}`,
        args,
        result_summary: `error: ${(e as Error).message}`,
        result_full: { error: (e as Error).message },
        duration_ms: Math.round(performance.now() - start),
        status: 'err',
      });
      err++;
    }
    opts.onProgress?.(i + 1, library.length, paper.title);
  }
  return { ok, err };
}

export function mountBatchOverlay(): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal batch-modal" role="dialog" aria-modal="true">
      <button data-action="close">Close</button>
      <h2>Apply tool to every paper</h2>
      <label>Tool
        <select data-batch-tool>
          <option value="summarize_paper">Summarize (audience: grad)</option>
          <option value="extract_quote">Extract quote (concept: self-attention)</option>
          <option value="search_library">Search (query: attention)</option>
          <option value="add_to_bibliography">Add to bibliography</option>
        </select>
      </label>
      <button data-action="start">Start</button>
      <div class="batch-progress" data-batch-progress></div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const startBtn = overlay.querySelector<HTMLButtonElement>('[data-action="start"]');
  const progress = overlay.querySelector<HTMLElement>('[data-batch-progress]');
  if (!startBtn || !progress) return;
  startBtn.addEventListener('click', async () => {
    const tool = overlay.querySelector<HTMLSelectElement>('[data-batch-tool]')!.value as
      | 'summarize_paper'
      | 'extract_quote'
      | 'search_library'
      | 'add_to_bibliography';
    const extraArgs: Record<string, unknown> = {};
    if (tool === 'summarize_paper') extraArgs['audience'] = 'grad';
    if (tool === 'extract_quote') extraArgs['concept'] = 'self-attention';
    if (tool === 'search_library') extraArgs['query'] = 'attention';
    startBtn.disabled = true;
    progress.textContent = 'Running…';
    const result = await runBatch({
      tool,
      extraArgs,
      signal: new AbortController().signal,
      onProgress: (done, total, last) => {
        progress.innerHTML = `<p>${done} of ${total} — <code>${escapeHtml(last)}</code></p>`;
      },
    });
    progress.innerHTML = `<p>Done: ${result.ok} ok, ${result.err} errors.</p>`;
    startBtn.disabled = false;
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
