/**
 * Regression: handler params must match what the body references.
 *
 * papers-index.ts once declared `(_req, _ctx)` but called
 * storeFor(req) — the underscore told esbuild/typescript the
 * param was unused, the body used it anyway, and because api/
 * was never in tsconfig's include list, the bug shipped and
 * /api/papers 500'd on every call ("req is not defined") while
 * the client silently showed an empty library.
 *
 * These tests pin both layers: every api handler's source
 * references only params it declares, and tsconfig includes
 * the api directory.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API_DIR = 'api';

function defaultHandlerSource(file: string): string | null {
  const src = readFileSync(join(API_DIR, file), 'utf8');
  const m = src.match(/export default async \(([^)]*)\)[^{]*\{([\s\S]*)\n\};?\s*$/);
  return m && m[2] ? m[2] : null;
}

describe('api handler param bindings', () => {
  it('every handler body references only declared params', () => {
    const failures: string[] = [];
    for (const file of readdirSync(API_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const src = readFileSync(join(API_DIR, file), 'utf8');
      const sig = src.match(/export default async \(([^)]*)\)/)?.[1] ?? '';
      const declared = new Set(
        sig.split(',').map((p) => p.trim().split(/[:=]/)[0]?.trim()).filter((p): p is string => !!p),
      );
      const body = defaultHandlerSource(file);
      if (!body) continue;
      // Find bare identifiers used in the body that shadow
      // undeclared param names — the `req` in storeFor(req) case.
      for (const candidate of ['req', 'ctx', 'context', 'request']) {
        if (body.includes(`(${candidate})`) || body.includes(` ${candidate}.`) || body.includes(`(${candidate},`)) {
          if (!declared.has(candidate) && !declared.has(`_${candidate}`)) continue;
          if (!declared.has(candidate)) {
            failures.push(`${file}: uses ${candidate} but declares _${candidate}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('tsconfig includes the api directory', () => {
    const tsconfig = readFileSync('tsconfig.json', 'utf8');
    expect(tsconfig).toContain('"api/**/*.ts"');
  });

  it('papers-index declares req (not _req)', () => {
    const src = readFileSync(join(API_DIR, 'papers-index.ts'), 'utf8');
    expect(src).toMatch(/export default async \(req: Request/);
    expect(src).toContain('storeFor(req)');
  });
});
