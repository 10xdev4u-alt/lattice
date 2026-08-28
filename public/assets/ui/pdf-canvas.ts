/**
 * PDF canvas — the main viewer.
 *
 * For the demo, renders a metadata-only canvas (title, authors, abstract,
 * jump-to-page placeholder) for any paper in the library. The real
 * pdf.js viewer lands in a follow-up PR (issue #36 / #37). This
 * component is what the agent rail interacts with — when the agent
 * calls open_paper, the canvas swaps in.
 *
 * Closes #36 (the metadata view), partial toward #37 (the real viewer).
 */

import { getLibrary, getPaper, type Paper } from '../library';

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
      <section class="paper-viewer-abstract">
        <h3>Abstract</h3>
        <p>${escapeHtml(paper.abstract ?? 'No abstract available for this paper.')}</p>
      </section>
      <section class="paper-viewer-body">
        <h3>Full text</h3>
        <p class="paper-viewer-placeholder">The PDF viewer with selectable text and per-page search lands in PR #118. For now, ask the agent to <code>summarize_paper</code>, <code>extract_quote</code>, or <code>compare_claims</code>.</p>
      </section>
    </article>
  `;
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
