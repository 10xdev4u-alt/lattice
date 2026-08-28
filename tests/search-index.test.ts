/**
 * Unit tests for the per-paper search index.
 */

import { describe, expect, it } from 'vitest';
import { buildIndex, searchIndex, snippetAroundTermInText, type PageText } from '../netlify/functions/_lib/search-index';

describe('buildIndex', () => {
  it('counts terms per page', () => {
    const pages: PageText[] = [{ page_number: 1, text: 'the cat sat on the mat' }];
    const idx = buildIndex('p1', pages);
    expect(idx.total_pages).toBe(1);
    expect(idx.pages[0]?.terms['cat']).toBe(1);
    expect(idx.pages[0]?.terms['mat']).toBe(1);
    expect(idx.pages[0]?.terms['the']).toBeUndefined();
  });

  it('is case-insensitive', () => {
    const pages: PageText[] = [{ page_number: 1, text: 'BERT bert Bert' }];
    const idx = buildIndex('p1', pages);
    expect(idx.pages[0]?.terms['bert']).toBe(3);
  });

  it('skips stopwords', () => {
    const pages: PageText[] = [{ page_number: 1, text: 'a an the and is of' }];
    const idx = buildIndex('p1', pages);
    expect(idx.total_terms).toBe(0);
  });

  it('skips single-character tokens', () => {
    const pages: PageText[] = [{ page_number: 1, text: 'a b c d cat' }];
    const idx = buildIndex('p1', pages);
    expect(Object.keys(idx.pages[0]?.terms ?? {})).toEqual(['cat']);
  });

  it('returns zero terms for empty pages', () => {
    const idx = buildIndex('p1', []);
    expect(idx.total_pages).toBe(0);
    expect(idx.total_terms).toBe(0);
  });
});

describe('searchIndex', () => {
  const idx = buildIndex('p1', [
    { page_number: 1, text: 'attention is all you need' },
    { page_number: 2, text: 'we propose the transformer architecture' },
    { page_number: 3, text: 'attention is the key contribution' },
  ]);

  it('finds pages with matching terms', () => {
    const hits = searchIndex(idx, 'attention', 5);
    expect(hits.length).toBe(2);
    expect(hits[0]?.page).toBeLessThan(hits[1]?.page);
  });

  it('returns empty for queries that are all stopwords', () => {
    expect(searchIndex(idx, 'the and a', 5)).toEqual([]);
  });

  it('returns empty for queries with no matches', () => {
    expect(searchIndex(idx, 'kubernetes', 5)).toEqual([]);
  });

  it('scores higher for pages with more term occurrences', () => {
    const hits = searchIndex(idx, 'attention', 5);
    expect(hits[0]?.page).toBe(1);
    expect(hits[0]?.page).toBe(3);
  });

  it('caps the result count', () => {
    const hits = searchIndex(idx, 'attention', 1);
    expect(hits.length).toBe(1);
  });
});

describe('snippetAroundTermInText', () => {
  it('returns text around the matched term', () => {
    const text = 'a '.repeat(100) + 'ATTENTION ' + 'b '.repeat(100);
    const snippet = snippetAroundTermInText(text, 'attention', 40);
    expect(snippet.toLowerCase()).toContain('attention');
    expect(snippet.length).toBeLessThan(200);
  });

  it('returns the head of the text when the term is missing', () => {
    const text = 'x'.repeat(500);
    const snippet = snippetAroundTermInText(text, 'missing', 40);
    expect(snippet.length).toBe(80);
  });
});
