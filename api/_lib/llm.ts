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
import { modelOrder } from './model-pool';
import { safeFetch } from './url-guard';

const DEFAULT_KEY = 'latticex';

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
  let lastErr: Error | null = null;
  for (const model of modelOrder()) {
    try {
      const res = await safeFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getKey()}`,
        },
        body: JSON.stringify({
          model,
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
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string | null; reasoning?: string } }>;
      };
      const msg = data.choices?.[0]?.message;
      const out = msg?.content ?? msg?.reasoning ?? '';
      if (out.trim() !== '' && !isMetaPreamble(out, prompt)) return out;
      // A live model that answered with nothing — or with its own
      // planning notes ("The user wants me to summarize…") instead
      // of the answer — is as useless as a dead one: continue the
      // pool rather than shipping the model's thoughts as prose.
      lastErr = new Error(`model ${model} returned unusable content`);
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error('every model in the pool failed');
}

/**
 * Detect reasoning models that leak their planning as content.
 * These preambles talk ABOUT the request ("The user wants…",
 * "I need to…", "Let me…") instead of answering it. A real
 * answer quotes the subject matter, not the assignment.
 */
function isMetaPreamble(answer: string, prompt: string): boolean {
  const head = answer.slice(0, 240).toLowerCase();
  const metaMarkers = [
    'the user wants',
    'the user is asking',
    'i need to',
    'i should',
    'i will now',
    'let me ',
    'we need to',
    'my task is',
    'the prompt asks',
    'the request is',
  ];
  if (metaMarkers.some((m) => head.includes(m))) {
    // Only reject when the head lacks the requested content: a
    // genuine answer may quote "the user" from the source. If the
    // answer's opening also mirrors the prompt's own opening
    // words, it is restating the assignment, not answering it.
    const promptHead = prompt.slice(0, 60).toLowerCase();
    const answerHead = answer.slice(0, 60).toLowerCase();
    const sharesOpening =
      promptHead
        .split(/\W+/)
        .filter((w) => w.length > 4)
        .filter((w) => answerHead.includes(w)).length >= 2;
    return sharesOpening || head.includes('the user wants') || head.includes('my task');
  }
  return false;
}
