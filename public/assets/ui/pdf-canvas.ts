/**
 * PDF canvas — the main viewer.
 *
 * Renders the paper's metadata header and delegates full PDF rendering
 * to mountPdfViewer (which uses pdf.js). The agent rail drives the
 * `lattice:paper-opened` event so opening a paper in the rail swaps
 * the canvas to that paper.
 *
 * The PDF viewer needs the source PDF at /api/papers/<id>/file. If
 * the paper is sample-only (no source uploaded), the canvas shows
 * the metadata view only.
 *
 * Closes #36, #37.
 */

import { getLibrary, getPaper, type Paper } from '../library';
import { mountPdfViewer } from '../pdf-viewer';

let currentPaperId: string | null = null;

export function mountPdfCanvas(root: HTMLElement): void {
  const library = getLibrary();
  if (library.length === 0) {
    root.innerHTML = `<p class="canvas-empty">No papers yet. Drop a PDF or load the sample library.</p>`;
    return;
  }
  const initial = currentPaperId ?? library[0]!.id;
  render(root, initial);

  document.addEventListener('lattice:paper-opened', ((e: CustomEvent) => {
    currentPaperId = e.detail.paper_id;
    render(root, currentPaperId);
  }) as EventListener);
}

function render(root: HTMLElement, paperId: string): void {
  const paper = getPaper(paperId);
  if (!paper) {
    root.innerHTML = `<p class="canvas-empty">Paper not found.</p>`;
    return;
  }
  root.innerHTML = `
    <article class="paper-viewer" data-paper-id="${escapeHtml(paper.id)}">
      <header class="paper-viewer-header">
        <h2 class="paper-viewer-title">${escapeHtml(paper.title)}</h2>
        <p class="paper-viewer-authors">${escapeHtml(formatAuthors(paper))}</p>
        <p class="paper-viewer-meta">${paper.year ?? 'n.d.'}${paper.doi ? ` · DOI ${escapeHtml(paper.doi)}` : ''}${paper.arxivId ? ` · arXiv ${escapeHtml(paper.arxivId)}` : ''}</p>
      </header>
      <section class="paper-viewer-pages" data-pdf-host></section>
    </article>
  `;
  const host = root.querySelector<HTMLElement>('[data-pdf-host]');
  if (host) {
    void mountPdfViewer(host, paperId);
  }
}

function formatAuthors(p: Paper): string {
  if (p.authors.length === 0) return 'Unknown author';
  if (p.authors.length === 1) {
    const a = p.authors[0]!;
    return `${a.given ?? ''} ${a.family}`.trim();
  }
  if (p.authors.length === 2) {
    return `${authorFull(p.authors[0]!)} and ${authorFull(p.authors[1]!)}`;
  }
  return `${authorFull(p.authors[0]!)} et al.`;
}

function authorFull(a: { family: string; given?: string }): string {
  return `${a.given ?? ''} ${a.family}`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
