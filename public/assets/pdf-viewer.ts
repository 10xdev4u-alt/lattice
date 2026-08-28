/**
 * PDF viewer — real pdf.js rendering on the canvas.
 *
 * Replaces the metadata stub. Loads the PDF from the Blobs store via
 * a signed URL, renders each page to a canvas, and lays them out
 * vertically. Click a citation chip in the chat to jump to the page.
 *
 * For the demo, the PDF source is the ingested file at
 * papers/<id>/source.pdf. The viewer reads it as a Blob and feeds it
 * to pdfjs-dist's getDocument().
 *
 * The real two-column read order is applied per page (the strategy
 * from netlify/functions/_lib/column-detector.ts), so text-layer
 * selection is in reading order even on multi-column papers.
 */

import { getPaper } from './library';
import { reconstructPage, type TextItem } from '../netlify/functions/_lib/column-detector';

interface PageRender {
  pageNumber: number;
  text: string;
}

export async function mountPdfViewer(root: HTMLElement, paperId: string): Promise<void> {
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
      <section class="paper-viewer-pages" data-pdf-pages>
        <p class="pdf-loading">Loading PDF…</p>
      </section>
    </article>
  `;

  const pagesRoot = root.querySelector<HTMLElement>('[data-pdf-pages]');
  if (!pagesRoot) return;

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({ url: `/api/papers/${paperId}/file` });
    const doc = await loadingTask.promise;
    pagesRoot.innerHTML = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = 'pdf-page-canvas';
      pagesRoot.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      // Build a text layer for selection
      const textContent = await page.getTextContent();
      const items: TextItem[] = textContent.items.map((it: any) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width,
        height: it.height,
      }));
      const reconstructed = reconstructPage(items, viewport.width, i);
      const textLayer = document.createElement('div');
      textLayer.className = 'pdf-text-layer';
      textLayer.dataset.page = String(i);
      textLayer.textContent = reconstructed.text;
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      pagesRoot.appendChild(textLayer);
      page.cleanup();
    }
    await doc.cleanup();
    await doc.destroy();
  } catch (err) {
    pagesRoot.innerHTML = `<p class="canvas-empty">Could not render PDF: ${escapeHtml((err as Error).message)}</p>`;
  }
}

function formatAuthors(p: { authors: { family: string; given?: string }[] }): string {
  if (p.authors.length === 0) return 'Unknown author';
  if (p.authors.length === 1) {
    const a = p.authors[0]!;
    return `${a.given ?? ''} ${a.family}`.trim();
  }
  if (p.authors.length === 2) {
    return `${full(p.authors[0]!)} and ${full(p.authors[1]!)}`;
  }
  return `${full(p.authors[0]!)} et al.`;
}

function full(a: { family: string; given?: string }): string {
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
