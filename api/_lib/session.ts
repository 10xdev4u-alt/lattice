/**
 * Session tenancy — lattice_sid cookie + x-session-id header.
 *
 * Phase 1: header-wins, cookie fallback, no HMAC. Every key under
 * papers/<tenant>/... when tenant present, else legacy papers/...
 * Keeps FS KV portable before Postgres/Oracle migration.
 */

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

export function getTenantId(req: Request): string | null {
  const hdr = req.headers.get('x-session-id');
  if (hdr && /^[a-zA-Z0-9_-]{8,64}$/.test(hdr.trim())) return hdr.trim();
  const cookies = parseCookies(req.headers.get('cookie'));
  const c = cookies[COOKIE_NAME];
  if (c && /^[a-zA-Z0-9_-]{8,64}$/.test(c)) return c;
  return null;
}

export function tenantPrefix(tenantId: string): string {
  const safe = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return `${safe}/`;
}

export function ensureSetCookieHeaders(existing: string | null, tenantId: string | null): Headers | null {
  if (tenantId) return null;
  if (existing && existing.includes(COOKIE_NAME)) return null;
  // No tenant yet — caller will set a fresh one; signal via header
  return null;
}

export function generateTenantId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `t_${Date.now().toString(36)}_${rand}`;
}
