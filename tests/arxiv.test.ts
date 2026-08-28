/**
 * Unit tests for arXiv ID parsing and LaTeX stripping.
 *
 * Network calls are not exercised here; they require a live fetch and
 * are validated by the smoke test in a real run.
 */

import { describe, expect, it } from 'vitest';
import { stripArxivId, stripLatex } from '../netlify/functions/_lib/arxiv';

describe('stripArxivId', () => {
  it('parses a plain new-style ID', () => {
    expect(stripArxivId('1706.03762')).toBe('1706.03762');
  });
  it('parses an arXiv-prefixed ID', () => {
    expect(stripArxivId('arXiv:1706.03762')).toBe('1706.03762');
  });
  it('parses a URL with version', () => {
    expect(stripArxivId('https://arxiv.org/abs/1706.03762v3')).toBe('1706.03762v3');
  });
  it('parses an old-style ID with archive prefix', () => {
    expect(stripArxivId('hep-ex/0307015')).toBe('hep-ex/0307015');
  });
  it('returns null for garbage input', () => {
    expect(stripArxivId('not an id')).toBeNull();
    expect(stripArxivId('')).toBeNull();
    expect(stripArxivId('   ')).toBeNull();
  });
});

describe('stripLatex', () => {
  it('strips LaTeX comments', () => {
    expect(stripLatex('hello % a comment\nworld')).toContain('hello');
    expect(stripLatex('hello % a comment\nworld')).not.toContain('comment');
  });
  it('strips LaTeX environments', () => {
    const src = `before
\\begin{abstract}
this is the abstract
\\end{abstract}
after`;
    const out = stripLatex(src);
    expect(out).toContain('before');
    expect(out).toContain('after');
    expect(out).not.toContain('abstract');
  });
  it('strips inline commands', () => {
    expect(stripLatex('the \\emph{cat} sat')).toBe('the cat sat');
  });
  it('collapses extra whitespace', () => {
    const src = 'a\n\n\n\nb';
    expect(stripLatex(src)).toBe('a\n\nb');
  });
});
