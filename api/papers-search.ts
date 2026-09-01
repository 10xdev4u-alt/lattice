/**
 * POST /api/papers/search — search the library.
 *
 * Reads each paper's index.json, ranks the pages by sum of query-term
 * frequencies (per the search-index logic in the client), and
 * returns the top hits with page, score, and a centered snippet.
 *
 * Used by the search_library tool. The client passes the query and
 * the optional max_results_per_paper.
 *
 * Closes the polish item: the search tool now returns real hits.
 */

import type { Config, Context } from './_lib/types';
import { getStore } from './_lib/store';
import { storeFor } from './_lib/session';
import { tenantSetCookieHeader } from './_lib/session';
import { buildIndex, searchIndex, snippetAroundTermInText, type SearchIndex } from './_lib/search-index';

interface SearchRequest {
  query: string;
  max_results_per_paper?: number;
}

interface PageText {
  page_number: number;
  text: string;
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }

  let body: SearchRequest;
  try {
    body = (await req.json()) as SearchRequest;
  } catch {
    return json({ error: { code: 'BAD_JSON', message: 'Body is not valid JSON.' } }, 400);
  }

  if (!body.query || body.query.trim() === '') {
    return json({ error: { code: 'MISSING_ARG', message: 'query is required.' } }, 400);
  }

  const maxPerPaper = body.max_results_per_paper ?? 3;
  const { tenantId, store } = storeFor(req);
  const needsCookie = !req.headers.get('x-session-id') && !(req.headers.get('cookie') ?? '').includes('lattice_sid=');
  const library = await listKeys(store, 'papers/');

  const perPaper: Array<{ paper_id: string; hits: Array<{ page: number; score: number; snippet: string }> }> = [];
  let totalHits = 0;

  for (const key of library) {
    if (!key.endsWith('/text.json')) continue;
    const paperId = key.split('/')[1]!;

    // For snippets we need the full text.
    const textMeta = await store.getWithMetadata(`papers/${paperId}/text.json`, { type: 'json' });
    const pages = textMeta ? (textMeta.data as { pages: PageText[] }).pages : [];
    const pageTextByNumber = new Map<number, string>();
    for (const p of pages) pageTextByNumber.set(p.page_number, p.text);

    // The term index lives in index.json; build one on the fly for
    // papers ingested before the index was written (or by hand).
    let index: SearchIndex | null = null;
    const indexMeta = await store.getWithMetadata(`papers/${paperId}/index.json`, { type: 'json' });
    if (indexMeta && indexMeta.data) {
      index = indexMeta.data as SearchIndex;
    } else if (pages.length > 0) {
      index = buildIndex(paperId, pages);
    }
    if (!index) continue;

    const hits = searchIndex(index, body.query, maxPerPaper);

    // Use best-term from searchIndex (h.snippet holds term with highest TF), not split[0]
    const hitsWithSnippets = hits.map((h) => ({
      page: h.page,
      score: h.score,
      snippet: snippetAroundTermInText(pageTextByNumber.get(h.page) ?? '', h.snippet, 80),
    }));

    if (hitsWithSnippets.length > 0) {
      perPaper.push({ paper_id: paperId, hits: hitsWithSnippets });
      totalHits += hitsWithSnippets.length;
    }
  }

  return json({ query: body.query, total_hits: totalHits, per_paper: perPaper });
};

async function listKeys(store: ReturnType<typeof getStore>, prefix: string): Promise<string[]> {
  try {
    const { blobs } = await store.list({ prefix });
    return blobs.map((b) => b.key);
  } catch {
    return [];
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  path: '/api/papers/search',
  method: 'POST',
};
