/**
 * Open-papers toolbar — show the papers currently open in the canvas.
 *
 * The WebMCP spec lets the agent have multiple papers open at once.
 * Lattice uses this to enable the compare_claims tool. The toolbar
 * shows which papers are open as tabs, and lets the user close any
 * of them (which unregisters the per-paper tools via AbortController).
 *
 * Closes the polish item: multi-paper workflow UI.
 */

import { getModelContext } from '../model-context-polyfill';
import { getPaper } from '../library';

interface OpenPaper {
  paperId: string;
  controller: AbortController;
}

const OPEN_PAPERS = new Map<string, OpenPaper>();

export function getOpenPapers(): string[] {
  return Array.from(OPEN_PAPERS.keys());
}

export async function openPaperUI(paperId: string): Promise<void> {
  // De-dupe: if already open, just dispatch the focused event.
  if (OPEN_PAPERS.has(paperId)) {
    document.dispatchEvent(new CustomEvent('lattice:paper-focused', { detail: { paper_id: paperId } }));
    return;
  }
  const controller = new AbortController();
  OPEN_PAPERS.set(paperId, { paperId, controller });
  document.dispatchEvent(new CustomEvent('lattice:paper-opened', { detail: { paper_id: paperId } }));
}

export function closePaperUI(paperId: string): void {
  const entry = OPEN_PAPERS.get(paperId);
  if (!entry) return;
  entry.controller.abort();
  OPEN_PAPERS.delete(paperId);
  document.dispatchEvent(new CustomEvent('lattice:paper-closed', { detail: { paper_id: paperId } }));
}

export function mountOpenPapersToolbar(root: HTMLElement): void {
  render(root);

  document.addEventListener('lattice:paper-opened', () => render(root));
  document.addEventListener('lattice:paper-closed', () => render(root));
}

function render(root: HTMLElement): void {
  const ids = getOpenPapers();
  root.innerHTML = `
    <div class="open-papers">
      <div class="open-papers-label">Open papers (${ids.length}/3)</div>
      <ul class="open-papers-tabs" role="tablist">
        ${ids
          .map((id) => {
            const p = getPaper(id);
            const title = p?.title ?? id;
            return `<li class="open-papers-tab" role="tab" data-paper-id="${escapeHtml(id)}">
              <span class="open-papers-tab-title">${escapeHtml(title)}</span>
              <button data-action="close" aria-label="Close ${escapeHtml(title)}">×</button>
            </li>`;
          })
          .join('')}
      </ul>
    </div>
  `;
  root.querySelectorAll<HTMLLIElement>('[data-paper-id]').forEach((li) => {
    const id = li.dataset.paperId!;
    li.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === 'close') {
        closePaperUI(id);
      } else {
        document.dispatchEvent(new CustomEvent('lattice:paper-focused', { detail: { paper_id: id } }));
      }
    });
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
