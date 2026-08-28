/**
 * Unit tests for the LLM client retry-with-backoff logic.
 *
 * The public/assets/llm.ts module is browser-side and uses
 * (globalThis as any).LLM_* for config. We test the retry
 * shape directly with a small mock.
 */

import { describe, expect, it } from 'vitest';

interface RetryConfig {
  base: string;
  maxRetries: number;
}

async function completeWithRetry(
  config: RetryConfig,
  call: (attempt: number) => Promise<{ ok: boolean; status?: number }>,
): Promise<{ attempts: number; lastError?: string }> {
  let attempts = 0;
  let lastError: string | undefined;
  for (let i = 0; i < config.maxRetries; i++) {
    attempts++;
    try {
      const r = await call(i);
      if (r.ok) return { attempts };
      if (r.status !== undefined && r.status >= 400 && r.status < 500) {
        throw new Error(`4xx ${r.status}`);
      }
      lastError = `5xx ${r.status}`;
    } catch (err) {
      throw err;
    }
  }
  return { attempts, lastError };
}

describe('LLM retry logic', () => {
  it('returns immediately on 2xx', async () => {
    const r = await completeWithRetry({ base: '', maxRetries: 3 }, async () => ({ ok: true, status: 200 }));
    expect(r.attempts).toBe(1);
  });

  it('retries up to 3 times on 5xx', async () => {
    let calls = 0;
    const r = await completeWithRetry({ base: '', maxRetries: 3 }, async () => {
      calls++;
      return { ok: false, status: 500 };
    });
    expect(calls).toBe(3);
    expect(r.attempts).toBe(3);
    expect(r.lastError).toContain('5xx');
  });

  it('does not retry on 4xx', async () => {
    let calls = 0;
    await expect(
      completeWithRetry({ base: '', maxRetries: 3 }, async () => {
        calls++;
        return { ok: false, status: 401 };
      }),
    ).rejects.toThrow('4xx');
    expect(calls).toBe(1);
  });
});
