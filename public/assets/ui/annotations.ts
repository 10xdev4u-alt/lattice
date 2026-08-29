/**
 * Per-paper annotations view — all highlights, tags, and notes
 * for a single paper on one page. Renders the paper's metadata
 * header and three sections: highlights, tags, notes (the scratchpad
 * sections tagged with the paper's arxiv id).
 *
 * Closes the polish item: a per-paper "annotations" view.
 */

import { getLibrary } from '../library';
import { getTagsFor } from '../tags';
import { listHighlights } from '../highlights';
import { getScratchpad } from '../scratchpad';

export function mountAnnotationsView(root: HTMLElement, paperId: string): void {
  const paper = getLibrary().find((p) => p.id === paperId);
  if (!paper) {
    root.innerHTML = `<p class="canvas-empty">Paper not in library.</p>`;
    return;
  }
  const highlights = listHighlights(paperId);
  const tags = getTagsFor(paperId);
  const scratchpad = getScratchpad();
  const notes = scratchpad
    .split('\n')
    .filter((line) => line.includes(paperId) || line.includes(paper.title))
    .slice(0, 10);

  root.innerHTML = `
    <article class="annotations">
      <header class="annotations-header">
        <h2>${escapeHtml(paper.title)}</h2>
        <p class="annotations-meta">${escapeHtml((paper.authors[0]?.family ?? 'Unknown'))}${paper.year ? ` · ${paper.year}` : ''}</p>
      </header>
      <section class="annotations-section">
        <h3>Highlights (${highlights.length})</h3>
        ${highlights.length === 0 ? '<p class="canvas-empty">No highlights yet. Select text in the PDF to add one.</p>' : `
        <ul class="annotations-list" role="list">
          ${highlights
            .map(
              (h) => `<li class="annotation-highlight" data-color="${h.color}">
                <div class="annotation-text">${escapeHtml(h.text)}</div>
                ${h.note ? `<div class="annotation-note">${escapeHtml(h.note)}</div>` : ''}
                <div class="annotation-meta">p.${h.page} · ${new Date(h.createdAt).toLocaleDateString()}</div>
              </li>`,
            )
            .join('')}
        </ul>`}
      </section>
      <section class="annotations-section">
        <h3>Tags (${tags.length})</h3>
        ${tags.length === 0 ? '<p class="canvas-empty">No tags. Add tags from the paper list row.</p>' : `
        <div class="annotations-tags">
          ${tags.map((t) => `<span class="paper-tag">${escapeHtml(t)}</span>`).join('')}
        </div>`}
      </section>
      <section class="annotations-section">
        <h3>Notes (${notes.length})</h3>
        ${notes.length === 0 ? '<p class="canvas-empty">No scratchpad lines mention this paper. Add some in the scratchpad (g n).</p>' : `
        <ul class="annotations-list" role="list">
          ${notes.map((n) => `<li class="annotation-note-row">${escapeHtml(n)}</li>`).join('')}
        </ul>`}
      </section>
    </article>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
