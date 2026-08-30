/**
 * /api/llm — a same-origin proxy for the LLM.
 *
 * The browser can't call api.kilo.ai directly (no
 * Access-Control-Allow-Origin on their end), so every client-side
 * LLM call goes through this Function instead. The Function
 * forwards the request server-side, where CORS doesn't apply, and
 * streams the response back.
 *
 * SSRF posture: the upstream base is one of a fixed set of
 * compile-time constants (see _lib/gateway.ts). LATTICE_LLM_BASE
 * selects among them by exact match and nothing else; the request
 * body can only choose the model string (validated against a
 * vendor-charset regex). The URL passed to fetch is therefore a
 * constant for any given deployment, and assertUrlAllowed
 * re-validates the resolved host as a second gate.
 */

import type { Config, Context } from './_lib/types';
import { resolveGatewayBase } from './_lib/gateway';
import { UrlNotAllowedError, assertUrlAllowed } from './_lib/url-guard';

// Model ids are vendor strings: letters, digits, dashes, dots,
// colons, slashes, underscores. Anything else (newlines, header
// syntax) is rejected before it reaches the upstream request.
const MODEL_RE = /^[A-Za-z0-9._:/-]{1,128}$/;

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }

  let body: {
    model?: string;
    messages?: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: { code: 'BAD_JSON', message: 'Body is not valid JSON.' } }, 400);
  }

  const key = process.env.LATTICE_LLM_KEY ?? 'latticex';
  const model = body.model ?? process.env.LATTICE_LLM_MODEL ?? 'poolside-laguna-free';
  if (!MODEL_RE.test(model)) {
    return json({ error: { code: 'BAD_MODEL', message: 'Invalid model id.' } }, 400);
  }

  const base = resolveGatewayBase();
  if (!base) {
    return json(
      {
        error: {
          code: 'GATEWAY_NOT_ALLOWED',
          message: 'LATTICE_LLM_BASE is not one of the allowed gateway bases.',
        },
      },
      400,
    );
  }

  let upstream: Response;
  try {
    const target = await assertUrlAllowed(`${base}/chat/completions`);
    upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        max_tokens: body.max_tokens ?? 800,
        temperature: body.temperature ?? 0.2,
        stream: body.stream ?? false,
      }),
    });
  } catch (err) {
    if (err instanceof UrlNotAllowedError) {
      return json(
        { error: { code: 'GATEWAY_NOT_ALLOWED', message: 'The gateway address is blocked.' } },
        400,
      );
    }
    throw err;
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return json(
      { error: { code: 'LLM_UPSTREAM', message: `Upstream ${upstream.status}: ${text.slice(0, 300)}` } },
      502,
    );
  }

  // Pass the upstream body through unchanged so the client sees the
  // same shape (including SSE chunks when stream=true).
  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
  return new Response(upstream.body, { status: 200, headers });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  path: '/api/llm',
  method: 'POST',
};
