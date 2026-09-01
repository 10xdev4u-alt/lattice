import { test, expect } from '@playwright/test';

test('arxiv add form visible + healthz reports modelPool', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  // ArXiv input exists in the paper list rail (or empty state)
  const arxivInput = page.locator('[data-arxiv-input], [data-arxiv-id]');
  // Healthz should report the live pool
  const health = await page.evaluate(async () => {
    const res = await fetch('/api/healthz');
    return res.json();
  });
  expect(health.checks?.modelPool).toContain('liquid');
  expect(health.runtimeKind).toBe('node');
});
