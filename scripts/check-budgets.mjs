#!/usr/bin/env node
/**
 * Budgets — fails CI if the initial bundle grows past the SAAS
 * targets. Keeps Lattice fast on first paint.
 *
 * JS 34K gzip, CSS 12K gzip, total initial 50K. The pdf worker
 * (1.4M) must NOT be in the initial chunk — it's lazy-loaded.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = 'dist/assets';
const LIMITS = { js: 36_864, css: 12_288, total: 51_200 };

function find(prefix, suffix) {
  try {
    const candidates = readdirSync(DIST).filter((f) => f.startsWith(prefix) && f.endsWith(suffix));
    // Main bundle is ~120K; web-llm chunk is 5.8M — pick the smallest index-*.js
    candidates.sort((a, b) => statSync(join(DIST, a)).size - statSync(join(DIST, b)).size);
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

const jsFile = find('index-', '.js');
const cssFile = find('index-', '.css');
if (!jsFile) {
  console.error('[budgets] no index-*.js in dist/assets — run npm run build first');
  process.exit(1);
}
if (!cssFile) {
  console.error('[budgets] no index-*.css in dist/assets — run npm run build first');
  process.exit(1);
}
const jsGz = gzipSync(readFileSync(join(DIST, jsFile))).length;
const cssGz = gzipSync(readFileSync(join(DIST, cssFile))).length;
const total = jsGz + cssGz;

console.log(`[budgets] js gzip ${jsGz} / ${LIMITS.js}  css gzip ${cssGz} / ${LIMITS.css}  total ${total} / ${LIMITS.total}`);
let failed = false;
if (jsGz > LIMITS.js) { console.error(`[budgets] FAIL: js gzip ${jsGz} > ${LIMITS.js}`); failed = true; }
if (cssGz > LIMITS.css) { console.error(`[budgets] FAIL: css gzip ${cssGz} > ${LIMITS.css}`); failed = true; }
if (total > LIMITS.total) { console.error(`[budgets] FAIL: total ${total} > ${LIMITS.total}`); failed = true; }

// Ensure the pdf worker is NOT in the initial HTML
const html = readFileSync('dist/index.html', 'utf8');
if (html.includes('pdf.worker')) {
  console.error('[budgets] FAIL: pdf.worker eagerly loaded in index.html — must be lazy');
  failed = true;
}
if (failed) process.exit(1);
console.log('[budgets] pass');
