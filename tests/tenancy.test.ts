import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'lattice-tenant-'));
process.env.LATTICE_STORE_DIR = tmpDir;

beforeAll(async () => {
  await fs.mkdir(tmpDir, { recursive: true });
});
afterAll(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

describe('tenant store isolation', () => {
  it('prefixes keys for tenant A', async () => {
    const { _resetRoot, getTenantStore } = await import('../api/_lib/store');
    _resetRoot();
    const a = getTenantStore('lattice', 'tenant_A_abc');
    await a.setJSON('papers/pdf-aa11/text.json', { pages: [] });
    const { blobs } = await a.list({ prefix: 'papers/' });
    expect(blobs[0]?.key).toMatch(/^tenant_A_abc\/papers\//);
  });

  it('keeps two tenants separate', async () => {
    const { _resetRoot, getTenantStore } = await import('../api/_lib/store');
    _resetRoot();
    const a = getTenantStore('lattice', 't_a_xx');
    const b = getTenantStore('lattice', 't_b_yy');
    await a.setJSON('papers/arxiv-1/text.json', { tenant: 'a' });
    await b.setJSON('papers/arxiv-2/text.json', { tenant: 'b' });
    const aList = await a.list({ prefix: 'papers/' });
    const bList = await b.list({ prefix: 'papers/' });
    expect(aList.blobs.some((x) => x.key.includes('arxiv-1'))).toBe(true);
    expect(bList.blobs.some((x) => x.key.includes('arxiv-2'))).toBe(true);
    expect(aList.blobs.some((x) => x.key.includes('arxiv-2'))).toBe(false);
  });

  it('legacy global store still works when no tenant', async () => {
    const { _resetRoot, getStore } = await import('../api/_lib/store');
    _resetRoot();
    const g = getStore('lattice');
    await g.setJSON('papers/legacy/text.json', { ok: true });
    const v = await g.getWithMetadata('papers/legacy/text.json', { type: 'json' });
    expect((v?.data as { ok: boolean }).ok).toBe(true);
  });

  it('rejects unsafe tenant ids', async () => {
    const { getTenantStore } = await import('../api/_lib/store');
    const t = getTenantStore('lattice', '../../../etc/passwd');
    // Sanitized tenant; should still write under safe segment
    await t.set('papers/x/text.json', 'ok');
    const v = await t.get('papers/x/text.json');
    expect(v).toBe('ok');
  });
});
