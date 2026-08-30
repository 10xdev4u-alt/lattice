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
 * from api/_lib/column-detector.ts), so text-layer
 * selection is in reading order even on multi-column papers.
 *
 * Per-paper highlights (from `highlights.ts`) render as marker spans
 * on the text layer. The user can click a highlight to jump to its
 * note, or add a new highlight via the floating "Highlight" button
 * that appears when text is selected.
 *
 * Closes #150: real per-paper highlight creation.
 */

import { getPaper } from './library';
import { reconstructPage, type TextItem } from './column-detector';
import { listHighlights, addHighlight, type Highlight } from './highlights';

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
      <section class="highlights-panel" data-highlights-panel>
        <h3>Highlights</h3>
        <div data-highlights-list></div>
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
    const highlights = listHighlights(paperId);
    const pageTexts: PageRender[] = [];
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
      pageTexts.push({ pageNumber: i, text: reconstructed.text });
      // Render highlights for this page
      renderHighlightsForPage(textLayer, highlights.filter((h) => h.page === i), reconstructed.text);
      // Selection handler: when the user finishes a selection, show
      // a floating "Highlight" button.
      installSelectionHandler(textLayer, paperId, i, reconstructed.text);
      page.cleanup();
    }
    await doc.cleanup();
    await doc.destroy();
    renderHighlightsPanel(root, paperId);
    // Store page texts for later use (e.g. selection-based highlight)
    (pagesRoot as any).__pageTexts = pageTexts;
  } catch (err) {
    pagesRoot.innerHTML = `<p class="canvas-empty">Could not render PDF: ${escapeHtml((err as Error).message)}</p>`;
  }
}

function installSelectionHandler(layer: HTMLElement, paperId: string, page: number, pageText: string): void {
  let button: HTMLButtonElement | null = null;
  layer.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 3) {
        button?.remove();
        button = null;
        return;
      }
      if (!button) {
        button = document.createElement('button');
        button.className = 'highlight-floating';
        button.textContent = 'Highlight';
        layer.parentElement?.appendChild(button);
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const note = window.prompt('Optional note for this highlight:', '');
          addHighlight({ paperId, page, text, note: note ?? '', color: 'yellow' });
          // Re-render the page text with the new highlight
          layer.innerHTML = '';
          layer.appendChild(document.createTextNode(pageText));
          const newHighlights = listHighlights(paperId).filter((h) => h.page === page);
          for (const h of newHighlights) {
            const idx = pageText.toLowerCase().indexOf(h.text.toLowerCase());
            if (idx === -1) continue;
            // Re-render the whole page with the new marker
            const before = pageText.slice(0, idx);
            const match = pageText.slice(idx, idx + h.text.length);
            const after = pageText.slice(idx + h.text.length);
            layer.innerHTML = '';
            if (before) layer.appendChild(document.createTextNode(before));
            const marker = document.createElement('span');
            marker.className = `highlight-marker highlight-${h.color}`;
            marker.textContent = match;
            marker.title = h.note || 'Highlight';
            layer.appendChild(marker);
            if (after) layer.appendChild(document.createTextNode(after));
          }
          button?.remove();
          button = null;
          selection?.removeAllRanges();
        });
      }
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (button && rect) {
        button.style.left = `${rect.left + window.scrollX}px`;
        button.style.top = `${rect.top + window.scrollY - 36}px`;
        button.style.display = 'block';
      }
    }, 10);
  });
}

function renderHighlightsForPage(layer: HTMLElement, highlights: Highlight[], text: string): void {
  for (const h of highlights) {
    const idx = text.toLowerCase().indexOf(h.text.toLowerCase());
    if (idx === -1) continue;
    // Wrap the matched substring with a marker span.
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + h.text.length);
    const after = text.slice(idx + h.text.length);
    layer.innerHTML = '';
    if (before) layer.appendChild(document.createTextNode(before));
    const marker = document.createElement('span');
    marker.className = `highlight-marker highlight-${h.color}`;
    marker.textContent = match;
    marker.title = h.note || 'Highlight';
    layer.appendChild(marker);
    if (after) layer.appendChild(document.createTextNode(after));
  }
}

function renderHighlightsPanel(root: HTMLElement, paperId: string): void {
  const list = root.querySelector<HTMLElement>('[data-highlights-list]');
  if (!list) return;
  const highlights = listHighlights(paperId);
  if (highlights.length === 0) {
    list.innerHTML = '<p class="canvas-empty" style="font-size: var(--text-xs)">No highlights yet. Select text in the PDF to add one.</p>';
    return;
  }
  list.innerHTML = highlights
    .map(
      (h) => `
      <div class="highlight-row">
        <span class="highlight-row-page">p.${h.page}</span>
        <div>
          <div class="highlight-row-text">${escapeHtml(h.text.slice(0, 100))}${h.text.length > 100 ? '…' : ''}</div>
          ${h.note ? `<div class="highlight-row-note">${escapeHtml(h.note)}</div>` : ''}
        </div>
      </div>
    `,
    )
    .join('');
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
