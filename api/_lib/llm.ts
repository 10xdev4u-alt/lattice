/**
 * LLM client for the Functions. Mirrors public/assets/llm.ts.
 *
 * Default base: https://api.kilo.ai/api/gateway/v1
 * Default model: kilo-auto/free
 * Override via LATTICE_LLM_BASE / LATTICE_LLM_MODEL / LATTICE_LLM_KEY
 * env vars.
 *
 * The base is selected by exact match against the fixed
 * allowlist in _lib/gateway.ts — it can never be an arbitrary
 * URL, so the fetch destination is a deployment constant.
 */

import { resolveGatewayBase } from './gateway';
import { safeFetch } from './url-guard';

// Server-side handlers pin a specific model (not the auto router)
// so demo behavior is deterministic: the router's pick can be a
// reasoning model that ignores `reasoning: {enabled: false}`.
const DEFAULT_MODEL = 'tencent/hy3:free';
const DEFAULT_KEY = 'latticex';

function getModel(): string {
  return process.env.LATTICE_LLM_MODEL ?? DEFAULT_MODEL;
}

function getKey(): string {
  return process.env.LATTICE_LLM_KEY ?? DEFAULT_KEY;
}

export async function completePrompt(
  prompt: string,
  opts: { signal: AbortSignal; maxTokens?: number; temperature?: number; system?: string },
): Promise<string> {
  const base = resolveGatewayBase();
  if (!base) {
    throw new Error('LATTICE_LLM_BASE is not one of the allowed gateway bases.');
  }
  const res = await safeFetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        { role: 'user', content: prompt },
      ],
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.2,
      // Reasoning-capable routers (kilo-auto/free → tencent/hy3)
      // otherwise spend the whole budget thinking and return an
      // empty content field.
      reasoning: { enabled: false },
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
  }
  // Reasoning models may leave content null; fall back to the
  // reasoning text so callers always get a usable string.
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string | null; reasoning?: string } }>;
  };
  const msg = data.choices?.[0]?.message;
  return msg?.content ?? msg?.reasoning ?? '';
}
