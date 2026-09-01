/**
 * /api/papers/<id>/file — stream the ingested PDF.
 *
 * Used by the PDF viewer in the canvas. Returns the source PDF as
 * application/octet-stream with a permissive CORS header so pdf.js
 * can fetch it from the same origin.
 *
 * Closes the polish item: real PDF rendering in the canvas.
 */

import type { Config, Context } from './_lib/types';
import { storeFor } from './_lib/session';

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const id = new URL(req.url).pathname.match(/\/api\/papers\/([^/]+)\/file/)?.[1];
  if (!id) {
    return new Response(JSON.stringify({ error: { code: 'BAD_PATH', message: 'Missing paper id.' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { store } = storeFor(req);
  const meta = await store.getWithMetadata(`papers/${id}/source.pdf`);
  if (!meta) {
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No PDF for that paper.' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // The blob data is a string (the default type). Reconstruct as an
  // ArrayBuffer to return as a binary response. pdfjs-dist on the
  // client side fetches it directly; the binary content is preserved.
  const bytes = new Uint8Array(meta.data.length);
  for (let i = 0; i < meta.data.length; i++) bytes[i] = meta.data.charCodeAt(i);
  return new Response(bytes, {
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
