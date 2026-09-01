/**
 * Regression: every built dist-api module must load.
 *
 * The build-api rewrite regex once missed `await import("./x")`
 * (dynamic imports), shipping extensionless specifiers that Node
 * ESM cannot resolve. healthz swallowed the load error and
 * reported store:"error" forever. This test builds the api and
 * imports EVERY module — any specifier bug fails here, loudly.
 */

import { describe, expect, it } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
// @ts-expect-error — plain .mjs script, no declarations by design.
import { buildApiModules } from '../scripts/build-api.mjs';

async function collect(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...(await collect(join(dir, entry.name), `${prefix}${entry.name}/`)));
    } else if (entry.name.endsWith('.mjs')) {
      out.push(`${prefix}${entry.name}`);
    }
  }
  return out;
}

describe('build-api dynamic import rewriting', () => {
  it('rewrites await import("./x") to .mjs', () => {
    const rewritten = rewriteForTest(
      'const { getStore } = await import("./_lib/store");',
    );
    expect(rewritten).toContain('await import("./_lib/store.mjs")');
  });

  it('still rewrites static from-imports', () => {
    const rewritten = rewriteForTest('import { x } from "./y";');
    expect(rewritten).toContain('from "./y.mjs"');
  });

  it('leaves bare and .mjs specifiers alone', () => {
    expect(rewriteForTest('import { z } from "node:fs";')).not.toContain('node:fs.mjs');
    expect(rewriteForTest('import { a } from "./b.mjs";')).toBe(
      'import { a } from "./b.mjs";',
    );
  });

  it('every built dist-api module imports cleanly', async () => {
    await buildApiModules();
    const files = await collect('dist-api');
    expect(files.length).toBeGreaterThan(25);
    const failures: string[] = [];
    for (const f of files) {
      try {
        await import(`../dist-api/${f}`);
      } catch (err) {
        // Modules whose top level legitimately throws are none —
        // every api module is import-pure today.
        failures.push(`${f}: ${(err as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);
});

// Mirror of the production rewrite — kept in sync by importing
// the real one would require exporting it; test the regex shape.
function rewriteForTest(source: string): string {
  return source.replace(
    /(from\s+|import\s*\(?\s*)("(?:[^"]*)"|'(?:[^']*)')/g,
    (m, head: string, qspec: string) => {
      const spec = qspec.slice(1, -1);
      if (!spec.startsWith('.')) return m;
      if (spec.endsWith('.mjs')) return m;
      const base = spec.replace(/\.ts$/, '');
      return `${head}"${base}.mjs"`;
    },
  );
}
