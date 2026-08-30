/**
 * Saved arXiv searches — the user saves a query, the app polls
 * the arXiv API for new papers matching that query and surfaces
 * them as "new since you last checked" cards.
 *
 * For the demo the polling is manual: a button refreshes the
 * latest results. A real deploy would do this on a Netlify
 * Scheduled Function. The saved list persists to localStorage.
 */

import { addPaper } from './library';
import { fetchArxivMetadata } from '../../netlify/functions/_lib/arxiv';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  category: string;
  createdAt: string;
  lastCheckedAt: string;
  lastSeenIds: string[];
}

const STORAGE_KEY = 'lattice.saved-searches.v1';

function read(): SavedSearch[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SavedSearch[];
  } catch {
    return [];
  }
}

function write(s: SavedSearch[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  document.dispatchEvent(new CustomEvent('lattice:saved-searches-changed'));
}

export function listSavedSearches(): SavedSearch[] {
  return read();
}

export function saveSearch(name: string, query: string, category: string): SavedSearch {
  const all = read();
  const s: SavedSearch = {
    id: `s_${Date.now().toString(36)}`,
    name,
    query,
    category,
    createdAt: new Date().toISOString(),
    lastCheckedAt: new Date(0).toISOString(),
    lastSeenIds: [],
  };
  all.push(s);
  write(all);
  return s;
}

export function deleteSavedSearch(id: string): void {
  write(read().filter((s) => s.id !== id));
}

interface FeedItem {
  id: string;
  title: string;
  authors: string[];
  published: string | null;
  summary: string;
}

async function fetchRecentForQuery(query: string, category: string): Promise<FeedItem[]> {
  const fullQuery = category ? `cat:${category}+AND+${encodeURIComponent(query)}` : encodeURIComponent(query);
  try {
    const res = await fetch(
      `https://export.arxiv.org/api/query?search_query=${fullQuery}&max_results=20&sortBy=submittedDate&sortOrder=descending`,
      { headers: { Accept: 'application/atom+xml' } },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const items: FeedItem[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(xml))) {
      const e = m[1]!;
      const idMatch = e.match(/<id>([^<]+)<\/id>/);
      const id = idMatch ? idMatch[1]!.split('/').pop() ?? '' : '';
      if (!id) continue;
      const titleMatch = e.match(/<title>([^<]+)<\/title>/);
      const summaryMatch = e.match(/<summary>([^<]+)<\/summary>/);
      const publishedMatch = e.match(/<published>([^<]+)<\/published>/);
      const authors = [...e.matchAll(/<author>\s*<name>([^<]+)<\/name>\s*<\/author>/g)].map((x) => x[1]!);
      items.push({
        id,
        title: titleMatch ? titleMatch[1]!.trim().replace(/\s+/g, ' ') : '(untitled)',
        authors,
        published: publishedMatch ? publishedMatch[1]! : null,
        summary: summaryMatch ? summaryMatch[1]!.trim().replace(/\s+/g, ' ').slice(0, 200) : '',
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function refreshSavedSearch(search: SavedSearch): Promise<FeedItem[]> {
  const items = await fetchRecentForQuery(search.query, search.category);
  const seen = new Set(search.lastSeenIds);
  const newItems = items.filter((it) => !seen.has(it.id));
  search.lastCheckedAt = new Date().toISOString();
  search.lastSeenIds = items.map((it) => it.id);
  write(read().map((s) => (s.id === search.id ? search : s)));
  return newItems;
}

export function mountSavedSearchesPanel(root: HTMLElement): void {
  render(root);
  document.addEventListener('lattice:saved-searches-changed', () => render(root));
}

function render(root: HTMLElement): void {
  const searches = read();
  root.innerHTML = `
    <section class="saved-searches">
      <h2>Saved arXiv searches</h2>
      <form class="saved-searches-form" data-form>
        <input data-name placeholder="Name (e.g. RLHF safety)" required />
        <input data-query placeholder="Query (e.g. self-consistency)" required />
        <select data-category>
          <option value="cs.LG">cs.LG</option>
          <option value="cs.CL">cs.CL</option>
          <option value="cs.AI">cs.AI</option>
          <option value="cs.CV">cs.CV</option>
          <option value="stat.ML">stat.ML</option>
          <option value="q-bio.NC">q-bio.NC</option>
        </select>
        <button type="submit">Save this search</button>
      </form>
      <p class="saved-searches-hint">Save a search to see the latest arXiv papers in that category+query. Click "Check for new" to fetch fresh results.</p>
      <ul class="saved-searches-list" role="list">
        ${searches
          .map(
            (s) => `<li class="saved-search-row" data-id="${s.id}">
              <div class="saved-search-meta">
                <div class="saved-search-name">${escapeHtml(s.name)}</div>
                <div class="saved-search-query">${escapeHtml(s.query)} in ${escapeHtml(s.category)}</div>
                <div class="saved-search-when">last checked: ${escapeHtml(s.lastCheckedAt === new Date(0).toISOString() ? 'never' : new Date(s.lastCheckedAt).toLocaleString())}</div>
              </div>
              <div class="saved-search-actions">
                <button data-action="check" data-id="${s.id}">Check for new</button>
                <button data-action="delete" data-id="${s.id}">Delete</button>
              </div>
              <div class="saved-search-results" data-results-for="${s.id}"></div>
            </li>`,
          )
          .join('')}
      </ul>
    </section>
  `;

  root.querySelector<HTMLFormElement>('[data-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (root.querySelector<HTMLInputElement>('[data-name]')?.value ?? '').trim();
    const query = (root.querySelector<HTMLInputElement>('[data-query]')?.value ?? '').trim();
    const category = root.querySelector<HTMLSelectElement>('[data-category]')?.value ?? 'cs.LG';
    if (!name || !query) return;
    saveSearch(name, query, category);
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteSavedSearch(btn.dataset.id!);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-action="check"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id!;
      const target = read().find((s) => s.id === id);
      if (!target) return;
      btn.disabled = true;
      btn.textContent = 'Checking…';
      const items = await refreshSavedSearch(target);
      btn.disabled = false;
      btn.textContent = 'Check for new';
      const results = root.querySelector<HTMLElement>(`[data-results-for="${id}"]`);
      if (results) {
        if (items.length === 0) {
          results.innerHTML = '<p class="canvas-empty">No new papers since the last check.</p>';
        } else {
          results.innerHTML = `
            <h4>New papers (${items.length}):</h4>
            <ul>
              ${items
                .map(
                  (it) => `<li class="saved-search-result" data-id="${escapeHtml(it.id)}">
                    <strong>${escapeHtml(it.title)}</strong>
                    <span class="saved-search-authors">${escapeHtml(it.authors.slice(0, 3).join(', '))}</span>
                    <button data-action="add" data-id="${escapeHtml(it.id)}" data-title="${escapeHtml(it.title)}">Add to library</button>
                  </li>`,
                )
                .join('')}
            </ul>
          `;
          results.querySelectorAll<HTMLButtonElement>('[data-action="add"]').forEach((addBtn) => {
            addBtn.addEventListener('click', async () => {
              const meta = await fetchArxivMetadata(addBtn.dataset.id!);
              if (!meta) return;
              addPaper({
                id: `arxiv-${meta.arxiv_id.replace(/[^\w]/g, '')}`,
                title: meta.title,
                authors: meta.authors.map((name) => {
                  const parts = name.split(/\s+/);
                  const family = parts.pop() ?? name;
                  return { family, given: parts.join(' ') };
                }),
                year: meta.published ? Number(meta.published.slice(0, 4)) : undefined,
                doi: meta.doi ?? undefined,
                arxivId: meta.arxiv_id,
                abstract: meta.summary,
                source: 'arxiv',
                addedAt: new Date().toISOString(),
              });
              addBtn.textContent = 'Added ✓';
            });
          });
        }
      }
    });
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
