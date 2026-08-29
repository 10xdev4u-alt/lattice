/**
 * Unit tests for the rate limiter.
 *
 * The real rate limiter lives in netlify/functions/_lib/rate-limit.ts
 * and uses a module-scoped Map. We import it and exercise the
 * short-window and long-window rules.
 */

import { describe, expect, it } from 'vitest';
import { checkRateLimit } from '../netlify/functions/_lib/rate-limit';

describe('rate limiter', () => {
  it('allows up to 60 calls per minute', () => {
    for (let i = 0; i < 60; i++) {
      const r = checkRateLimit('sess_one');
      expect(r.ok).toBe(true);
    }
    const r = checkRateLimit('sess_one');
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBe(60);
  });

  it('uses independent sessions', () => {
    // Two different sessions can each get their full quota.
    for (let i = 0; i < 60; i++) checkRateLimit('sess_a');
    expect(checkRateLimit('sess_a').ok).toBe(false);
    // sess_b starts fresh; its first call must succeed because its
    // bucket is empty even though the global Map still has sess_a's
    // history.
    expect(checkRateLimit('sess_b').ok).toBe(true);
  });
});
