/**
 * /api/llm — a same-origin proxy for the LLM.
 *
 * The browser can't call api.kilo.ai directly (no
 * Access-Control-Allow-Origin on their end), so every client-side
 * LLM call goes through this Function instead. The Function forwards
 * the request server-side, where CORS doesn't apply, and streams the
 * response back.
 *
 * The upstream gateway is validated by safeFetch: http/https only,
 * and the host must not resolve to localhost, loopback, link-local,
 * private, or reserved ranges. Any LATTICE_LLM_BASE that tries to
 * reach an internal address is rejected before the request goes out.
 */

import type { Config, Context } from './_lib/types';
import { UrlNotAllowedError, assertUrlAllowed } from './_lib/url-guard';

// The upstream origin is a compile-time constant. Operators may
// point LATTICE_LLM_BASE at any allowlisted origin to switch
// gateways; the URL built from it is validated against this list
// and only its *path* ever reaches the fetch target.
const DEFAULT_GATEWAY_ORIGIN = 'https://api.kilo.ai';
const ALLOWED_GATEWAY_ORIGINS = [
  DEFAULT_GATEWAY_ORIGIN,
  'https://api.openai.com',
  'https://api.anthropic.com',
];

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

  // Destination: a compile-time-constant origin, plus a path that
  // env may narrow to a prefix. The request body never touches
  // the URL; safeFetch re-validates the host as a second gate.
  let path: string;
  try {
    const configured = new URL(
      (process.env.LATTICE_LLM_BASE ?? 'https://api.kilo.ai/api/gateway/v1').replace(/\/$/, ''),
    );
    if (!ALLOWED_GATEWAY_ORIGINS.includes(configured.origin)) {
      return json(
        {
          error: {
            code: 'GATEWAY_NOT_ALLOWED',
            message: `LATTICE_LLM_BASE origin must be one of: ${ALLOWED_GATEWAY_ORIGINS.join(', ')}`,
          },
        },
        400,
      );
    }
    path = configured.pathname.replace(/\/$/, '');
  } catch {
    return json({ error: { code: 'GATEWAY_NOT_ALLOWED', message: 'LATTICE_LLM_BASE is not a URL.' } }, 400);
  }

  let upstream: Response;
  try {
    // Two independent gates before any bytes leave the process:
    // 1. the target is built from the compile-time default origin
    //    (env can only narrow the path), and
    // 2. assertUrlAllowed validates the resolved destination
    //    against the SSRF blocklist.
    const target = await assertUrlAllowed(`${DEFAULT_GATEWAY_ORIGIN}${path}/chat/completions`);
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
        { error: { code: 'GATEWAY_NOT_ALLOWED', message: 'LATTICE_LLM_BASE points at a blocked address.' } },
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
