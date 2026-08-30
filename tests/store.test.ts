/**
 * Filesystem store — round-trip tests for the runtime's
 * @netlify/blobs replacement.
 *
 * Covers the five methods the API handlers use (get,
 * getWithMetadata, set, setJSON, list), path sanitization, and
 * the prefix-list semantics papers-index/papers-explain rely
 * on.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRoot, getStore as getStoreRaw, type BlobStore } from '../api/_lib/store';

describe('filesystem store', () => {
  let store: BlobStore;
  let storeDir: string;

  beforeEach(async () => {
    storeDir = await mkdtemp(join(tmpdir(), 'lattice-store-'));
    process.env.LATTICE_STORE_DIR = storeDir;
    _resetRoot();
    store = getStoreRaw('test');
  });

  afterEach(async () => {
    delete process.env.LATTICE_STORE_DIR;
    _resetRoot();
    await rm(storeDir, { recursive: true, force: true });
  });

  it('set then get returns the same string', async () => {
    await store.set('papers/x/source.tex', 'hello latex');
    expect(await store.get('papers/x/source.tex')).toBe('hello latex');
  });

  it('setJSON then getWithMetadata parses JSON back', async () => {
    await store.setJSON('papers/x/text.json', { pages: [{ text: 'p1' }] });
    const res = await store.getWithMetadata('papers/x/text.json', { type: 'json' });
    expect(res?.data).toEqual({ pages: [{ text: 'p1' }] });
  });

  it('set persists metadata alongside the blob', async () => {
    await store.set('papers/x/source.tex', 'body', { metadata: { arxivId: '1706.03762' } });
    const res = await store.getWithMetadata('papers/x/source.tex');
    expect(res?.metadata).toEqual({ arxivId: '1706.03762' });
  });

  it('get on a missing key returns null', async () => {
    expect(await store.get('nope/missing.tex')).toBeNull();
  });

  it('getWithMetadata on a missing key returns null', async () => {
    expect(await store.getWithMetadata('nope/missing.json', { type: 'json' })).toBeNull();
  });

  it('list returns every key under a prefix, excluding meta files', async () => {
    await store.set('papers/a/source.tex', 'a');
    await store.set('papers/a/index.json', '{}');
    await store.set('papers/b/source.tex', 'b');
    const { blobs } = await store.list({ prefix: 'papers/' });
    const keys = blobs.map((b) => b.key).sort();
    expect(keys).toEqual(['papers/a/index.json', 'papers/a/source.tex', 'papers/b/source.tex']);
  });

  it('list with an exact-blob prefix finds that blob', async () => {
    await store.set('papers/a/source.tex', 'a');
    const { blobs } = await store.list({ prefix: 'papers/a/source.tex' });
    expect(blobs.map((b) => b.key)).toEqual(['papers/a/source.tex']);
  });

  it('isolates stores by name', async () => {
    await store.set('k', 'one');
    await getStoreRaw('other').set('k', 'two');
    expect(await store.get('k')).toBe('one');
    expect(await getStoreRaw('other').get('k')).toBe('two');
  });

  it('rejects path traversal outside the store root', async () => {
    await expect(store.set('../../etc/passwd', 'nope')).rejects.toThrow();
    await expect(store.get('../outside.txt')).rejects.toThrow();
  });

  it('writes to disk under LATTICE_STORE_DIR', async () => {
    await store.set('papers/x/source.tex', 'persisted');
    const raw = await readFile(join(storeDir, 'test', 'papers/x/source.tex'), 'utf8');
    expect(raw).toBe('persisted');
  });

  it('resolves a versionless id to the stored versioned id', async () => {
    await store.setJSON('papers/arxiv-170603762v7/text.json', { pages: [] });
    const { resolvePaperId } = await import('../api/_lib/store');
    // library id form (dots, no version)
    expect(await resolvePaperId(store, 'arxiv:1706.03762')).toBe('arxiv-170603762v7');
    // dashed form without version
    expect(await resolvePaperId(store, 'arxiv-170603762')).toBe('arxiv-170603762v7');
    // exact form passes through
    expect(await resolvePaperId(store, 'arxiv-170603762v7')).toBe('arxiv-170603762v7');
    // the vN suffix digit must not pollute the match
    expect(await resolvePaperId(store, 'arxiv:9999.99999')).toBeNull();
  });
});
