/**
 * Filesystem-backed KV store — the Lattice server runtime's
 * replacement for @netlify/blobs.
 *
 * Same surface the Functions already use: get, getWithMetadata,
 * set, setJSON, list. Keys are paths under
 * LATTICE_STORE_DIR (default .lattice-data), namespaced by
 * store name: <dir>/<store>/<key>.
 *
 * Every user-supplied key is sanitized to a safe relative path
 * so "../" can't escape the store root.
 */

import { promises as fs } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';

/** Resolved lazily so tests can set LATTICE_STORE_DIR per suite. */
let rootCache: string | null = null;
function ROOT(): string {
  if (!rootCache) rootCache = resolve(process.env.LATTICE_STORE_DIR ?? '.lattice-data');
  return rootCache;
}

/** Test-only: forget the cached root so a new env var takes effect. */
export function _resetRoot(): void {
  rootCache = null;
}

export interface StoreMetadata {
  data: unknown;
  metadata: Record<string, string> | null;
}

export interface StoreListEntry {
  key: string;
}

export interface BlobStore {
  get(key: string): Promise<string | null>;
  getWithMetadata(key: string, opts?: { type?: 'json' }): Promise<StoreMetadata | null>;
  set(key: string, value: string, opts?: { metadata?: Record<string, string> }): Promise<void>;
  setJSON(key: string, value: unknown, opts?: { metadata?: Record<string, string> }): Promise<void>;
  list(opts?: { prefix?: string }): Promise<{ blobs: StoreListEntry[] }>;
}

/** Resolve a (store, key) pair to a safe path under ROOT. */
function safePath(store: string, key: string): string {
  // Reject traversal outright — normalizing it away would let a
  // "../"-laden key silently land on a different (safe) path
  // instead of failing loudly.
  if (key.split(/[\\/]/).includes('..')) {
    throw new Error('Invalid store key: traversal');
  }
  const root = ROOT();
  const full = join(root, sanitizeSegment(store), normalize(key));
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error('Invalid store key');
  }
  return full;
}

function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function metaPath(dataPath: string): string {
  return dataPath + '.meta.json';
}

export function getStore(name: string): BlobStore {
  return {
    async get(key: string): Promise<string | null> {
      // Validate the key (throws on traversal) before the catch-all
      // read, so a bad key fails loudly instead of reading null.
      const path = safePath(name, key);
      try {
        return await fs.readFile(path, 'utf8');
      } catch {
        return null;
      }
    },

    async getWithMetadata(key: string, opts): Promise<StoreMetadata | null> {
      const dataPath = safePath(name, key);
      try {
        const raw = await fs.readFile(dataPath, 'utf8');
        const data = opts?.type === 'json' ? JSON.parse(raw) : raw;
        let metadata: Record<string, string> | null = null;
        try {
          const metaRaw = await fs.readFile(metaPath(dataPath), 'utf8');
          metadata = JSON.parse(metaRaw) as Record<string, string>;
        } catch {
          metadata = null;
        }
        return { data, metadata };
      } catch {
        return null;
      }
    },

    async set(key: string, value: string, opts): Promise<void> {
      const dataPath = safePath(name, key);
      await fs.mkdir(dirname(dataPath), { recursive: true });
      await fs.writeFile(dataPath, value);
      if (opts?.metadata) {
        await fs.writeFile(metaPath(dataPath), JSON.stringify(opts.metadata));
      }
    },

    async setJSON(key: string, value: unknown, opts): Promise<void> {
      const dataPath = safePath(name, key);
      await fs.mkdir(dirname(dataPath), { recursive: true });
      await fs.writeFile(dataPath, JSON.stringify(value));
      if (opts?.metadata) {
        await fs.writeFile(metaPath(dataPath), JSON.stringify(opts.metadata));
      }
    },

    async list(opts): Promise<{ blobs: StoreListEntry[] }> {
      const storeDir = join(ROOT(), sanitizeSegment(name));
      const prefixDir = opts?.prefix ? join(storeDir, opts.prefix) : storeDir;
      const blobs: StoreListEntry[] = [];
      async function walk(dir: string, rel: string): Promise<void> {
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const relKey = rel ? `${rel}/${entry.name}` : entry.name;
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full, relKey);
          } else if (!entry.name.endsWith('.meta.json')) {
            blobs.push({ key: relKey });
          }
        }
      }
      // If the prefix names an exact blob (papers/<id>/source.tex),
      // list() should still find it via the walk from the parent dir.
      let stat = null;
      try {
        stat = await fs.stat(prefixDir);
      } catch {
        stat = null;
      }
      if (stat?.isFile()) {
        const relKey = opts?.prefix ?? '';
        return { blobs: [{ key: relKey }] };
      }
      await walk(prefixDir, opts?.prefix?.replace(/\/$/, '') ?? '');
      return { blobs };
    },
  };
}
