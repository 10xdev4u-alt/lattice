/**
 * /api/sessions/<id> — return a saved session by id.
 *
 * For the demo, reads from the same Blobs store the Lattice client
 * uses and returns the session JSON. In a real deploy, this would
 * be scoped to the user.
 */

import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const id = new URL(req.url).pathname.match(/\/api\/sessions\/([^/]+)/)?.[1];
  if (!id) {
    return new Response(JSON.stringify({ error: { code: 'BAD_PATH', message: 'Missing session id.' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const store = getStore('lattice');
  const blob = await store.get(`sessions/${id}.json`);
  if (!blob) {
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No such session.' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const session = await blob.json();
  return new Response(JSON.stringify(session), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  path: '/api/sessions/:id',
  method: 'GET',
};
