/**
 * Per-paper search index.
 *
 * Builds a per-page inverted index from a paper's extracted text, stores
 * it in Blobs at papers/<id>/index.json, and exposes a search function
 * the Lattice search_library tool can call.
 *
 * The index shape: { pages: [{ page, terms: { term: count } }] }. We tokenize
 * on /[a-z0-9]+/i, lowercase, and drop stopwords. Stemming is intentionally
 * out of scope (Porter would be the next step if recall suffers).
 *
 * Closes #56.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in',
  'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the',
  'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will',
  'with', 'we', 'you', 'your', 'i', 'our', 'he', 'she', 'his', 'her',
]);

const TERM_PATTERN = /[a-z0-9]+/gi;

export interface PageText {
  page_number: number;
  text: string;
}

export interface SearchIndexPage {
  page_number: number;
  terms: Record<string, number>;
}

export interface SearchIndex {
  paper_id: string;
  built_at: string;
  total_terms: number;
  total_pages: number;
  pages: SearchIndexPage[];
}

export interface SearchHit {
  page: number;
  score: number;
  snippet: string;
}

export function buildIndex(paperId: string, pages: PageText[]): SearchIndex {
  const indexed: SearchIndexPage[] = [];
  let totalTerms = 0;
  for (const page of pages) {
    const terms: Record<string, number> = {};
    const matches = page.text.match(TERM_PATTERN) ?? [];
    for (const raw of matches) {
      const term = raw.toLowerCase();
      if (term.length < 2) continue;
      if (STOPWORDS.has(term)) continue;
      terms[term] = (terms[term] ?? 0) + 1;
      totalTerms++;
    }
    indexed.push({ page_number: page.page_number, terms });
  }
  return {
    paper_id: paperId,
    built_at: new Date().toISOString(),
    total_terms: totalTerms,
    total_pages: pages.length,
    pages: indexed,
  };
}

export function searchIndex(index: SearchIndex, query: string, maxPerPaper = 3): SearchHit[] {
  const queryTerms = (query.match(TERM_PATTERN) ?? [])
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  if (queryTerms.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const page of index.pages) {
    let score = 0;
    let bestTerm: string | null = null;
    let bestCount = 0;
    for (const qt of queryTerms) {
      const c = page.terms[qt] ?? 0;
      if (c > 0) {
        score += c;
        if (c > bestCount) {
          bestCount = c;
          bestTerm = qt;
        }
      }
    }
    if (score === 0) continue;
    hits.push({
      page: page.page_number,
      score,
      // Caller replaces snippet via snippetAroundTermInText with real page text;
      // keep best-term hint for snippet selection.
      snippet: bestTerm ?? queryTerms[0]!,
    });
  }
  // Sort before slice — top-k by score, not first-k encountered.
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, maxPerPaper);
}

function _snippetAroundTerm(_terms: Record<string, number>, _term: string): string {
  return _term;
}

export function snippetAroundTermInText(text: string, term: string, width = 80): string {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text.slice(0, width * 2);
  const start = Math.max(0, idx - width);
  const end = Math.min(text.length, idx + term.length + width);
  return (start > 0 ? '… ' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? ' …' : '');
}
