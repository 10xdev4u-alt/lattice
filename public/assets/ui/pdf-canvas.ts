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
        <div class="paper-viewer-toolbar">
          <a class="paper-viewer-action" href="/api/papers/${encodeURIComponent(paper.id)}/file" target="_blank" rel="noopener">Open in new tab</a>
          <a class="paper-viewer-action" href="https://arxiv.org/abs/${encodeURIComponent(paper.arxivId ?? '')}" target="_blank" rel="noopener" ${paper.arxivId ? '' : 'hidden'}>arXiv</a>
          <button class="paper-viewer-action" data-action="related" type="button">Related</button>
          <button class="paper-viewer-action" data-action="summarize" type="button">Regenerate summary</button>
          <button class="paper-viewer-action" data-action="explain-3" type="button">Explain in 3</button>
          <button class="paper-viewer-action" data-action="ask-agent" type="button">Ask the agent</button>
        </div>
      </header>
      <section class="paper-viewer-pages" data-pdf-host></section>
    </article>
  `;
  const host = root.querySelector<HTMLElement>('[data-pdf-host]');
  if (host) {
    void mountPdfViewer(host, paperId);
  }
  root.querySelector('[data-action="ask-agent"]')?.addEventListener('click', () => {
    const input = document.querySelector<HTMLInputElement>('[data-agent-input]');
    if (input) {
      input.value = `Summarize ${paper.title}`;
      const form = input.closest('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
  root.querySelector('[data-action="related"]')?.addEventListener('click', async () => {
    const target = root.querySelector<HTMLElement>('[data-summarize-host]');
    if (target) {
      target.innerHTML = '<p class="canvas-empty">Finding related papers…</p>';
    }
    try {
      const { mountRelatedPanel } = await import('../related-papers');
      const inner = root.querySelector<HTMLElement>('[data-summarize-host]');
      if (inner) await mountRelatedPanel(inner, paper.title, paper.arxivId ?? paper.id);
    } catch (err) {
      const target2 = root.querySelector<HTMLElement>('[data-summarize-host]');
      if (target2) target2.innerHTML = `<p class="canvas-empty">Related failed: ${escapeHtml((err as Error).message)}</p>`;
    }
  });
  root.querySelector('[data-action="explain-3"]')?.addEventListener('click', async () => {
    const target = root.querySelector<HTMLElement>('[data-summarize-host]');
    if (target) {
      target.innerHTML = '<p class="canvas-empty">Asking the LLM for the 3-sentence take…</p>';
    }
    try {
      const { explainIn3Sentences } = await import('../explain-3');
      const summary = await explainIn3Sentences({
        paperId: paper.id,
        signal: new AbortController().signal,
      });
      if (target) {
        target.innerHTML = `<div class="regenerated-summary"><strong>3-sentence take:</strong> ${escapeHtml(summary)}</div>`;
      }
    } catch (err) {
      if (target) {
        target.innerHTML = `<p class="canvas-empty">Explain failed: ${escapeHtml((err as Error).message)}</p>`;
      }
    }
  });
  root.querySelector('[data-action="summarize"]')?.addEventListener('click', () => {
    void import('../llm').then(({ completePrompt }) => {
      const target = root.querySelector<HTMLElement>('[data-summarize-host]');
      if (target) {
        target.innerHTML = '<p class="canvas-empty">Regenerating…</p>';
        void completePrompt(`One-paragraph summary of "${paper.title}" for a ${paper.arxivId ? 'domain expert' : 'curious reader'}.`, { signal: new AbortController().signal, maxTokens: 200 })
          .then((summary) => {
            if (target) target.innerHTML = `<div class="regenerated-summary">${escapeHtml(summary)}</div>`;
          })
          .catch((err) => {
            if (target) target.innerHTML = `<p class="canvas-empty">Summary failed: ${escapeHtml((err as Error).message)}</p>`;
          });
      }
    });
  });
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
