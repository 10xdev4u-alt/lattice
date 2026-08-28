/**
 * LLM client — thin OpenAI-compatible wrapper.
 *
 * Default base: https://api.kilo.ai/api/gateway/v1
 * Default model: poolside-laguna-free
 * Override via LATTICE_LLM_BASE and LATTICE_LLM_MODEL env vars (or the
 * Settings panel in the UI, once it ships).
 *
 * Every prompt is sent with an AbortSignal so the model can be cancelled
 * mid-stream. Retries up to 3 times with exponential backoff on 5xx
 * and network errors. 4xx errors are not retried.
 */

const DEFAULT_BASE = 'https://api.kilo.ai/api/gateway/v1';
const DEFAULT_MODEL = 'poolside-laguna-free';
const DEFAULT_KEY = 'latticex';
const MAX_RETRIES = 3;

interface CompleteOptions {
  signal: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

function getBase(): string {
  return (globalThis as any).LATTICE_LLM_BASE ?? DEFAULT_BASE;
}

function getModel(): string {
  return (globalThis as any).LATTICE_LLM_MODEL ?? DEFAULT_MODEL;
}

function getKey(): string {
  return (globalThis as any).LATTICE_LLM_KEY ?? DEFAULT_KEY;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export async function completePrompt(prompt: string, opts: CompleteOptions): Promise<string> {
  const base = getBase().replace(/\/$/, '');
  const body = JSON.stringify({
    model: getModel(),
    messages: [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      { role: 'user', content: prompt },
    ],
    max_tokens: opts.maxTokens ?? 800,
    temperature: opts.temperature ?? 0.2,
  });

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getKey()}`,
        },
        body,
        signal: opts.signal,
      });
      if (res.status === 429) {
        // Rate limited. Surface a rate-limit event so the UI can react.
        document.dispatchEvent(new CustomEvent('lattice:rate-limited', { detail: { status: 429 } }));
        throw new Error('LLM 429: rate limit exceeded');
      }
      if (res.ok) {
        const data = (await res.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        return data.choices?.[0]?.message?.content ?? '';
      }
      if (res.status >= 400 && res.status < 500) {
        const text = await res.text();
        throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
      }
      lastErr = new Error(`LLM ${res.status}`);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      lastErr = err as Error;
    }
    const backoffMs = 250 * 2 ** attempt;
    await sleep(backoffMs, opts.signal);
  }
  throw lastErr ?? new Error('LLM request failed');
}
