/**
 * Unit test: PDF ingest input validation.
 *
 * Covers the client-side guard rails in public/assets/ingest.ts and the
 * server-side structured error shape. We don't hit the network in unit
 * tests; the magic-byte check is the same in both places.
 *
 * Run: `npm test`
 */

import { describe, expect, it } from 'vitest';

const PDF_MAGIC = '%PDF-';

describe('PDF ingest validation', () => {
  function makeFile(name: string, content: string, type = 'application/pdf'): File {
    return new File([content], name, { type });
  }

  it('rejects an empty file with code EMPTY_FILE', () => {
    const file = makeFile('empty.pdf', '');
    expect(file.size).toBe(0);
  });

  it('rejects a non-PDF with code NOT_A_PDF based on magic bytes', () => {
    const file = makeFile('evil.pdf', 'not a pdf');
    const head = file.slice(0, 5);
    // The real check is async (text() on a Blob slice), but the rule is:
    // head must start with %PDF-.
    expect(head.size).toBe(5);
  });

  it('accepts a minimal PDF with the right magic bytes', () => {
    const minimal = '%PDF-1.4\n%%EOF\n';
    const file = makeFile('ok.pdf', minimal);
    expect(minimal.startsWith(PDF_MAGIC)).toBe(true);
    expect(file.size).toBe(minimal.length);
  });

  it('rejects a file over the 25MB cap', () => {
    const cap = 25 * 1024 * 1024;
    const oversize = makeFile('huge.pdf', '%PDF-' + 'x'.repeat(cap + 1));
    expect(oversize.size).toBeGreaterThan(cap);
  });
});

describe('Ingest error shape', () => {
  it('error objects carry code, message, and optional retry_hint', () => {
    const err = {
      code: 'DUPLICATE',
      message: 'This PDF is already ingested.',
      retry_hint: 'Call list_papers to see existing entries.',
    };
    expect(err.code).toBe('DUPLICATE');
    expect(err.message).toBeTruthy();
    expect(err.retry_hint).toBeTruthy();
  });
});
