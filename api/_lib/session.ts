/**
 * Session tenancy — the HttpOnly lattice_sid cookie only.
 *
 * The x-session-id header path was removed: tenant ids are
 * timestamp-structured and guessable-ish, and a spoofable header
 * beat the cookie, letting a curl claim any tenant's namespace.
 * Curl callers send `-H 'Cookie: lattice_sid=<id>'` instead.
 */

import type { getStore} from './store';
import { getTenantStore } from './store';

export const COOKIE_NAME = 'lattice_sid';

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k.trim()] = decodeURIComponent(rest.join('=').trim());
  }
  return out;
}

/** Tenant id from the HttpOnly cookie ONLY. Headers are never
 *  trusted for identity — a spoofed x-session-id must not read
 *  another tenant's namespace. */
export function getTenantId(req: Request): string | null {
  const cookies = parseCookies(req.headers.get('cookie'));
  const c = cookies[COOKIE_NAME];
  if (c && /^[a-zA-Z0-9_-]{8,64}$/.test(c)) return c;
  return null;
}

export function tenantPrefix(tenantId: string): string {
  const safe = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return `${safe}/`;
}

export function generateTenantId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `t_${Date.now().toString(36)}_${rand}`;
}

/**
 * Response headers for cookie issuance. Sets HttpOnly + SameSite=Lax
 * for one year. Secure flag is added when the request arrived over
 * https so localhost dev still works.
 */
export function tenantSetCookieHeader(req: Request, tenantId: string): string {
  const secure = new URL(req.url).protocol === 'https:';
  const flags = ['HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${60 * 60 * 24 * 30}`];
  if (secure) flags.push('Secure');
  return `${COOKIE_NAME}=${tenantId}; ${flags.join('; ')}`;
}

/**
 * Resolve a tenant-scoped store for a request. When the request has
 * a valid tenant cookie/header the caller's keys are prefixed
 * automatically. Callers that need to know the prefix (e.g. to
 * construct response URLs) can read `tenantId` and call
 * `tenantPrefix(tenantId)` themselves.
 */
export function storeFor(req: Request) {
  const tenantId = getTenantId(req);
  return { tenantId, store: getTenantStore('lattice', tenantId) };
}

/**
 * Legacy fallback: if a global paper is requested but the tenant
 * has none, copy on first read so existing data is reachable.
 * Returns the paperId actually present under this tenant.
 */
export async function resolveTenantPaper(
  store: ReturnType<typeof getStore>,
  paperId: string,
  tenantId: string | null,
): Promise<string | null> {
  if (tenantId) {
    // Direct lookup under tenant prefix.
    const direct = await store.getWithMetadata(`${paperId}/text.json`, { type: 'json' });
    if (direct) return paperId;
    // Cross-id resolution (arxiv:1706.03762 -> arxiv-170603762v7).
    const core = (id: string): string => id.replace(/v\d+$/i, '').replace(/[^0-9]/g, '');
    const want = core(paperId);
    if (want.length < 4) return null;
    const { blobs } = await store.list({ prefix: '' });
    for (const blob of blobs) {
      const id = blob.key.split('/')[0];
      if (!id) continue;
      if (core(id) === want) return id;
    }
    return null;
  }
  // Global (legacy).
  const { resolvePaperId: legacyResolve } = await import('./store');
  return legacyResolve(store, paperId);
}

