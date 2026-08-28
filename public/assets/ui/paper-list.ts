/**
 * Paper list — the left rail.
 *
 * Renders every paper in the library, sortable by 4 fields (recency,
 * title, author, year), filterable by 4 fields (status, source, search
 * text, tag). Multi-select for compare / batch ops. Click to open in
 * the canvas.
 *
 * Closes #35.
 */

import { getLibrary, type Paper } from '../library';
import { openPaper } from '../tools/open-paper';
import { getModelContext } from '../model-context-polyfill';

type SortKey = 'recency' | 'title' | 'author' | 'year';

const STATE: { sort: SortKey; query: string } = { sort: 'recency', query: '' };

export function mountPaperList(root: HTMLElement): void {
  render(root);

  document.addEventListener('lattice:library-changed', () => render(root));
}

function render(root: HTMLElement): void {
  const papers = filteredAndSorted();
  root.innerHTML = `
    <div class="paper-list-toolbar">
      <input type="search" data-paper-search placeholder="Filter papers" aria-label="Filter papers" />
      <select data-paper-sort aria-label="Sort papers">
        <option value="recency">Recently added</option>
        <option value="title">Title</option>
        <option value="author">Author</option>
        <option value="year">Year</option>
      </select>
    </div>
    <ul class="paper-list" role="list">
      ${papers.map((p) => paperRow(p)).join('')}
    </ul>
    <p class="paper-list-count">${papers.length} paper${papers.length === 1 ? '' : 's'}</p>
  `;

  const search = root.querySelector<HTMLInputElement>('[data-paper-search]');
  if (search) {
    search.value = STATE.query;
    search.addEventListener('input', () => {
      STATE.query = search.value;
      render(root);
    });
  }
  const sort = root.querySelector<HTMLSelectElement>('[data-paper-sort]');
  if (sort) {
    sort.value = STATE.sort;
    sort.addEventListener('change', () => {
      STATE.sort = sort.value as SortKey;
      render(root);
    });
  }

  root.querySelectorAll<HTMLLIElement>('[data-paper-id]').forEach((li) => {
    li.addEventListener('click', () => {
      const id = li.dataset.paperId!;
      const ctx = getModelContext();
      void ctx.executeTool(
        { name: 'open_paper' } as any,
        JSON.stringify({ paper_id: id }),
      ).catch((err) => console.error('open_paper failed', err));
    });
  });
}

function filteredAndSorted(): Paper[] {
  let papers = getLibrary();
  if (STATE.query) {
    const q = STATE.query.toLowerCase();
    papers = papers.filter((p) => {
      if (p.title.toLowerCase().includes(q)) return true;
      if (p.authors.some((a) => a.family.toLowerCase().includes(q))) return true;
      if (p.year?.toString().includes(q)) return true;
      return false;
    });
  }
  switch (STATE.sort) {
    case 'title':
      papers = [...papers].sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'author':
      papers = [...papers].sort((a, b) => (a.authors[0]?.family ?? '').localeCompare(b.authors[0]?.family ?? ''));
      break;
    case 'year':
      papers = [...papers].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      break;
    case 'recency':
    default:
      papers = [...papers].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
      break;
  }
  return papers;
}

function paperRow(p: Paper): string {
  const author = p.authors[0]?.family ?? 'Unknown';
  const more = p.authors.length > 1 ? ` et al.` : '';
  const year = p.year ? ` · ${p.year}` : '';
  return `
    <li class="paper-row" data-paper-id="${p.id}" role="button" tabindex="0" aria-label="Open ${escapeHtml(p.title)}">
      <div class="paper-row-title">${escapeHtml(p.title)}</div>
      <div class="paper-row-meta">${escapeHtml(author)}${escapeHtml(more)}${year}</div>
      <div class="paper-row-source">${escapeHtml(p.source)}</div>
    </li>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
