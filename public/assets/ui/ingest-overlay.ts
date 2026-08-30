/**
 * Ingest overlay — paste an arXiv URL or DOI and ingest a
 * single paper into the library. A focused, lightweight alternative
 * to the tour button for users who already know what they want.
 *
 * Uses the arXiv metadata fetcher and the Lattice library API.
 */

import { addPaper } from '../library';
import { fetchArxivMetadata } from '../../../netlify/functions/_lib/arxiv';

export function mountIngestOverlay(): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 420px; padding: var(--sp-4)">
      <button data-action="close">Close</button>
      <h2>Ingest one paper</h2>
      <p class="canvas-empty">Paste an arXiv ID (e.g. 1706.03762) or an arXiv abstract URL. For DOI support see the DOI-fetching PR (next).</p>
      <form data-form>
        <input data-input placeholder="arXiv ID or URL" required />
        <button type="submit">Ingest</button>
      </form>
      <p data-status></p>
    </div>
  `;
  overlay.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
    if (t.tagName === 'BUTTON' && (t as HTMLButtonElement).type === 'submit') {
      e.preventDefault();
      const input = overlay.querySelector<HTMLInputElement>('[data-input]');
      const status = overlay.querySelector<HTMLElement>('[data-status]');
      if (!input || !status) return;
      const id = input.value.trim();
      if (!id) return;
      status.textContent = 'Fetching from arXiv...';
      const meta = await fetchArxivMetadata(id);
      if (!meta) {
        status.textContent = `Could not fetch ${id}.`;
        return;
      }
      addPaper({
        id: `arxiv-${meta.arxiv_id.replace(/[^\w]/g, '')}`,
        title: meta.title,
        authors: meta.authors.map((name) => {
          const parts = name.split(/\s+/);
          const family = parts.pop() ?? name;
          return { family, given: parts.join(' ') };
        }),
        year: meta.published ? Number(meta.published.slice(0, 4)) : undefined,
        doi: meta.doi ?? undefined,
        arxivId: meta.arxiv_id,
        abstract: meta.summary,
        source: 'arxiv',
        addedAt: new Date().toISOString(),
      });
      status.textContent = `Added "${meta.title.slice(0, 60)}..."`;
      input.value = '';
      document.dispatchEvent(new CustomEvent('lattice:library-changed'));
    }
  });
  document.body.appendChild(overlay);
}
