/**
 * /api/llm — a same-origin proxy for the LLM.
 *
 * The browser can't call api.kilo.ai directly (no
 * Access-Control-Allow-Origin on their end), so every client-side
 * LLM call goes through this Function instead. The Function forwards
 * the request server-side, where CORS doesn't apply, and streams the
 * response back.
 *
 * The upstream gateway is locked to an allowlist so the Function
 * can't be repurposed as an open relay to arbitrary hosts.
 */

import type { Config, Context } from '@netlify/functions';

// Only these gateways may be proxied. LATTICE_LLM_BASE must resolve
// to one of them (scheme + host, path ignored).
const ALLOWED_GATEWAYS = [
  'https://api.kilo.ai',
  'https://api.openai.com',
  'https://api.anthropic.com',
];

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

  const base = process.env.LATTICE_LLM_BASE ?? 'https://api.kilo.ai/api/gateway/v1';
  const gateway = new URL(base);
  if (!ALLOWED_GATEWAYS.includes(gateway.origin)) {
    return json(
      {
        error: {
          code: 'GATEWAY_NOT_ALLOWED',
          message: `LATTICE_LLM_BASE must be one of: ${ALLOWED_GATEWAYS.join(', ')}`,
        },
      },
      400,
    );
  }

  const key = process.env.LATTICE_LLM_KEY ?? 'latticex';
  const model = body.model ?? process.env.LATTICE_LLM_MODEL ?? 'poolside-laguna-free';

  const upstream = await fetch(`${gateway.origin}${gateway.pathname.replace(/\/$/, '')}/chat/completions`, {
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
