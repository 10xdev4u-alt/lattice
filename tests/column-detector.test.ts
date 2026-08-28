/**
 * Unit tests for the two-column read-order reconstruction.
 */

import { describe, expect, it } from 'vitest';
import { reconstructPage, type TextItem } from '../netlify/functions/_lib/column-detector';

function item(x: number, y: number, str: string, w = 50, h = 10): TextItem {
  return { str, x, y, width: w, height: h };
}

describe('reconstructPage', () => {
  it('returns empty text for an empty page', () => {
    const r = reconstructPage([], 612, 1);
    expect(r.text).toBe('');
    expect(r.column_count).toBe(0);
  });

  it('handles a single-column page top-to-bottom', () => {
    const items = [
      item(100, 700, 'Title'),
      item(100, 680, 'Authors'),
      item(100, 660, 'Abstract'),
    ];
    const r = reconstructPage(items, 612, 1);
    expect(r.column_count).toBe(1);
    expect(r.text).toContain('Title');
    expect(r.text).toContain('Authors');
    expect(r.text).toContain('Abstract');
    // Title comes first
    expect(r.text.indexOf('Title')).toBeLessThan(r.text.indexOf('Authors'));
  });

  it('reconstructs a two-column page in left-then-right order', () => {
    // Left column: 3 lines, descending y in PDF coords (top has higher y)
    // Right column: 3 lines
    const items = [
      // Left column
      item(50, 700, 'Left-1'),
      item(50, 680, 'Left-2'),
      item(50, 660, 'Left-3'),
      // Right column
      item(400, 700, 'Right-1'),
      item(400, 680, 'Right-2'),
      item(400, 660, 'Right-3'),
    ];
    const r = reconstructPage(items, 612, 1);
    expect(r.column_count).toBe(2);
    // Reading order: left top -> left middle -> left bottom -> right top -> ...
    const left1 = r.text.indexOf('Left-1');
    const left2 = r.text.indexOf('Left-2');
    const left3 = r.text.indexOf('Left-3');
    const right1 = r.text.indexOf('Right-1');
    expect(left1).toBeLessThan(left2);
    expect(left2).toBeLessThan(left3);
    expect(left3).toBeLessThan(right1);
  });

  it('inserts line breaks when y-gap exceeds the threshold', () => {
    // Two lines in the same column, big y gap
    const items = [item(100, 700, 'Para1'), item(100, 600, 'Para2')];
    const r = reconstructPage(items, 612, 1);
    expect(r.text).toMatch(/Para1\nPara2/);
  });

  it('joins adjacent items in the same line with a space', () => {
    const items = [item(100, 700, 'Hello'), item(160, 700, 'world')];
    const r = reconstructPage(items, 612, 1);
    expect(r.text).toBe('Hello world');
  });

  it('collapses multiple whitespace characters', () => {
    const items = [item(100, 700, 'A'), item(105, 700, '  '), item(110, 700, 'B')];
    const r = reconstructPage(items, 612, 1);
    expect(r.text).toBe('A B');
  });

  it('handles a single-column page with many items without misclassifying as 2 columns', () => {
    // Many items all clustered in one x-band
    const items = Array.from({ length: 30 }, (_, i) => item(100, 700 - i * 12, `line${i}`));
    const r = reconstructPage(items, 612, 1);
    expect(r.column_count).toBe(1);
  });
});
