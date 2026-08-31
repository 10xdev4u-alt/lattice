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
import { mountResponseCards } from '../response-cards';
import { runTool } from './agent-rail';

let currentPaperId: string | null = null;

export function mountPdfCanvas(root: HTMLElement): void {
  const library = getLibrary();
  if (library.length === 0) {
    root.innerHTML = `<p class="canvas-empty">No papers yet. Drop a PDF or load the sample library.</p>`;
    // The canvas mounted while empty; when the library fills
    // (sample load, arXiv add, session restore) swap to the
    // viewer instead of leaving the empty note up forever.
    document.addEventListener('lattice:library-changed', () => {
      const now = getLibrary();
      if (now.length > 0 && !root.querySelector('.paper-viewer')) {
        render(root, now[0]!.id);
      }
    }, { once: true });
    return;
  }
  const initial = currentPaperId ?? library[0]!.id;
  render(root, initial);

  document.addEventListener('lattice:paper-opened', ((e: Event) => {
    const detail = (e as CustomEvent<{ paper_id: string }>).detail;
    currentPaperId = detail.paper_id;
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
      <div class="paper-viewer-grid">
        <div class="paper-viewer-main">
          <header class="paper-viewer-header">
            <h2 class="paper-viewer-title">${escapeHtml(paper.title)}</h2>
            <p class="paper-viewer-authors">${escapeHtml(formatAuthors(paper))}</p>
            <p class="paper-viewer-meta">${paper.year ?? 'n.d.'}${paper.doi ? ` · DOI ${escapeHtml(paper.doi)}` : ''}${paper.arxivId ? ` · arXiv ${escapeHtml(paper.arxivId)}` : ''}</p>
            <div class="paper-viewer-toolbar">
              <a class="paper-viewer-action" href="/api/papers/${encodeURIComponent(paper.id)}/file" target="_blank" rel="noopener">Open in new tab</a>
              <a class="paper-viewer-action" href="https://arxiv.org/abs/${encodeURIComponent(paper.arxivId ?? '')}" target="_blank" rel="noopener" ${paper.arxivId ? '' : 'hidden'}>arXiv</a>
            </div>
          </header>
          <div data-askbar-host></div>
          <section class="paper-viewer-pages" data-pdf-host></section>
        </div>
        <aside class="paper-viewer-margin" role="complementary" aria-label="Responses about this paper">
          <div data-cards-host></div>
        </aside>
      </div>
    </article>
  `;
  const host = root.querySelector<HTMLElement>('[data-pdf-host]');
  if (host) {
    void mountPdfViewer(host, paperId);
  }
  const cardsHost = root.querySelector<HTMLElement>('[data-cards-host]');
  if (cardsHost) mountResponseCards(cardsHost, paper.id);
  const askHost = root.querySelector<HTMLElement>('[data-askbar-host]');
  if (askHost) mountAskBar(askHost, paper.id, paper.title);
}

/**
 * Ask bar — the paper-local action surface.
 *
 * One input, verb-routed. It emits a lattice:askbar-verb event
 * and the agent rail (the owner of every WebMCP call in the app)
 * picks it up — the bar itself holds no call path. Every entry
 * docks a response card immediately via runWithCard, so the bar
 * can never appear dead, which is the ghost-host lesson: an
 * input that responds with a card always has a home for its
 * answer.
 *
 * The phrase a user types never selects a tool by name; it is
 * matched against a fixed verb list on the receiving side.
 */
function mountAskBar(host: HTMLElement, paperId: string, paperTitle: string): void {
  host.innerHTML = `
    <div class="cmdbar" role="form" aria-label="Act on this paper">
      <span class="cmdbar-prompt" aria-hidden="true">&gt;</span>
      <input
        type="text"
        data-askbar-input
        placeholder="Ask anything, or: explain in 3 — find quotes about… — cite — summarize for a lay reader"
        aria-label="Act on this paper"
        autocomplete="off"
        spellcheck="false"
      />
      <button type="button" class="cmdbar-go" data-askbar-go>Go</button>
    </div>
    <div class="cmdbar-hints" role="list">
      <button type="button" class="cmdbar-hint" data-phrase="explain in 3 sentences">explain in 3</button>
      <button type="button" class="cmdbar-hint" data-phrase="find quotes about the core method">find quotes</button>
      <button type="button" class="cmdbar-hint" data-phrase="cite this paper">cite this</button>
      <button type="button" class="cmdbar-hint" data-phrase="summarize for a lay reader">summarize</button>
      <button type="button" class="cmdbar-hint" data-phrase="related papers">related papers</button>
    </div>
    <p class="cmdbar-status" data-askbar-status aria-live="polite"></p>
  `;

  const input = host.querySelector<HTMLInputElement>('[data-askbar-input]');
  const goBtn = host.querySelector<HTMLButtonElement>('[data-askbar-go]');
  const status = host.querySelector<HTMLElement>('[data-askbar-status]');
  if (!input || !goBtn) return;

  const setStatus = (s: string): void => {
    if (status) status.textContent = s;
  };

  const act = (raw: string): void => {
    const phrase = raw.trim();
    if (!phrase) return;
    input.value = '';
    setStatus('sent');
    // The rail owns the call path; the bar owns the surface and
    // the card. Nielsen band 1: the card dock is synchronous.
    document.dispatchEvent(
      new CustomEvent('lattice:askbar-verb', {
        detail: { phrase, paperId, paperTitle },
      }),
    );
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      act(input.value);
    }
  });
  goBtn.addEventListener('click', () => act(input.value));
  host.querySelectorAll<HTMLButtonElement>('[data-phrase]').forEach((btn) => {
    btn.addEventListener('click', () => act(btn.dataset.phrase!));
  });
  input.focus({ preventScroll: true });
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
