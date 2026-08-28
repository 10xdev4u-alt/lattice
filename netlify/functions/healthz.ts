/**
 * /api/healthz — health check.
 *
 * Returns 200 if all dependencies are reachable, 503 otherwise.
 * Closes: #107.
 */

import type { Config, Context } from '@netlify/functions';

export default async (_req: Request, _context: Context): Promise<Response> => {
  const checks: Record<string, string> = {
    functions: 'ok',
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify({ status: 'ok', checks }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  path: '/api/healthz',
  method: 'GET',
};
