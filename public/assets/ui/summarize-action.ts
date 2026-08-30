/**
 * Summarize action — a single button on each paper row in the
 * list. Click to call the summarize_paper tool and pop the result
 * into a small modal.
 *
 * Closes PR #209: a "summarize this paper" quick action.
 */

import { getModelContext } from '../model-context-polyfill';
import { getPaper } from '../library';
import { recordStep } from '../workflow-trail';

export function attachSummarizeButton(row: HTMLElement, paperId: string): void {
  if (row.querySelector('[data-action="summarize-quick"]')) return;
  const btn = document.createElement('button');
  btn.className = 'paper-row-summarize';
  btn.dataset.action = 'summarize-quick';
  btn.dataset.paperId = paperId;
  btn.textContent = 'Summarize';
  btn.title = 'Call the summarize_paper tool for this paper';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    btn.disabled = true;
    btn.textContent = '...';
    const paper = getPaper(paperId);
    if (!paper) {
      btn.textContent = 'No paper';
      return;
    }
    const ctx = getModelContext();
    const start = performance.now();
    try {
      const result = await ctx.executeTool(
        { name: 'summarize_paper' } as any,
        JSON.stringify({ paper_id: paperId, audience: 'grad', max_words: 150 }),
        { signal: new AbortController().signal },
      );
      recordStep({
        tool_name: 'summarize_quick',
        args: { paper_id: paperId },
        result_summary: JSON.stringify(result).slice(0, 500),
        result_full: { result },
        duration_ms: Math.round(performance.now() - start),
        status: 'ok',
      });
      const txt = typeof result === 'string' ? result : JSON.stringify(result);
      showSummaryModal(paper.title, txt);
    } catch (err) {
      recordStep({
        tool_name: 'summarize_quick',
        args: { paper_id: paperId },
        result_summary: `error: ${(err as Error).message}`,
        result_full: { error: (err as Error).message },
        duration_ms: Math.round(performance.now() - start),
        status: 'err',
      });
      btn.textContent = 'Error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Summarize';
    }
  });
  row.appendChild(btn);
}

function showSummaryModal(title: string, body: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 92vw; max-width: 720px; padding: var(--sp-4); max-height: 80vh; overflow: auto">
      <button data-action="close">Close</button>
      <h2>${escapeHtml(title)}</h2>
      <pre style="font-family: var(--font-sans); font-size: var(--text-sm); line-height: 1.6; white-space: pre-wrap; color: var(--fg);">${escapeHtml(body)}</pre>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
