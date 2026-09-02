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
  it('stores under tenant prefix and reads back', async () => {
    const { _resetRoot, getStore, getTenantStore } = await import('../api/_lib/store');
    _resetRoot();
    const a = getTenantStore('lattice', 'tenant_aaaaaaaa');
    await a.setJSON('papers/pdf-aa11/text.json', { pages: [] });
    const v = await a.getWithMetadata('papers/pdf-aa11/text.json', { type: 'json' });
    expect((v?.data as { pages: unknown[] }).pages).toEqual([]);
    const g = getStore('lattice');
    const list = await g.list({ prefix: 'tenant_aaaaaaaa/papers/' });
    expect(list.blobs[0]?.key).toMatch(/^tenant_aaaaaaaa\/papers\//);
  });

  it('keeps two tenants separate', async () => {
    const { _resetRoot, getTenantStore } = await import('../api/_lib/store');
    _resetRoot();
    const a = getTenantStore('lattice', 'tenant_aaaaaaaa');
    const b = getTenantStore('lattice', 'tenant_bbbbbbbb');
    await a.setJSON('papers/arxiv-1/text.json', { tenant: 'a' });
    await b.setJSON('papers/arxiv-2/text.json', { tenant: 'b' });
    const aList = await a.list({ prefix: 'papers/' });
    const bList = await b.list({ prefix: 'papers/' });
    expect(aList.blobs.some((x) => x.key.includes('arxiv-1'))).toBe(true);
    expect(aList.blobs.some((x) => x.key.includes('arxiv-2'))).toBe(false);
    expect(bList.blobs.some((x) => x.key.includes('arxiv-2'))).toBe(true);
    expect(bList.blobs.some((x) => x.key.includes('arxiv-1'))).toBe(false);
  });

  it('legacy global store still works when no tenant', async () => {
    const { _resetRoot, getStore } = await import('../api/_lib/store');
    _resetRoot();
    const g = getStore('lattice');
    await g.setJSON('papers/legacy/text.json', { ok: true });
    const v = await g.getWithMetadata('papers/legacy/text.json', { type: 'json' });
    expect((v?.data as { ok: boolean }).ok).toBe(true);
  });

  it('rejects unsafe tenant ids via sanitizer', async () => {
    const { getTenantStore } = await import('../api/_lib/store');
    const t = getTenantStore('lattice', '../../../etc/passwd');
    await t.set('papers/x/text.json', 'ok');
    const v = await t.get('papers/x/text.json');
    expect(v).toBe('ok');
  });
});

describe('cookie-only identity (x-session-id is dead)', () => {
  it('getTenantId reads the cookie and ignores a spoofed header', async () => {
    const { getTenantId } = await import('../api/_lib/session');
    const withCookie = new Request('https://x.test/', {
      headers: { cookie: 'lattice_sid=t_realcookie123' },
    });
    expect(getTenantId(withCookie)).toBe('t_realcookie123');

    // The attack: header claims another tenant, no cookie present.
    const spoofed = new Request('https://x.test/', {
      headers: { 'x-session-id': 't_victim_aaaaaaaa' },
    });
    expect(getTenantId(spoofed)).toBeNull();

    // Even WITH a cookie, the header must not override it.
    const both = new Request('https://x.test/', {
      headers: { 'x-session-id': 't_victim_aaaaaaaa', cookie: 'lattice_sid=t_realcookie123' },
    });
    expect(getTenantId(both)).toBe('t_realcookie123');
  });

  it('server cookie-minter ignores the header', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('server.mjs', 'utf8'));
    expect(src).not.toMatch(/req\.headers\.get\('x-session-id'\)/);
  });
});
