/**
 * Tests for the search-index pure functions.
 *
 * We exercise the search/ranking logic directly. The Function itself
 * is a thin wrapper around this and the Blobs store; the integration
 * is covered by scripts/smoke.sh in a real deploy.
 */

import { describe, expect, it } from 'vitest';
import {
  buildIndex,
  searchIndex,
  snippetAroundTermInText,
  type PageText,
} from '../api/_lib/search-index';

describe('search-index end-to-end', () => {
  it('indexes a multi-page paper and returns ranked hits', () => {
    const pages: PageText[] = [
      { page_number: 1, text: 'The transformer is a sequence model. It uses self-attention.' },
      { page_number: 2, text: 'We evaluate on translation. The transformer beats RNNs on long sequences.' },
      { page_number: 3, text: 'Self-attention is the key contribution. We also study positional encodings.' },
    ];
    const index = buildIndex('p1', pages);
    const hits = searchIndex(index, 'transformer', 5);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0]?.page).toBe(1);
  });

  it('ranks pages with more matches higher', () => {
    const pages: PageText[] = [
      { page_number: 1, text: 'attention attention attention' },
      { page_number: 2, text: 'attention' },
    ];
    const index = buildIndex('p1', pages);
    const hits = searchIndex(index, 'attention', 5);
    expect(hits[0]?.page).toBe(1);
  });

  it('returns snippets centered on the match', () => {
    const text = 'a '.repeat(200) + 'TRANSFORMER ' + 'b '.repeat(200);
    const snippet = snippetAroundTermInText(text, 'transformer', 60);
    expect(snippet.toLowerCase()).toContain('transformer');
  });
});
