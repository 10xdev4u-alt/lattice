#!/usr/bin/env node
/**
 * dev.mjs — run the client (vite) and the API server together.
 *
 * Vite serves the client on :5173 and proxies /api to the server
 * on :8888 (see vite.config.ts). The API server serves dist-api/
 * (built by scripts/build-api.mjs --watch rebuilds it on change).
 */

import { spawn } from 'node:child_process';

const procs = [];

function run(cmd, args, name) {
  const p = spawn(cmd, args, { stdio: 'inherit' });
  p.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[dev] ${name} exited with ${code}`);
  });
  procs.push(p);
}

// Build the API once, then watch for changes.
run('node', ['scripts/build-api.mjs'], 'build-api');
run('node', ['--watch', '--enable-source-maps', 'server.mjs'], 'server');
run('npx', ['vite'], 'vite');

function shutdown() {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
