// Consolidate the feature stylesheets into one bundle.
//
// The app loads ~29 <link> tags (tokens, base, workspace, trail,
// ...) — that many blocking requests before first paint. This
// script concatenates them in dependency order (tokens first,
// fonts with the bundle) into lattice.css and rewrites
// index.html to reference only it. Source files stay for
// editing; the build makes one request.
//
// Idempotent: when index.html already points at lattice.css, the
// script exits without touching anything.
//
// Run by `npm run build` after vite build.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const HTML = 'public/index.html';
const CSS_DIR = 'public/assets/styles';

// Dependency order: tokens define the custom properties everyone
// else references. The rest is feature CSS whose order only
// matters for equal-specificity conflicts, which the
// file-per-feature design avoids.
const ORDER = [
  'tokens.css',
  'fonts.css',
  'base.css',
  'workspace.css',
  'spine.css',
  'confirm.css',
  'trail.css',
  'peer.css',
  'agent-rail.css',
  'settings.css',
  'citations.css',
  'paper-list.css',
  'prisma.css',
  'scrubber.css',
  'branch-diff.css',
  'saved-searches.css',
  'cite-paper.css',
  'batch-extract.css',
  'whats-wrong.css',
  'next-action-carousel.css',
  'feedback-tab.css',
  'feedback-chart.css',
  'peer-reviewer-tab.css',
  'command-palette.css',
  'latency-chart.css',
  'audit.css',
  'trace.css',
  'response-cards.css',
  'overlays.css',
  'annotations.css',
  'batch.css',
  'branches.css',
  'context-budget.css',
  'feed.css',
  'hint.css',
  'highlights.css',
  'knowledge-graph.css',
  'session-summary.css',
  'overlay.css',
];

const html = await readFile(HTML, 'utf8');

// Consolidation state: the HTML carries exactly one styles link —
// lattice.css. Regenerate the bundle when FORCE_CSS=1 (content
// changed); skip only when the bundle also already exists.
const consolidated = html.includes('/assets/styles/lattice.css');
if (consolidated && process.env.FORCE_CSS !== '1') {
  console.log('[build:css] already consolidated — skipping (FORCE_CSS=1 to regen)');
  process.exit(0);
}
// The single link survives this run (the rewrite below is a
// no-op then); the queue is rebuilt from the ORDER list when
// the href scan finds only lattice.css.

// Collect every stylesheet href the HTML currently requests. On
// a consolidated HTML the only href is lattice.css itself —
// rebuild the queue from ORDER instead (skipping lattice.css).
const hrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
if (hrefs.length === 0 && !consolidated) {
  console.log('[build:css] no stylesheet links found — nothing to do');
  process.exit(0);
}

// Canonical order first; any referenced-but-unlisted file is
// appended (never dropped). On a consolidated HTML (single
// lattice.css link) the queue IS the ORDER list, minus the
// bundle itself.
const styled = hrefs.filter((h) => h.startsWith('/assets/styles/'));
const queue = consolidated
  ? ORDER.filter((f) => f !== 'lattice.css')
  : [
      ...ORDER.filter((f) => styled.includes(`/assets/styles/${f}`)),
      ...styled
        .filter((h) => !ORDER.some((f) => `/assets/styles/${f}` === h))
        .map((h) => h.replace('/assets/styles/', '')),
    ];

const parts = [];
for (const file of queue) {
  try {
    let css = await readFile(join(CSS_DIR, file), 'utf8');
    // Drop every comment block: interleaved markers across 38
    // concatenated files made comment boundaries the failure
    // mode (one stray closer failed the whole bundle). Comments
    // carry no styling; section provenance lives in git.
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    parts.push(`/* ${file} */\n${css.trim()}`);
  } catch {
    console.warn(`[build:css] missing ${file} (referenced, skipped)`);
  }
}

await writeFile(join(CSS_DIR, 'lattice.css'), `${parts.join('\n\n')}\n`);
const kb = Math.round(parts.join('').length / 1024);
console.log(`[build:css] ${queue.length} files -> lattice.css (${kb}KB)`);

// Rewrite the HTML: one link where the many were, preserving the
// position of the first stylesheet line.
const lines = html.split('\n');
const firstIdx = lines.findIndex((l) => l.includes('rel="stylesheet"') && l.includes('/assets/styles/'));
if (firstIdx === -1) {
  console.log('[build:css] no stylesheet lines to rewrite');
  process.exit(0);
}
const kept = lines.filter((l) => !(l.includes('rel="stylesheet"') && l.includes('/assets/styles/')));
const indent = (lines[firstIdx] || '').match(/^ */)?.[0] ?? '    ';
kept.splice(Math.min(firstIdx, kept.length), 0, `${indent}<link rel="stylesheet" href="/assets/styles/lattice.css" />`);
await writeFile(HTML, kept.join('\n'));
console.log('[build:css] index.html now requests one stylesheet');
