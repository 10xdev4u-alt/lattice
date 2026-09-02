// Copy the static extras into dist/ after vite build.
//
// Vite's input is public/index.html only (root: 'public',
// publicDir: false), so landing.html, share.html, the fonts
// folder, and the brand assets never reach dist/ on their own.
// Without this the deployed container 404s /landing.html and the
// fonts the SPA's CSS references. Run by `npm run build` after
// vite build.

import { cp, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve('public');
const DIST = resolve('dist');

// Static files and folders that must exist in dist/ verbatim.
// share.html is EXCLUDED: it is a vite entry (vite.config.ts
// input) — copying the source over vite's output would strip
// the hashed script tags and break the page.
const EXTRAS = [
  'landing.html',
  'landing/',
  'assets/fonts/',
  'assets/theme-guard.js',
  'favicon.svg',
  'og.svg',
];

for (const extra of EXTRAS) {
  const src = join(ROOT, extra);
  const dst = join(DIST, extra);
  await mkdir(dst.endsWith('/') ? resolve(dst, '..') : resolve(dst, '..'), {
    recursive: true,
  });
  await cp(src, dst, { recursive: true });
  console.log(`[build:static] ${extra}`);
}
console.log('[build:static] done');
