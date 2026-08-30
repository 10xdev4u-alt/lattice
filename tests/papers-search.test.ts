/**
 * papers-search handler — regression test for the crash where the
 * handler read text.json but treated it as a SearchIndex
 * ("Cannot use 'in' operator ... in undefined"), and for the
 * on-the-fly index build for papers without index.json.
 *
 * Uses a temp LATTICE_STORE_DIR and a stubbed global fetch for the
 * arXiv upstream, so the whole store shape is exercised offline.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getStore as getStoreRaw, _resetRoot } from '../api/_lib/store';
import { buildIndex } from '../api/_lib/search-index';
import { default as searchHandler } from '../api/papers-search';

type Handler = (req: Request, ctx: unknown) => Promise<Response>;

let handler: Handler;
let storeDir: string;
let getStore: typeof getStoreRaw;
let _resetRootFn: typeof _resetRoot;

beforeEach(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'lattice-search-'));
  process.env.LATTICE_STORE_DIR = storeDir;
  getStore = getStoreRaw;
  _resetRootFn = _resetRoot;
  _resetRootFn();
  handler = searchHandler as Handler;
});

afterEach(async () => {
  delete process.env.LATTICE_STORE_DIR;
  _resetRootFn();
  await rm(storeDir, { recursive: true, force: true });
});

function post(body: unknown): Promise<Response> {
  return handler(
    new Request('http://localhost/api/papers/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    {},
  );
}

describe('papers-search', () => {
  it('returns hits for a paper with a stored index.json', async () => {
    const store = getStore('lattice');
    const pages = [{ page_number: 1, text: 'The attention mechanism attends over tokens. Attention is weighted.' }];
    await store.setJSON('papers/p1/text.json', { pages });
    await store.setJSON('papers/p1/index.json', buildIndex('p1', pages));

    const res = await post({ query: 'attention' });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { total_hits: number; per_paper: Array<{ paper_id: string; hits: unknown[] }> };
    expect(data.total_hits).toBeGreaterThan(0);
    expect(data.per_paper[0]?.paper_id).toBe('p1');
  });

  it('builds an index on the fly when index.json is missing', async () => {
    const store = getStore('lattice');
    await store.setJSON('papers/p2/text.json', {
      pages: [{ page_number: 1, text: 'Self-attention computes a weighted sum. attention attention.' }],
    });

    const res = await post({ query: 'attention' });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { total_hits: number; per_paper: Array<{ paper_id: string }> };
    expect(data.total_hits).toBeGreaterThan(0);
    expect(data.per_paper[0]?.paper_id).toBe('p2');
  });

  it('returns zero hits for a query nothing matches', async () => {
    const store = getStore('lattice');
    await store.setJSON('papers/p3/text.json', {
      pages: [{ page_number: 1, text: 'Totally unrelated prose about ponds.' }],
    });
    const res = await post({ query: 'transformer' });
    const data = (await res.json()) as { total_hits: number };
    expect(data.total_hits).toBe(0);
  });

  it('includes a centered snippet from the page text', async () => {
    const store = getStore('lattice');
    await store.setJSON('papers/p4/text.json', {
      pages: [{ page_number: 1, text: 'Filler words. The attention mechanism is central. More filler.' }],
    });
    const res = await post({ query: 'attention' });
    const data = (await res.json()) as { per_paper: Array<{ hits: Array<{ snippet: string }> }> };
    expect(data.per_paper[0]?.hits[0]?.snippet).toContain('attention');
  });

  it('rejects a missing query', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it('rejects a non-POST', async () => {
    const res = await handler(new Request('http://localhost/api/papers/search', { method: 'GET' }), {});
    expect(res.status).toBe(405);
  });
});
