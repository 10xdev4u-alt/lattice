/**
 * Unit tests for the citation-chip pattern matcher.
 *
 * The paper-id pattern is regex-based. We verify it catches the
 * various forms (arxiv:<id>, pdf-<hash>, with version suffix).
 */

import { describe, expect, it } from 'vitest';

const PAPER_ID_PATTERN = /\b(arxiv:[\w.-]+|pdf-[\w]+)\b/g;

function findPaperIds(text: string): string[] {
  return [...text.matchAll(PAPER_ID_PATTERN)].map((m) => m[0]!);
}

describe('citation chip paper-id detection', () => {
  it('matches an arXiv id with prefix', () => {
    expect(findPaperIds('See arxiv:1706.03762 for the original.')).toEqual(['arxiv:1706.03762']);
  });
  it('matches a pdf hash id', () => {
    expect(findPaperIds('See pdf-abc123def456 for the local copy.')).toEqual(['pdf-abc123def456']);
  });
  it('matches a versioned arXiv id', () => {
    expect(findPaperIds('The latest is arxiv:1706.03762v3.')).toEqual(['arxiv:1706.03762v3']);
  });
  it('matches multiple ids in one string', () => {
    const ids = findPaperIds('Compare arxiv:1706.03762 with arxiv:1810.04805.');
    expect(ids).toEqual(['arxiv:1706.03762', 'arxiv:1810.04805']);
  });
  it('does not match email-like strings', () => {
    expect(findPaperIds('Contact user@example.com for the file.')).toEqual([]);
  });
  it('matches a dot-separated arXiv id', () => {
    expect(findPaperIds('See arxiv:2005.14165 for few-shot learning.')).toEqual(['arxiv:2005.14165']);
  });
});
