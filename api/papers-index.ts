/**
 * GET /api/papers — list the library from Blobs.
 *
 * Used by list_papers. Reads the keys under `papers/` in the
 * Lattice Blobs store, fetches each `meta.json` (if present),
 * and returns CSL-JSON-shaped entries.
 *
 * The client falls back to localStorage if this Function is
 * unreachable. The meta files are written by a future
 * magic-link-auth build; for now the Function returns just the
 * paper ids and the client cross-references with localStorage.
 *
 * Closes the polish item: list_papers reads from the server.
 */

import type { Config, Context } from './_lib/types';
import { storeFor } from './_lib/session';

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const { store } = storeFor(req);
  const papers: Array<{ id: string; title?: string; year?: number; doi?: string; arxiv_id?: string }> = [];
  try {
    const list = await store.list({ prefix: 'papers/' });
    const seen = new Set<string>();
    for (const blob of list.blobs) {
      // Keys look like papers/<id>/<file> — one entry per paper id.
      const id = blob.key.split('/')[1];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      let meta = await store.getWithMetadata(`papers/${id}/meta.json`, { type: 'json' });
      // Legacy fallback: papers ingested before meta.json was
      // persisted on ingest carry only the store sidecar
      // (<file>.meta.json). Derive the title from the sidecar's
      // originalFilename so hydration doesn't skip them.
      if (!meta || !meta.data) {
        const sidecar = await store.getWithMetadata(`papers/${id}/source.pdf.meta.json`, {
          type: 'json',
        });
        if (sidecar && sidecar.data) {
          const parsed = sidecar.data as Record<string, unknown>;
          const original = typeof parsed.originalFilename === 'string' ? parsed.originalFilename : '';
          meta = {
            data: {
              id,
              title: original.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ') || id,
            },
            metadata: sidecar.metadata,
          };
        }
      }
      const entry: {
        id: string;
        title?: string;
        year?: number;
        doi?: string;
        arxiv_id?: string;
        abstract?: string;
        authors?: Array<{ family: string; given?: string }>;
      } = { id };
      if (meta && meta.data) {
        const parsed = meta.data as Record<string, unknown>;
        entry.title = typeof parsed.title === 'string' ? parsed.title : undefined;
        entry.year = typeof parsed.year === 'number' ? parsed.year : undefined;
        entry.doi = typeof parsed.doi === 'string' ? parsed.doi : undefined;
        entry.arxiv_id = typeof parsed.arxiv_id === 'string' ? parsed.arxiv_id : undefined;
        entry.abstract = typeof parsed.abstract === 'string' ? parsed.abstract : undefined;
        if (Array.isArray(parsed.authors)) {
          // The store holds raw name strings from arXiv; the client
          // library wants { family, given } — split on the last
          // whitespace, the usual citation convention.
          entry.authors = (parsed.authors as unknown[])
            .filter((a): a is string => typeof a === 'string')
            .map((name) => {
              const parts = name.split(/\s+/);
              const family = parts.pop() ?? name;
              return { family, given: parts.join(' ') };
            });
        }
      }
      papers.push(entry);
    }
  } catch {
    // No store or no list support; return empty.
  }
  return new Response(JSON.stringify({ count: papers.length, papers }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  path: '/api/papers',
  method: 'GET',
};
