/**
 * Paper list — the left rail.
 *
 * Renders every paper in the library, sortable by 4 fields (recency,
 * title, author, year), filterable by 4 fields (status, source, search
 * text, tag). Multi-select for compare / batch ops. Click to open in
 * the canvas.
 *
 * Closes #35. Updated for #143 (pin papers).
 */

import { getLibrary, type Paper } from '../library';
import { getModelContext } from '../model-context-polyfill';
import { isPinned, togglePin } from '../pins';
import { getTagsFor, addTag, removeTag, getAllTags, filterByTags } from '../tags';

interface FilterState {
  query: string;
  include: string[];
  exclude: string[];
}

const STATE: FilterState = { query: '', include: [], exclude: [] };

type SortKey = 'recency' | 'title' | 'author' | 'year';

const STATE: { sort: SortKey; query: string } = { sort: 'recency', query: '' };

export function mountPaperList(root: HTMLElement): void {
  render(root);

  document.addEventListener('lattice:library-changed', () => render(root));
  document.addEventListener('lattice:pins-changed', () => render(root));
  document.addEventListener('lattice:tags-changed', () => render(root));
}

function render(root: HTMLElement): void {
  const papers = filteredAndSorted();
  const allTags = getAllTags();
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
    ${allTags.length > 0 ? `
    <div class="paper-list-tags" role="group" aria-label="Filter by tag">
      ${allTags
        .map((t) => {
          const isIncluded = STATE.include.includes(t);
          const isExcluded = STATE.exclude.includes(t);
          const cls = isIncluded ? 'tag-pill tag-included' : isExcluded ? 'tag-pill tag-excluded' : 'tag-pill';
          return `<button class="${cls}" data-tag-filter="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
        })
        .join('')}
    </div>
    ` : ''}
    <button class="paper-list-batch" data-action="batch">Apply tool to every paper</button>
    <form class="paper-list-arxiv" data-arxiv-form>
      <input type="text" data-arxiv-input placeholder="Paste arXiv ID or URL" aria-label="Add an arXiv paper" />
      <button type="submit" aria-label="Add">+</button>
    </form>
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
  root.querySelectorAll<HTMLButtonElement>('[data-tag-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tagFilter!;
      if (STATE.include.includes(tag)) {
        STATE.include = STATE.include.filter((t) => t !== tag);
        STATE.exclude = [...STATE.exclude, tag];
      } else if (STATE.exclude.includes(tag)) {
        STATE.exclude = STATE.exclude.filter((t) => t !== tag);
      } else {
        STATE.include = [...STATE.include, tag];
      }
      render(root);
    });
  });

  root.querySelector<HTMLButtonElement>('[data-action="batch"]')?.addEventListener('click', () => {
    void import('../batch').then(({ mountBatchOverlay }) => mountBatchOverlay());
  });

  const arxivForm = root.querySelector<HTMLFormElement>('[data-arxiv-form]');
  const arxivInput = root.querySelector<HTMLInputElement>('[data-arxiv-input]');
  arxivForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = arxivInput?.value.trim();
    if (!id) return;
    if (arxivInput) arxivInput.disabled = true;
    try {
      const { addPaper } = await import('../library');
      const { fetchArxivSource } = await import('../../../netlify/functions/_lib/arxiv');
      const result = await fetchArxivSource(id);
      if (!result) {
        window.alert(`Could not fetch ${id}. Check the ID and try again.`);
        return;
      }
      addPaper({
        id: `arxiv-${result.metadata.arxiv_id.replace(/[^\w]/g, '')}`,
        title: result.metadata.title,
        authors: result.metadata.authors.map((name) => {
          const parts = name.split(/\s+/);
          const family = parts.pop() ?? name;
          return { family, given: parts.join(' ') };
        }),
        year: result.metadata.published ? Number(result.metadata.published.slice(0, 4)) : undefined,
        doi: result.metadata.doi ?? undefined,
        arxivId: result.metadata.arxiv_id,
        abstract: result.metadata.summary,
        source: 'arxiv',
        addedAt: new Date().toISOString(),
      });
      if (arxivInput) arxivInput.value = '';
      document.dispatchEvent(new CustomEvent('lattice:library-changed'));
    } finally {
      if (arxivInput) arxivInput.disabled = false;
    }
  });

  root.querySelectorAll<HTMLLIElement>('[data-paper-id]').forEach((li) => {
    li.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === 'pin') {
        togglePin(li.dataset.paperId!);
        return;
      }
      if (target.dataset.action === 'remove-tag') {
        const tag = target.dataset.tag;
        if (tag) removeTag(li.dataset.paperId!, tag);
        e.stopPropagation();
        return;
      }
      if (target.dataset.action === 'add-tag') {
        const tag = window.prompt(`Add tag to "${li.dataset.paperId}":`, '');
        if (tag) addTag(li.dataset.paperId!, tag);
        e.stopPropagation();
        return;
      }
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
  if (STATE.include.length > 0 || STATE.exclude.length > 0) {
    const ids = papers.map((p) => p.id);
    const keep = new Set(filterByTags(ids, STATE.include, STATE.exclude));
    papers = papers.filter((p) => keep.has(p.id));
  }
  // Pinned first, then sort
  const pinned = papers.filter((p) => isPinned(p.id));
  const rest = papers.filter((p) => !isPinned(p.id));
  const sortedRest = (() => {
    switch (STATE.sort) {
      case 'title':
        return [...rest].sort((a, b) => a.title.localeCompare(b.title));
      case 'author':
        return [...rest].sort((a, b) => (a.authors[0]?.family ?? '').localeCompare(b.authors[0]?.family ?? ''));
      case 'year':
        return [...rest].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      case 'recency':
      default:
        return [...rest].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    }
  })();
  return [...pinned, ...sortedRest];
}

function paperRow(p: Paper): string {
  const author = p.authors[0]?.family ?? 'Unknown';
  const more = p.authors.length > 1 ? ` et al.` : '';
  const year = p.year ? ` · ${p.year}` : '';
  const pinned = isPinned(p.id);
  const tags = getTagsFor(p.id);
  return `
    <li class="paper-row ${pinned ? 'paper-row-pinned' : ''}" data-paper-id="${p.id}" role="button" tabindex="0" aria-label="Open ${escapeHtml(p.title)}">
      <button class="paper-row-pin" data-action="pin" aria-label="${pinned ? 'Unpin' : 'Pin'} ${escapeHtml(p.title)}" aria-pressed="${pinned}">${pinned ? '★' : '☆'}</button>
      <div class="paper-row-title">${escapeHtml(p.title)}</div>
      <div class="paper-row-meta">${escapeHtml(author)}${escapeHtml(more)}${year}</div>
      <div class="paper-row-source">${escapeHtml(p.source)}</div>
      <div class="paper-row-tags">
        ${tags
          .map(
            (t) => `<span class="paper-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}<button data-action="remove-tag" data-tag="${escapeHtml(t)}" aria-label="Remove tag ${escapeHtml(t)}">×</button></span>`,
          )
          .join('')}
        <button class="paper-tag-add" data-action="add-tag">+ tag</button>
      </div>
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
