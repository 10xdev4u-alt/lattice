/**
 * Per-paper search index — BM25 + Porter stemmer.
 *
 * Index shape: { pages: [{ page, terms: { term: count }, dl }] }
 * Query terms are Porter-stemmed; every indexed term is stemmed at
 * build time so "transformer" matches "transformers".
 *
 * BM25 per page: score = sum_t IDF(t) * (tf*(k1+1))/(tf+k1*(1-b+b*dl/avgdl))
 * where N = number of pages, df(t) = pages containing t.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in',
  'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the',
  'their', 'then', 'there', 'these', 'they', 'this', 'to', 'was', 'will',
  'with', 'we', 'you', 'your', 'i', 'our', 'he', 'she', 'his', 'her',
]);

import { stem } from './search/stemmer';

const TERM_PATTERN = /[a-z0-9]+/gi;
const BM25_K1 = 1.2;
const BM25_B = 0.75;

export interface PageText {
  page_number: number;
  text: string;
}

export interface SearchIndexPage {
  page_number: number;
  terms: Record<string, number>;
  /** document length (non-stopword stem count) for length norm */
  dl: number;
}

export interface SearchIndex {
  paper_id: string;
  built_at: string;
  total_terms: number;
  total_pages: number;
  /** mean dl across pages — used by BM25 length norm */
  avgdl: number;
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
  let totalDl = 0;
  for (const page of pages) {
    const terms: Record<string, number> = {};
    let dl = 0;
    const matches = page.text.match(TERM_PATTERN) ?? [];
    for (const raw of matches) {
      const term = stem(raw.toLowerCase());
      if (term.length < 2) continue;
      if (STOPWORDS.has(term)) continue;
      terms[term] = (terms[term] ?? 0) + 1;
      totalTerms++;
      dl++;
    }
    indexed.push({ page_number: page.page_number, terms, dl });
    totalDl += dl;
  }
  const avgdl = indexed.length > 0 ? totalDl / indexed.length : 0;
  return {
    paper_id: paperId,
    built_at: new Date().toISOString(),
    total_terms: totalTerms,
    total_pages: pages.length,
    avgdl,
    pages: indexed,
  };
}

export function searchIndex(index: SearchIndex, query: string, maxPerPaper = 3): SearchHit[] {
  const queryTerms = (query.match(TERM_PATTERN) ?? [])
    .map((t) => stem(t.toLowerCase()))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  if (queryTerms.length === 0) return [];

  const N = index.pages.length;
  // Document frequency — how many pages contain each query term
  const df: Record<string, number> = {};
  for (const qt of queryTerms) {
    df[qt] = index.pages.filter((p) => qt in p.terms).length;
  }
  const avgdl = (index as SearchIndex & { avgdl?: number }).avgdl ?? 0;
  const effectiveAvgdl = avgdl > 0 ? avgdl : Math.max(1, index.pages.reduce((s, p) => s + ((p as SearchIndexPage).dl ?? 1), 0) / Math.max(1, N));

  const hits: SearchHit[] = [];
  for (const page of index.pages) {
    let score = 0;
    let bestTerm: string | null = null;
    let bestCount = 0;
    const dl = (page as SearchIndexPage).dl ?? (Object.values(page.terms).reduce((s, v) => s + v, 0));
    for (const qt of queryTerms) {
      const tf = page.terms[qt] ?? 0;
      if (tf === 0) continue;
      const docFreq = df[qt] ?? 0;
      const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);
      const norm = tf * (BM25_K1 + 1) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (dl / effectiveAvgdl)));
      score += idf * norm;
      if (tf > bestCount) {
        bestCount = tf;
        bestTerm = qt;
      }
    }
    if (score <= 0) continue;
    hits.push({
      page: page.page_number,
      score,
      snippet: bestTerm ?? queryTerms[0]!,
    });
  }
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
