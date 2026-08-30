// Build-time transpile of api/*.ts → dist-api/**/*.mjs.
//
// The functions are authored in TypeScript; the server runtime
// imports plain ESM, so this script strips types with esbuild
// (already in the tree via vite) and mirrors the api/ tree into
// dist-api/ with .mjs extensions. Run by `npm run build` and the
// Docker builder stage.

import { build } from 'esbuild';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve('api');
const OUT = 'dist-api';

async function collect(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...(await collect(join(dir, entry.name), `${prefix}${entry.name}/`)));
    } else if (entry.name.endsWith('.ts')) {
      files.push({ rel: `${prefix}${entry.name}`, abs: join(dir, entry.name) });
    }
  }
  return files;
}

const files = await collect(ROOT);
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const file of files) {
  const result = await build({
    entryPoints: [file.abs],
    bundle: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    sourcemap: false,
    splitting: false,
    write: false,
    logLevel: 'silent',
  });
  // Rewrite relative import specifiers: .ts → .mjs, and add
  // .mjs to extensionless ones (Node ESM needs explicit
  // extensions, esbuild's bundle:false keeps them bare).
  let text = result.outputFiles[0].text;
  text = text.replace(
    /(from\s+|import\s+)("(?:[^"]*)"|'(?:[^']*)')/g,
    (m, head, qspec) => {
      const spec = qspec.slice(1, -1);
      if (!spec.startsWith('.')) return m;
      if (spec.endsWith('.mjs')) return m;
      const base = spec.replace(/\.ts$/, '');
      return `${head}"${base}.mjs"`;
    },
  );
  const dest = join(OUT, file.rel.replace(/\.ts$/, '.mjs'));
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, text);
}

console.log(`[build:api] ${files.length} modules → ${OUT}/ (${relative('.', OUT)})`);
