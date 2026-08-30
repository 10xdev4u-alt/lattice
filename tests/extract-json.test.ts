/**
 * extractJson — shared LLM-reply parser.
 *
 * Models wrap JSON in fences, prose, or trail off mid-object;
 * strings can contain braces. The extractor must find the first
 * balanced object and ignore braces inside string literals.
 */

import { describe, expect, it } from 'vitest';
import { extractJson } from '../api/_lib/extract-json';

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in a markdown fence', () => {
    expect(extractJson('Here you go:\n```json\n{"a": 2}\n```\nDone.')).toEqual({ a: 2 });
  });

  it('parses JSON embedded in prose', () => {
    expect(extractJson('Sure! The result is {"summary": "hi"} as requested.')).toEqual({ summary: 'hi' });
  });

  it('ignores braces inside string values', () => {
    const reply = '{"text": "a {fake} object"}';
    expect(extractJson(reply)).toEqual({ text: 'a {fake} object' });
  });

  it('handles escaped quotes inside strings', () => {
    const reply = '{"q": "he said \\"hi\\" { then left"}';
    expect(extractJson(reply)).toEqual({ q: 'he said "hi" { then left' });
  });

  it('takes the first balanced object when prose follows', () => {
    const reply = '{"a": 1} and then some trailing text with } braces';
    expect(extractJson(reply)).toEqual({ a: 1 });
  });

  it('stops at the matching close, not the last close', () => {
    const reply = 'prefix {"inner": {"x": 1}} suffix {"other": 2}';
    expect(extractJson(reply)).toEqual({ inner: { x: 1 } });
  });

  it('returns null when there is no JSON', () => {
    expect(extractJson('The paper discusses attention mechanisms.')).toBeNull();
  });

  it('returns null for an unbalanced object', () => {
    expect(extractJson('{"a": 1')).toBeNull();
  });

  it('returns null for an empty reply', () => {
    expect(extractJson('')).toBeNull();
  });

  it('parses the schema-echo failure shape from the wild', () => {
    // tencent/hy3 echoing schema fragments with placeholder
    // values — the extractor should still find the object.
    const reply = 'Here is my answer {"summary": "real answer", "page_citations": [1]} hope it helps';
    expect(extractJson(reply)).toEqual({ summary: 'real answer', page_citations: [1] });
  });
});
