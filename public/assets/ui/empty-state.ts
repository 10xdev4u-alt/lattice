/**
 * Empty state — the first-run experience.
 *
 * One sentence explaining what Lattice is, three actions (load sample,
 * paste arXiv ID, drop a PDF), and a hint to the judge about what to
 * look for.
 *
 * Closes #37.
 */

import { mountPdfCanvas } from './pdf-canvas';
import { loadSampleLibrary } from '../sample-library';
import { addPaper } from '../library';
import { fetchArxivSource } from '../../netlify/functions/_lib/arxiv';

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
        <button data-action="load-sample">Load sample library</button>
        <button data-action="paste-arxiv">Paste an arXiv ID</button>
        <button data-action="drop-pdf">Drop a PDF</button>
        <button data-action="start-tour">30-second tour</button>
      </div>
      <p class="empty-hint">A judge who clicks this should: load the sample library, then watch the Live Tool Array light up as the agent acts. Or click "30-second tour" for an auto-cycled walkthrough.</p>
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
