#!/usr/bin/env node
/**
 * lint-tools.mjs — check every WebMCP tool against the spec budgets.
 *
 * - name <= 30 chars
 * - description <= 500 chars
 * - snake_case verb_noun
 *
 * Scans the .ts files under public/assets/tools/ and reports violations.
 * Wired into `npm run lint:tools` and CI.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(__dirname, '..', 'public', 'assets', 'tools');

const LIMITS = {
  name: 30,
  description: 500,
  paramDescription: 150,
};

const errors = [];
let total = 0;

async function checkFile(path) {
  const src = await readFile(path, 'utf8');
  // Crude extraction: find every `name: "<value>"` and `description: "<value>"`
  // inside a tool definition. Good enough for our hand-written files.
  const nameMatches = [...src.matchAll(/name:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const descMatches = [...src.matchAll(/description:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  // We can't reliably map description -> name without an AST, so we just
  // check each one independently.
  for (const n of nameMatches) {
    total++;
    if (n.length > LIMITS.name) {
      errors.push(`${path}: name "${n}" is ${n.length} chars (max ${LIMITS.name})`);
    }
    if (!/^[a-z][a-z0-9_]*$/.test(n)) {
      errors.push(`${path}: name "${n}" must be snake_case verb_noun`);
    }
  }
  for (const d of descMatches) {
    if (d.length > LIMITS.description) {
      errors.push(`${path}: description is ${d.length} chars (max ${LIMITS.description})`);
    }
  }
}

const files = await readdir(TOOLS_DIR);
for (const f of files) {
  if (f.endsWith('.ts') && !f.startsWith('_')) {
    await checkFile(join(TOOLS_DIR, f));
  }
}

console.log(`Checked ${total} tool name(s) and ${files.length} file(s).`);
if (errors.length > 0) {
  console.error(`\n${errors.length} violation(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('OK: all tools pass spec character budgets.');
