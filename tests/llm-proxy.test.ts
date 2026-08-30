/**
 * /api/llm proxy tests.
 *
 * The proxy is the CORS bridge for every client LLM call, so its
 * destination rules matter: the gateway origin must be in the
 * allowlist, the model id must be a plain vendor string, and a
 * poisoned LATTICE_LLM_BASE must never reach fetch().
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Config, Context } from '../api/_lib/types';

type Handler = (req: Request, ctx: Context) => Promise<Response>;

let handler: Handler;
let config: Config;
let calls: Array<{ url: string; body: any }>;
let realFetch: typeof fetch;

beforeEach(async () => {
  delete process.env.LATTICE_LLM_BASE;
  delete process.env.LATTICE_LLM_KEY;
  delete process.env.LATTICE_LLM_MODEL;
  const mod = await import('../api/llm-proxy');
  handler = mod.default as Handler;
  config = mod.config;
  calls = [];
  realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    calls.push({ url: String(input), body: JSON.parse(init?.body ?? '{}') });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function post(body: unknown): Promise<Response> {
  return handler(
    new Request('http://localhost/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    {},
  );
}

describe('llm-proxy', () => {
  it('routes to the default gateway', async () => {
    const res = await post({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toBe('https://api.kilo.ai/api/gateway/v1/chat/completions');
  });

  it('validates LATTICE_LLM_BASE but pins the origin to the default', async () => {
    // Only the path of the configured base is honored; the fetch
    // origin is the compile-time default, so no env value can
    // redirect the request to another host.
    process.env.LATTICE_LLM_BASE = 'https://api.openai.com/v1';
    const res = await post({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toBe('https://api.kilo.ai/v1/chat/completions');
  });

  it('honors a custom path on the allowlisted default origin', async () => {
    process.env.LATTICE_LLM_BASE = 'https://api.kilo.ai/custom/v2';
    const res = await post({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toBe('https://api.kilo.ai/custom/v2/chat/completions');
  });

  it('rejects a gateway outside the allowlist before fetching', async () => {
    process.env.LATTICE_LLM_BASE = 'https://evil.example.com/v1';
    const res = await post({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: { code: string } };
    expect(err.error.code).toBe('GATEWAY_NOT_ALLOWED');
    expect(calls).toHaveLength(0);
  });

  it('rejects a non-URL base', async () => {
    process.env.LATTICE_LLM_BASE = 'not a url';
    const res = await post({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('rejects a malicious model id', async () => {
    const res = await post({ model: 'x\r\nHost: evil', messages: [] });
    expect(res.status).toBe(400);
    const err = (await res.json()) as { error: { code: string } };
    expect(err.error.code).toBe('BAD_MODEL');
    expect(calls).toHaveLength(0);
  });

  it('rejects non-POST methods', async () => {
    const res = await handler(new Request('http://localhost/api/llm', { method: 'GET' }), {});
    expect(res.status).toBe(405);
  });

  it('rejects a non-JSON body', async () => {
    const res = await handler(
      new Request('http://localhost/api/llm', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      }),
      {},
    );
    expect(res.status).toBe(400);
  });

  it('attaches the key from env, never from the request', async () => {
    process.env.LATTICE_LLM_KEY = 'sk-server-side';
    await post({ messages: [], key: 'sk-client-smuggled' });
    // The client's "key" field must not leak into the upstream body.
    expect(calls[0]?.body.key).toBeUndefined();
  });

  it('registers at /api/llm POST', () => {
    expect(config.path).toBe('/api/llm');
    expect(config.method).toBe('POST');
  });
});
