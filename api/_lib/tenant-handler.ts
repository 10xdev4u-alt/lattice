/**
 * Shared handler wrapper — every api/papers-*.ts uses this to
 * resolve the tenant store + (on first hit) mint a fresh
 * lattice_sid cookie. Keeps the audit C1 fix uniform.
 */
import { COOKIE_NAME, getTenantId, generateTenantId, tenantSetCookieHeader, storeFor } from './session';
import type { getStore } from './store';

export interface HandlerCtx {
  tenantId: string | null;
  store: ReturnType<typeof getStore>;
  responseInit?: ResponseInit;
}

/** Build a Response augmented with the Set-Cookie header if a new
 *  tenant was minted. */
export function withTenantCookie(req: Request, init: ResponseInit, tenantId: string): ResponseInit {
  const headers = new Headers(init.headers);
  headers.append('Set-Cookie', tenantSetCookieHeader(req, tenantId));
  return { ...init, headers };
}

/** Wrap a handler. Mints a tenant if none is present so every
 *  request lands in its own namespace. */
export function tenantHandler(
  req: Request,
  handle: (ctx: HandlerCtx) => Promise<Response> | Response,
): Promise<Response> {
  return (async () => {
    const existing = getTenantId(req);
    let tenantId = existing;
    let resInit: ResponseInit = {};
    if (!tenantId) {
      tenantId = generateTenantId();
      resInit = withTenantCookie(req, resInit, tenantId);
    }
    const ctx: HandlerCtx = { tenantId, store: storeFor(req).store, responseInit: resInit };
    const res = await handle(ctx);
    // Always re-attach the cookie so a freshly minted tenant sticks
    // even if the handler built its own response init.
    if (!existing) {
      const headers = new Headers(res.headers);
      const hasCookie = [...headers.entries()].some(([k]) => k.toLowerCase() === 'set-cookie' && (res.headers.get('set-cookie') ?? '').includes(COOKIE_NAME));
      if (!hasCookie) headers.append('Set-Cookie', tenantSetCookieHeader(req, tenantId!));
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }
    return res;
  })();
}
