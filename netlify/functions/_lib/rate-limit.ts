/**
 * Rate limit and request logging — the in-memory LRU.
 *
 * Per-session counts: 60 calls per minute, 1000 calls per hour. When
 * exceeded, the Function returns 429 with a Retry-After header.
 *
 * Also logs every call with timestamp, session id (from a cookie or
 * x-session-id header), tool name, duration, status, and a rough
 * token estimate. The logs go to stdout; Netlify aggregates them.
 */

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
}

export function checkRateLimit(sessionId: string, now: number = Date.now()): RateLimitResult {
  // Evict stale sessions
  for (const [id, bucket] of SESSIONS) {
    const fresh = bucket.timestamps.filter((t) => now - t < SESSION_TTL_MS);
    if (fresh.length === 0) {
      SESSIONS.delete(id);
    } else {
      bucket.timestamps = fresh;
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
    return { ok: false, retryAfterSeconds: 60 };
  }
  const lastHour = bucket.timestamps.filter((t) => now - t < WINDOW_LONG_MS).length;
  if (lastHour > LIMIT_LONG) {
    return { ok: false, retryAfterSeconds: 600 };
  }

  return { ok: true };
}

export function logCall(record: {
  sessionId: string;
  tool: string;
  durationMs: number;
  status: number;
  tokenEstimate?: number;
}): void {
  // One-line JSON for easy Netlify log aggregation.
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

export function sessionIdFromRequest(req: Request): string {
  // Prefer an explicit header set by the client; fall back to a
  // session cookie if present; else a synthetic one for the demo.
  return (
    req.headers.get('x-session-id') ??
    parseCookie(req.headers.get('cookie') ?? '').session ??
    'anon'
  );
}

function parseCookie(cookie: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}
