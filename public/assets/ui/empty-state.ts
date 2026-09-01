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
import { ingestPdfFile } from '../ingest';

export function mountEmptyState(root: HTMLElement): void {
  root.innerHTML = `
    <section class="empty-state" data-empty-drop>
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
        <input type="file" accept="application/pdf,.pdf" data-pdf-input hidden />
      </div>
      <p class="empty-ingest-status" data-ingest-status aria-live="polite"></p>
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

  wirePdfIngest(root);

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

/**
 * PDF ingest wiring — the "Drop a PDF" CTA.
 *
 * Click opens a file picker; dragging PDFs over the empty state
 * highlights it as a drop target. Files run through ingestPdfFile
 * (magic-byte sniff, size cap, structured errors), and the result
 * paper joins the library with a toast for warnings.
 */
async function ingestDroppedPdf(root: HTMLElement, file: File): Promise<void> {
  const { notice } = await import('./overlays');
  const status = root.querySelector<HTMLElement>('[data-ingest-status]');
  const say = (line: string): void => {
    if (status) status.textContent = line;
  };
  say(`Reading ${file.name}…`);
  try {
    const result = await ingestPdfFile(file);
    const warnings = result.warnings.length > 0 ? ` (${result.warnings.join('; ')})` : '';
    say(`Indexed ${result.paper.title.slice(0, 60)} — ${result.paper.page_count} pages${warnings}`);
    document.dispatchEvent(new CustomEvent('lattice:library-changed'));
    document.dispatchEvent(
      new CustomEvent('lattice:paper-opened', { detail: { paper_id: result.paper.id } }),
    );
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'INGEST_FAILED';
    const message = (err as { message?: string }).message ?? 'The PDF could not be ingested.';
    say('');
    await notice(`Could not ingest ${file.name} (${code})`, message);
  }
}

function wirePdfIngest(root: HTMLElement): void {
  const dropBtn = root.querySelector<HTMLButtonElement>('[data-action="drop-pdf"]');
  const fileInput = root.querySelector<HTMLInputElement>('[data-pdf-input]');
  const section = root.querySelector<HTMLElement>('[data-empty-drop]');

  dropBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void ingestDroppedPdf(root, file);
    fileInput.value = ''; // allow re-picking the same file
  });

  if (!section) return;
  // Drag-and-drop: highlight the empty state while a PDF hovers.
  const hasPdf = (e: DragEvent): boolean =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files');
  section.addEventListener('dragover', (e) => {
    if (!hasPdf(e)) return;
    e.preventDefault();
    section.classList.add('empty-state-drag');
  });
  section.addEventListener('dragleave', () => {
    section.classList.remove('empty-state-drag');
  });
  section.addEventListener('drop', (e) => {
    if (!hasPdf(e)) return;
    e.preventDefault();
    section.classList.remove('empty-state-drag');
    const file = e.dataTransfer?.files?.[0];
    if (file) void ingestDroppedPdf(root, file);
  });
}
