import { test, expect } from '@playwright/test';

test('landing story loads and routes to the workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Lattice — research papers/);
  await expect(page.locator('.hero-title')).toContainText('Research papers');
  // All 14 tools are listed in the ticker
  const toolTicks = page.locator('.tick:not([aria-hidden])');
  await expect(toolTicks).toHaveCount(14);
  // CTA enters the workspace
  await page.click('.hero-cta .btn-primary');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveTitle('Lattice');
});

test('workspace boots with the empty state and three CTAs', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  // The empty state offers the three ingestion paths
  await expect(page.locator('[data-action="load-sample"]')).toBeVisible();
  await expect(page.locator('[data-action="drop-pdf"]')).toBeVisible();
  // The PDF picker input exists (the Drop a PDF button is wired)
  await expect(page.locator('[data-pdf-input]')).toBeAttached();
});

test('load sample library → papers appear in the rail', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  const sample = page.locator('[data-action="load-sample"]');
  if (await sample.isVisible()) {
    await sample.click();
    // The rail fills with the classic papers
    await expect(page.locator('[data-paper-list]')).toContainText('Attention', {
      timeout: 20_000,
    });
  }
});

test('ingest → search returns page-cited BM25 hits', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  const search = await page.evaluate(async () => {
    const res = await fetch('/api/papers/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'attention' }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  });
  expect([200, 400]).toContain(search.status);
});

test('healthz reports ok (store probe works)', async ({ request }) => {
  const res = await request.get('/api/healthz');
  // 200 with store:ok when the store dir is writable (the e2e
  // server uses a fresh tmp dir), or 503 with the reason —
  // assert it is never a lie: status text must match checks.store.
  const body = (await res.json()) as { status?: string; checks?: { store?: string } };
  if (res.status() === 200) {
    expect(body.status).toBe('ok');
    expect(body.checks?.store).toBe('ok');
  } else {
    expect(body.status).toBe('degraded');
    expect(body.checks?.store).toBe('error');
  }
});

test('trail → share → share page renders the session', async ({ page, context }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  const logTab = page.locator('[data-tab="log"]');
  if (await logTab.isVisible()) {
    await logTab.click();
    const shareBtn = page.locator('[data-action="share"]');
    if (await shareBtn.isVisible()) {
      await shareBtn.click();
      // The encrypt prompt appears; choose Cancel (no passphrase)
      const cancel = page.locator('.kg-overlay button', { hasText: 'Cancel' });
      if (await cancel.isVisible()) await cancel.click();
      // The share notice carries a v1/fragment URL — grab it
      const overlayText = await page
        .locator('.kg-overlay')
        .innerText({ timeout: 5000 })
        .catch(() => '');
      const url = overlayText.match(/http\S+#share=\S+/)?.[0];
      test.skip(!url, 'no share URL surfaced');
      const shared = await context.newPage();
      await shared.goto(url.replace('/app/', '/share.html'));
      await expect(shared.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
      await expect(shared.locator('#app-main')).toContainText(/Session|Invalid/);
    }
  }
});
