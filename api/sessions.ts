/**
 * /api/sessions/<id> — return a saved session by id.
 *
 * For the demo, reads from the same Blobs store the Lattice client
 * uses and returns the session JSON. In a real deploy, this would
 * be scoped to the user.
 */

import type { Config, Context } from './_lib/types';
import { getStore } from './_lib/store';

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const id = new URL(req.url).pathname.match(/\/api\/sessions\/([^/]+)/)?.[1];
  if (!id) {
    return new Response(JSON.stringify({ error: { code: 'BAD_PATH', message: 'Missing session id.' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const store = getStore('lattice');
  const meta = await store.getWithMetadata(`sessions/${id}.json`, { type: 'json' });
  if (!meta) {
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No such session.' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(meta.data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  path: '/api/sessions/:id',
  method: 'GET',
};
