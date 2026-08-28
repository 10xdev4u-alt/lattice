/**
 * Unit tests for the rate limiter.
 *
 * The real rate limiter lives in netlify/functions/_lib/rate-limit.ts
 * and uses a module-scoped Map. We import it and exercise the
 * short-window and long-window rules.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { checkRateLimit } from '../netlify/functions/_lib/rate-limit';

describe('rate limiter', () => {
  it('allows up to 60 calls per minute', () => {
    for (let i = 0; i < 60; i++) {
      const r = checkRateLimit(`sess_${i}_allow`);
      expect(r.ok).toBe(true);
    }
    const r = checkRateLimit('sess_overflow');
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBe(60);
  });

  it('uses independent sessions', () => {
    for (let i = 0; i < 60; i++) checkRateLimit('sess_a');
    expect(checkRateLimit('sess_a').ok).toBe(false);
    expect(checkRateLimit('sess_b').ok).toBe(true);
  });
});
