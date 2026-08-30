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
import { getStore } from './_lib/store';

export default async (_req: Request, _ctx: Context): Promise<Response> => {
  const store = getStore('lattice');
  const papers: Array<{ id: string; title?: string; year?: number; doi?: string; arxiv_id?: string }> = [];
  try {
    const list = await store.list({ prefix: 'papers/' });
    for (const blob of list.blobs) {
      const id = blob.key.split('/')[1];
      if (!id) continue;
      if (blob.key.includes('/')) continue;
      const meta = await store.getWithMetadata(`papers/${id}/meta.json`, { type: 'json' });
      const entry: { id: string; title?: string; year?: number; doi?: string; arxiv_id?: string } = { id };
      if (meta && meta.data) {
        const parsed = meta.data as Record<string, unknown>;
        entry.title = typeof parsed.title === 'string' ? parsed.title : undefined;
        entry.year = typeof parsed.year === 'number' ? parsed.year : undefined;
        entry.doi = typeof parsed.doi === 'string' ? parsed.doi : undefined;
        entry.arxiv_id = typeof parsed.arxiv_id === 'string' ? parsed.arxiv_id : undefined;
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
