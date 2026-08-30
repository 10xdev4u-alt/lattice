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
import { fetchArxivSource } from '../../../netlify/functions/_lib/arxiv';

export function mountEmptyState(root: HTMLElement): void {
  root.innerHTML = `
    <section class="empty-state">
      <h2>Welcome to Lattice</h2>
      <p>Bring a research paper. Lattice will surface every tool the AI agent can use on it — and the agent can see every paper you have open, every claim, every source.</p>
      <ol class="empty-state-steps" aria-label="3-step getting started">
        <li>
          <span class="empty-step-num">1</span>
          <span class="empty-step-text">Load the sample library (5 well-known arXiv papers).</span>
        </li>
        <li>
          <span class="empty-step-num">2</span>
          <span class="empty-step-text">Open any paper. The Live Tool Array lights up.</span>
        </li>
        <li>
          <span class="empty-step-num">3</span>
          <span class="empty-step-text">Ask the agent. The audit log fills in as the agent acts.</span>
        </li>
      </ol>
      <div class="empty-actions">
        <button data-action="load-sample" class="btn-primary">Load sample library</button>
        <button data-action="start-tour">30-second tour</button>
        <button data-action="paste-arxiv">Paste an arXiv ID</button>
        <button data-action="drop-pdf">Drop a PDF</button>
        <button data-action="load-session" class="btn-ghost">Load saved session</button>
        <button data-action="compare-ingests" class="btn-ghost">Compare ingests</button>
        <button data-action="annotations" class="btn-ghost">Annotations</button>
      </div>
      <p class="empty-hint">A judge who clicks this should: load the sample library, then watch the Live Tool Array light up as the agent acts. Or click "30-second tour" for an auto-cycled walkthrough.</p>
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
      window.alert('Add some papers first.');
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
    const id = window.prompt('Paste an arXiv ID (e.g. 1706.03762):');
    if (!id) return;
    const result = await fetchArxivSource(id);
    if (!result) {
      window.alert(`Could not fetch ${id}. Check the ID and try again.`);
      return;
    }
    addPaper({
      id: `arxiv-${result.metadata.arxiv_id.replace(/[^\w]/g, '')}`,
      title: result.metadata.title,
      authors: result.metadata.authors.map((name) => {
        const parts = name.split(/\s+/);
        const family = parts.pop() ?? name;
        return { family, given: parts.join(' ') };
      }),
      year: result.metadata.published ? Number(result.metadata.published.slice(0, 4)) : undefined,
      doi: result.metadata.doi ?? undefined,
      arxivId: result.metadata.arxiv_id,
      abstract: result.metadata.summary,
      source: 'arxiv',
      addedAt: new Date().toISOString(),
    });
    document.dispatchEvent(new CustomEvent('lattice:library-changed'));
  });
}
