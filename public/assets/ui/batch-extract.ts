/**
 * Batch extract — for each paper in the library, call the
 * extract_quote tool with a shared concept and collect the
 * results. Useful for "give me the 2 most relevant quotes about
 * X from every paper I've read."
 *
 * Renders results in a table with the paper title, quote text,
 * page, and source.
 */

import { getLibrary } from '../library';
import { getModelContext } from '../model-context-polyfill';
import { recordStep } from '../workflow-trail';

export async function mountBatchExtractOverlay(): Promise<void> {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 92vw; max-width: 880px; padding: var(--sp-4); max-height: 80vh; overflow: auto">
      <button data-action="close">Close</button>
      <h2>Batch extract quotes</h2>
      <p class="canvas-empty">Enter a concept; we'll run extract_quote on every paper in your library and surface the best result per paper.</p>
      <form data-form>
        <input data-concept placeholder="e.g. reward hacking, self-consistency, attention is all you need" required />
        <button type="submit">Run batch extract</button>
      </form>
      <div data-results></div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const form = overlay.querySelector<HTMLFormElement>('[data-form]');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = overlay.querySelector<HTMLInputElement>('[data-concept]');
    const results = overlay.querySelector<HTMLElement>('[data-results]');
    if (!input || !results) return;
    const concept = input.value.trim();
    if (!concept) return;
    const library = getLibrary();
    if (library.length === 0) {
      results.innerHTML = '<p class="canvas-empty">No papers in the library.</p>';
      return;
    }
    results.innerHTML = '<p>Running extract_quote on ' + library.length + ' paper(s)...</p>';
    const ctx = getModelContext();
    const rows: string[] = [];
    for (const p of library) {
      const start = performance.now();
      try {
        const result = await ctx.executeTool(
          { name: 'extract_quote' } as any,
          JSON.stringify({ paper_id: p.id, concept, max_quotes: 1 }),
          { signal: new AbortController().signal },
        );
        recordStep({
          tool_name: 'batch_extract',
          args: { paper_id: p.id, concept },
          result_summary: JSON.stringify(result).slice(0, 300),
          result_full: { result },
          duration_ms: Math.round(performance.now() - start),
          status: 'ok',
        });
        const txt = typeof result === 'string' ? result : JSON.stringify(result);
        rows.push(
          '<tr><td>' + escapeHtml(p.title.slice(0, 60)) + '</td><td>' + escapeHtml(txt.slice(0, 250)) + '</td></tr>',
        );
      } catch (err) {
        recordStep({
          tool_name: 'batch_extract',
          args: { paper_id: p.id, concept },
          result_summary: 'error: ' + (err as Error).message,
          result_full: { error: (err as Error).message },
          duration_ms: Math.round(performance.now() - start),
          status: 'err',
        });
      }
    }
    results.innerHTML = `
      <h3>Results for "${escapeHtml(concept)}"</h3>
      <table class="batch-extract-table">
        <thead><tr><th>Paper</th><th>Quote</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    `;
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
