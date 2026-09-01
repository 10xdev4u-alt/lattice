/**
 * /api/papers/<id>/text — the extracted, paginated text.
 *
 * The reader renders this by default: arXiv ingest stores LaTeX
 * source, not PDFs, so text is the reading surface that always
 * exists (it already powers search and the LLM tools). The PDF
 * path in the viewer layers on top only when a source PDF was
 * uploaded.
 *
 * Resolves ids loosely: "arxiv:1706.03762" and
 * "arxiv-170603762v7" both find the stored paper.
 */

import type { Config, Context } from './_lib/types';
import { resolvePaperId } from './_lib/store';
import { storeFor } from './_lib/session';

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const id = new URL(req.url).pathname.match(/\/api\/papers\/([^/]+)\/text/)?.[1];
  if (!id) {
    return json({ error: { code: 'BAD_PATH', message: 'Missing paper id.' } }, 400);
  }
  const { store } = storeFor(req);
  const resolved = await resolvePaperId(store, id);
  if (!resolved) {
    return json({ error: { code: 'NOT_FOUND', message: 'No extracted text for that paper.' } }, 404);
  }
  const meta = await store.getWithMetadata(`papers/${resolved}/text.json`, { type: 'json' });
  if (!meta) {
    return json({ error: { code: 'NOT_FOUND', message: 'No extracted text for that paper.' } }, 404);
  }
  return json(meta.data);
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', ...extraHeaders });
  return new Response(JSON.stringify(body), { status, headers });
}

export const config: Config = {
  path: '/api/papers/:id/text',
  method: 'GET',
};
