/**
 * Related papers — fetch from the arXiv API using the title as a
 * search query, render the top 5 matches as cards with title,
 * authors, year, abstract, and an "Add to library" button.
 *
 * Closes the polish item: a real "related papers" widget.
 */

import { addPaper } from './library';
import { fetchArxivMetadata } from './arxiv-client';

export interface RelatedItem {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  summary: string;
  score: number;
}

export async function fetchRelated(paperTitle: string, excludeId: string): Promise<RelatedItem[]> {
  const cleaned = paperTitle.replace(/[^\w\s]/g, '').split(/\s+/).slice(0, 8).join(' ');
  if (!cleaned) return [];
  try {
    const res = await fetch(
      `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(cleaned)}&max_results=6&sortBy=relevance&sortOrder=descending`,
      { headers: { Accept: 'application/atom+xml' } },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRelated(xml, excludeId);
  } catch {
    return [];
  }
}

function parseRelated(xml: string, excludeId: string): RelatedItem[] {
  const items: RelatedItem[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(xml))) {
    const e = match[1]!;
    const idMatch = e.match(/<id>([^<]+)<\/id>/);
    const id = idMatch ? idMatch[1]!.split('/').pop() ?? '' : '';
    if (!id || id === excludeId) continue;
    const titleMatch = e.match(/<title>([^<]+)<\/title>/);
    if (!titleMatch) continue;
    const summaryMatch = e.match(/<summary>([^<]+)<\/summary>/);
    const publishedMatch = e.match(/<published>([^<]+)<\/published>/);
    const authors = [...e.matchAll(/<author>\s*<name>([^<]+)<\/name>\s*<\/author>/g)].map((m) => m[1]!);
    items.push({
      id,
      title: titleMatch[1]!.trim().replace(/\s+/g, ' '),
      authors,
      year: publishedMatch ? Number(publishedMatch[1]!.slice(0, 4)) : null,
      summary: summaryMatch ? summaryMatch[1]!.trim().replace(/\s+/g, ' ').slice(0, 200) : '',
      score: 0,
    });
    if (items.length >= 5) break;
  }
  return items;
}

export function mountRelatedPanel(root: HTMLElement, paperTitle: string, excludeId: string): void {
  root.innerHTML = `<p class="canvas-empty">Finding related papers…</p>`;
  void fetchRelated(paperTitle, excludeId).then((items) => renderRelated(root, items));
}

function renderRelated(root: HTMLElement, items: RelatedItem[]): void {
  if (items.length === 0) {
    root.innerHTML = `<p class="canvas-empty">No related papers found.</p>`;
    return;
  }
  root.innerHTML = `
    <section class="related">
      <h2>Related papers</h2>
      <ul class="related-list" role="list">
        ${items
          .map(
            (it) => `<li class="related-item" data-related-id="${escapeHtml(it.id)}">
              <div class="related-title">${escapeHtml(it.title)}</div>
              <div class="related-meta">${escapeHtml(it.authors.slice(0, 3).join(', '))}${it.authors.length > 3 ? ' et al.' : ''}${it.year ? ` · ${it.year}` : ''}</div>
              <div class="related-summary">${escapeHtml(it.summary.slice(0, 200))}${it.summary.length > 200 ? '…' : ''}</div>
              <div class="related-actions">
                <button data-related-action="add" data-related-id="${escapeHtml(it.id)}">Add to library</button>
                <a href="https://arxiv.org/abs/${escapeHtml(it.id)}" target="_blank" rel="noopener">View on arXiv</a>
              </div>
            </li>`,
          )
          .join('')}
      </ul>
    </section>
  `;
  root.querySelectorAll<HTMLButtonElement>('[data-related-action="add"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.relatedId!;
      btn.disabled = true;
      btn.textContent = 'Loading…';
      const meta = await fetchArxivMetadata(id);
      if (!meta) {
        btn.textContent = 'Failed';
        return;
      }
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
      btn.textContent = 'Added ✓';
    });
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
