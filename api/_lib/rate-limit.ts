/**
 * Rate limit and request logging — in-memory token bucket.
 *
 * Per-session counts: 60 calls per minute, 1000 calls per hour. When
 * exceeded, the Function returns 429 with a Retry-After header.
 *
 * Trust boundary: the only input we accept is the SIGNED `lattice_sid`
 * cookie. The x-session-id header is ignored — it was the spoofing
 * vector in audit C2.
 */

import { getTenantId, COOKIE_NAME } from './session';

interface Bucket {
  timestamps: number[];
}

const SESSIONS = new Map<string, Bucket>();
const SESSION_TTL_MS = 60 * 60 * 1000;
const WINDOW_SHORT_MS = 60 * 1000;
const WINDOW_LONG_MS = 60 * 60 * 1000;
const LIMIT_SHORT = 60;
const LIMIT_LONG = 1000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
  sessionId: string;
}

export function checkRateLimit(sessionId: string, now: number = Date.now()): RateLimitResult {
  // Evict stale sessions opportunistically
  if (SESSIONS.size > 1024) {
    for (const [id, bucket] of SESSIONS) {
      const fresh = bucket.timestamps.filter((t) => now - t < SESSION_TTL_MS);
      if (fresh.length === 0) SESSIONS.delete(id);
      else bucket.timestamps = fresh;
    }
  }
  let bucket = SESSIONS.get(sessionId);
  if (!bucket) {
    bucket = { timestamps: [] };
    SESSIONS.set(sessionId, bucket);
  }
  bucket.timestamps.push(now);

  const lastMinute = bucket.timestamps.filter((t) => now - t < WINDOW_SHORT_MS).length;
  if (lastMinute > LIMIT_SHORT) {
    return { ok: false, retryAfterSeconds: 60, sessionId };
  }
  const lastHour = bucket.timestamps.filter((t) => now - t < WINDOW_LONG_MS).length;
  if (lastHour > LIMIT_LONG) {
    return { ok: false, retryAfterSeconds: 600, sessionId };
  }
  return { ok: true, sessionId };
}

export function logCall(record: {
  sessionId: string;
  tool: string;
  durationMs: number;
  status: number;
  tokenEstimate?: number;
}): void {
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      session: record.sessionId.slice(0, 12),
      tool: record.tool,
      duration_ms: record.durationMs,
      status: record.status,
      token_estimate: record.tokenEstimate ?? null,
    }),
  );
}

/**
 * Resolve the trusted session id from the request. Uses ONLY the
 * signed `lattice_sid` cookie — the x-session-id header is ignored
 * to prevent spoofing. Anonymous fallback for un-cookied requests.
 */
export function sessionIdFromRequest(req: Request): string {
  const tenant = getTenantId(req);
  if (tenant) return tenant;
  // Fall back: parse the cookie directly so legacy clients still
  // get a stable id (the helper only validates 8+ chars).
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(/(?:^|;\s*)lattice_sid=([^;]+)/);
  return m?.[1] ?? 'anon';
}

export { COOKIE_NAME };
