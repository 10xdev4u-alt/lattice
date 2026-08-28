/**
 * /api/papers/<id>/index — build the search index for a paper.
 *
 * Reads the extracted text from papers/<id>/text.json, builds the
 * inverted index, writes it to papers/<id>/index.json. Idempotent
 * (re-runs overwrite the previous index).
 *
 * Closes #56.
 */

import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { buildIndex, type PageText } from './_lib/search-index';

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }
  const id = new URL(req.url).pathname.match(/\/api\/papers\/([^/]+)\/index/)?.[1];
  if (!id) {
    return jsonResponse({ error: { code: 'BAD_PATH', message: 'Missing paper id.' } }, 400);
  }

  const store = getStore('lattice');
  const textBlob = await store.get(`papers/${id}/text.json`);
  if (!textBlob) {
    return jsonResponse(
      {
        error: {
          code: 'NOT_FOUND',
          message: `No text.json for paper ${id}.`,
          retry_hint: 'Run /api/papers/ingest or /api/papers/from-arxiv first.',
        },
      },
      404,
    );
  }
  const parsed = (await textBlob.json()) as { pages: PageText[] };
  const index = buildIndex(id, parsed.pages);
  await store.setJSON(`papers/${id}/index.json`, index);

  return jsonResponse({
    paper_id: id,
    total_terms: index.total_terms,
    total_pages: index.total_pages,
    built_at: index.built_at,
  });
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  path: '/api/papers/:id/index',
  method: 'POST',
};
