/**
 * LLM client for the Functions. Mirrors public/assets/llm.ts.
 *
 * Default base: https://api.kilo.ai/api/gateway/v1
 * Default model: poolside-laguna-free
 * Override via LATTICE_LLM_BASE / LATTICE_LLM_MODEL / LATTICE_LLM_KEY
 * env vars.
 */

const DEFAULT_BASE = 'https://api.kilo.ai/api/gateway/v1';
const DEFAULT_MODEL = 'poolside-laguna-free';
const DEFAULT_KEY = 'latticex';

import { safeFetch } from './url-guard';

function getBase(): string {
  return process.env.LATTICE_LLM_BASE ?? DEFAULT_BASE;
}

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
  const base = getBase().replace(/\/$/, '');
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
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}
