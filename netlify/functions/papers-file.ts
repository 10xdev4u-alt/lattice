/**
 * /api/papers/<id>/file — stream the ingested PDF.
 *
 * Used by the PDF viewer in the canvas. Returns the source PDF as
 * application/octet-stream with a permissive CORS header so pdf.js
 * can fetch it from the same origin.
 *
 * Closes the polish item: real PDF rendering in the canvas.
 */

import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const id = new URL(req.url).pathname.match(/\/api\/papers\/([^/]+)\/file/)?.[1];
  if (!id) {
    return new Response(JSON.stringify({ error: { code: 'BAD_PATH', message: 'Missing paper id.' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const store = getStore('lattice');
  const blob = await store.get(`papers/${id}/source.pdf`, { type: 'application/pdf' });
  if (!blob) {
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No PDF for that paper.' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${id}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

export const config: Config = {
  path: '/api/papers/:id/file',
  method: 'GET',
};
