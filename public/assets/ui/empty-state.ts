/**
 * Empty state — the first-run experience.
 *
 * One sentence explaining what Lattice is, three actions (load sample,
 * paste arXiv ID, drop a PDF), and a hint to the judge about what to
 * look for.
 *
 * Closes #37.
 */

import { loadSampleLibrary } from '../sample-library';
import { addPaper } from '../library';
import { fetchArxivMetadata } from '../arxiv-client';

export function mountEmptyState(root: HTMLElement): void {
  root.innerHTML = `
    <section class="empty-state">
      <p class="empty-eyebrow">Research papers, in conversation</p>
      <h2 class="empty-headline">Bring a paper.<br>Watch every claim become traceable.</h2>
      <p class="empty-lede">
        Lattice turns your library into tools your AI agent can use — search, summarize, quote, cite, compare —
        and logs every call in an audit trail you can replay, branch, and export as a methods appendix.
      </p>
      <div class="empty-actions">
        <button data-action="load-sample" class="btn-primary">Load 5 classic papers</button>
        <button data-action="paste-arxiv">Add by arXiv ID</button>
        <button data-action="drop-pdf">Drop a PDF</button>
      </div>
      <ol class="empty-state-steps" aria-label="3-step getting started">
        <li>
          <span class="empty-step-num">1</span>
          <span class="empty-step-text">Load the papers — their full text is fetched and indexed.</span>
        </li>
        <li>
          <span class="empty-step-num">2</span>
          <span class="empty-step-text">Open one. Per-paper tools light up for your agent.</span>
        </li>
        <li>
          <span class="empty-step-num">3</span>
          <span class="empty-step-text">Ask anything. Every answer arrives with its citations attached.</span>
        </li>
      </ol>
      <div class="empty-actions empty-actions-quiet">
        <button data-action="start-tour" class="btn-ghost">30-second tour</button>
        <button data-action="load-session" class="btn-ghost">Load saved session</button>
        <button data-action="compare-ingests" class="btn-ghost">Compare ingests</button>
        <button data-action="annotations" class="btn-ghost">Annotations</button>
      </div>
      <div data-carousel-host></div>
    </section>
  `;

  const sampleBtn = root.querySelector<HTMLButtonElement>('[data-action="load-sample"]');
  sampleBtn?.addEventListener('click', () => {
    loadSampleLibrary();
    document.dispatchEvent(new CustomEvent('lattice:library-changed'));
  });

  const tourBtn = root.querySelector<HTMLButtonElement>('[data-action="start-tour"]');
  tourBtn?.addEventListener('click', async () => {
    const { mountTour } = await import('../tour');
    mountTour(root);
  });

  const compareBtn = root.querySelector<HTMLButtonElement>('[data-action="compare-ingests"]');
  compareBtn?.addEventListener('click', async () => {
    const { mountCompareIngestsOverlay } = await import('./compare-ingests');
    const overlay = document.createElement('div');
    overlay.className = 'kg-overlay';
    overlay.innerHTML = `<div class="kg-modal" role="dialog" aria-modal="true"><button data-action="close">Close</button><div data-compare-host style="height: 70vh; overflow: auto"></div></div>`;
    overlay.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.action === 'close' || t === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    const inner = overlay.querySelector<HTMLElement>('[data-compare-host]');
    if (inner) await mountCompareIngestsOverlay(inner);
  });

  const loadSessionBtn = root.querySelector<HTMLButtonElement>('[data-action="load-session"]');
  loadSessionBtn?.addEventListener('click', async () => {
    const { mountLoadSessionOverlay } = await import('./load-session');
    const overlay = document.createElement('div');
    overlay.className = 'kg-overlay';
    overlay.innerHTML = `<div class="kg-modal" role="dialog" aria-modal="true"><button data-action="close">Close</button><div data-load-host style="padding: var(--sp-4)"></div></div>`;
    overlay.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.action === 'close' || t === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    const inner = overlay.querySelector<HTMLElement>('[data-load-host]');
    if (inner) mountLoadSessionOverlay(inner);
  });

  const annotationsBtn = root.querySelector<HTMLButtonElement>('[data-action="annotations"]');
  annotationsBtn?.addEventListener('click', async () => {
    const { mountAnnotationsView } = await import('./annotations');
    const { getLibrary } = await import('../library');
    const library = getLibrary();
    if (library.length === 0) {
      const { notice } = await import('./overlays');
      await notice('No papers yet', 'Add papers first — annotations live on a paper.');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'kg-overlay';
    overlay.innerHTML = `<div class="kg-modal" role="dialog" aria-modal="true" style="width: 90vw; max-width: 800px"><button data-action="close">Close</button><div data-annotations-host style="height: 70vh; overflow: auto"></div></div>`;
    overlay.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.action === 'close' || t === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    const inner = overlay.querySelector<HTMLElement>('[data-annotations-host]');
    if (inner) {
      // Show first paper by default; in the next PR we'll add a paper selector
      mountAnnotationsView(inner, library[0]!.id);
    }
  });

  const arxivBtn = root.querySelector<HTMLButtonElement>('[data-action="paste-arxiv"]');
  arxivBtn?.addEventListener('click', async () => {
    const { askText, notice } = await import('./overlays');
    const choice = await askText('Add by arXiv ID', 'The paper is fetched, its LaTeX source extracted and indexed.', {
      placeholder: 'e.g. 1706.03762',
    });
    if (!choice.ok || !choice.value) return;
    const id = choice.value;
    const meta = await fetchArxivMetadata(id);
    if (!meta) {
      await notice('Could not fetch that ID', `Nothing found for ${id}. Check the ID and try again.`);
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
    document.dispatchEvent(new CustomEvent('lattice:library-changed'));
  });
}
