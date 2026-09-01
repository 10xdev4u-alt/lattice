#!/usr/bin/env node
/**
 * server.mjs — the Lattice server.
 *
 * One process serves everything:
 *   - /api/*  → the function modules in api/ (each exports
 *               `default` and `config { path, method }`)
 *   - /*      → the built static site in dist/
 *
 * The WebMCP security headers (origin isolation + tools
 * permissions policy) apply to every response. Run with
 * `npm run start` or inside the Docker image.
 */

import { createReadStream, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const API_DIR = join(__dirname, 'dist-api');
const PORT = Number(process.env.PORT ?? 8888);

// Generate a fresh lattice_sid when the request doesn't already
// have one (cookie or x-session-id). The handler then prefixes its
// own keys; this header mints the cookie so subsequent calls land
// in the same namespace.
function ensureTenantCookie(req) {
  if (req.headers.get('x-session-id')) return null;
  const cookie = req.headers.get('cookie') ?? '';
  if (/(?:^|;\s*)lattice_sid=/.test(cookie)) return null;
  const rand = Math.random().toString(36).slice(2, 10);
  const tid = `t_${Date.now().toString(36)}_${rand}`;
  const secure = new URL(req.url).protocol === 'https:';
  const flags = ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000'];
  if (secure) flags.push('Secure');
  return `${tid}; ${flags.join('; ')}`;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

/** WebMCP: every response needs these. */
function webmcpHeaders(res = new Response()) {
  res.headers.set('Origin-Agent-Cluster', '?1');
  res.headers.set('Permissions-Policy', 'tools=(self)');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

// ---------------------------------------------------------------------------
// API routing
// ---------------------------------------------------------------------------

/** /api/sessions/:id → /^\/api\/sessions\/(?<id>[^/]+)$/ */
function pathToRegex(path) {
  const pattern = path
    .split('/')
    .map((seg) =>
      seg.startsWith(':') ? `(?<${seg.slice(1)}>[^/]+)` : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  return new RegExp(`^${pattern}$`);
}

async function loadRoutes() {
  const routes = [];
  async function walk(dir, prefix) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), `${prefix}/${entry.name}`);
      } else if ((entry.name.endsWith('.mjs') || entry.name.endsWith('.js')) && !entry.name.startsWith('_')) {
        const mod = await import(`file://${join(dir, entry.name)}`);
        if (mod.default && mod.config?.path) {
          routes.push({
            regex: pathToRegex(mod.config.path),
            method: (mod.config.method ?? 'GET').toUpperCase(),
            handler: mod.default,
            file: `${prefix}/${entry.name}`,
          });
        }
      }
    }
  }
  await walk(API_DIR, 'api');
  return routes;
}

async function handleApi(req, routes) {
  const { pathname } = new URL(req.url);
  for (const route of routes) {
    if (route.method !== 'ANY' && req.method !== route.method) continue;
    const match = pathname.match(route.regex);
    if (!match) continue;
    const ctx = { params: match.groups ?? {} };
    try {
      const res = await route.handler(req, ctx);
      return webmcpHeaders(res);
    } catch (err) {
      console.error(`[api] ${route.file} error:`, err);
      return webmcpHeaders(
        new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'Handler error.' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

function streamFile(filePath) {
  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream), {
    headers: { 'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream' },
  });
}

async function serveStatic(pathname) {
  // The marketing story first: / serves the landing page, the
  // workspace lives at /app/. Both exist in dist/.
  if (pathname === '/' || pathname === '/app' || pathname === '/app/') {
    const file = pathname === '/' ? 'landing.html' : 'index.html';
    try {
      const html = await readFile(join(DIST, file));
      return webmcpHeaders(
        new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
      );
    } catch {
      // fall through to normal resolution
    }
  }
  // Normalize and keep the path under dist/.
  let rel = normalize(decodeURIComponent(pathname)).replace(/^([.][.][/\\])+/, '');
  let filePath = join(DIST, rel);
  if (!filePath.startsWith(DIST)) return null;
  try {
    const st = await stat(filePath);
    if (st.isDirectory()) {
      filePath = join(filePath, 'index.html');
      if (!existsSync(filePath)) return null;
    }
    return webmcpHeaders(streamFile(filePath));
  } catch {
    // SPA fallback: unknown non-asset paths get index.html
    if (!extname(pathname)) {
      try {
        const index = await readFile(join(DIST, 'index.html'));
        return webmcpHeaders(
          new Response(index, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
        );
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const routes = await loadRoutes();
console.log(`[server] ${routes.length} api routes loaded`);

const httpServer = createServer(async (incoming, res) => {
  try {
    const url = `http://${incoming.headers.host ?? 'localhost'}${incoming.url}`;
    const request = new Request(url, {
      method: incoming.method,
      headers: incoming.headers,
      body: ['GET', 'HEAD'].includes(incoming.method) ? undefined : incoming,
      // @ts-expect-error Node 20+ streams the request body when set.
      duplex: 'half',
    });

    let response;
    if (url.includes('/api/')) {
      response = await handleApi(request, routes);
      // Mint a fresh lattice_sid for first-time callers so the
      // tenant prefix is stable across reloads. Skip for /api/healthz
      // so probes don't get cookies.
      if (response && !url.includes('/api/healthz')) {
        const cookieVal = ensureTenantCookie(request);
        if (cookieVal) {
          const headers = new Headers(response.headers);
          headers.append('Set-Cookie', `lattice_sid=${cookieVal}`);
          response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        }
      }
    }
    if (!response) response = await serveStatic(new URL(url).pathname);
    if (!response) {
      response = webmcpHeaders(
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }

    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error('[server] request error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'Server error.' } }));
  }
});

httpServer.listen(PORT, () => {
  console.log(`[server] lattice listening on http://localhost:${PORT}`);
});
