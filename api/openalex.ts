/**
 * OpenAlex proxy — real citation edges for the knowledge graph.
 *
 * GET https://api.openalex.org/works?filter=doi:<doi>
 * Cache 24h in LATTICE_STORE_DIR/openalex/<doi>.json. No key
 * needed. Falls back to null on network failure so the graph
 * still renders with co-year edges.
 */

import { getStore } from './_lib/store';
import { safeFetch } from './_lib/url-guard';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface OpenAlexWork {
  id: string;
  doi?: string;
  referenced_works?: string[];
  authorships?: Array<{ author: { display_name: string } }>;
}

export async function fetchOpenAlexByDoi(doi: string): Promise<OpenAlexWork | null> {
  const clean = doi.replace(/^https:\/\/doi\.org\//, '').trim();
  if (!clean) return null;
  const cacheKey = `openalex/${encodeURIComponent(clean)}.json`;
  const store = getStore('lattice');
  try {
    const cached = await store.getWithMetadata(cacheKey, { type: 'json' });
    if (cached?.data) {
      const age = Date.now() - new Date((cached.data as { _cachedAt: string })._cachedAt).getTime();
      if (age < CACHE_TTL_MS) return cached.data as OpenAlexWork;
    }
  } catch {
    // ignore cache miss
  }
  try {
    const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(clean)}`;
    const res = await safeFetch(url);
    if (!res.ok) return null;
    const work = (await res.json()) as OpenAlexWork;
    // annotate + cache
    (work as unknown as { _cachedAt: string })._cachedAt = new Date().toISOString();
    await store.setJSON(cacheKey, work).catch(() => {});
    return work;
  } catch {
    return null;
  }
}

export async function fetchOpenAlexByTitle(title: string): Promise<OpenAlexWork | null> {
  const q = encodeURIComponent(title.slice(0, 120));
  const url = `https://api.openalex.org/works?search=${q}&per-page=1`;
  try {
    const res = await safeFetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: OpenAlexWork[] };
    return data.results?.[0] ?? null;
  } catch {
    return null;
  }
}
