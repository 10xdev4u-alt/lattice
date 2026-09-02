import { test, expect } from '@playwright/test';

test('arxiv add flow reachable + healthz reports the live pool', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  // The empty state exposes the arXiv path
  const arxivBtn = page.locator('[data-action="paste-arxiv"]');
  const hasEmpty = await arxivBtn.isVisible();
  if (hasEmpty) {
    await arxivBtn.click();
    // The ask dialog appears with the arXiv placeholder
    await expect(page.locator('.kg-overlay')).toContainText(/arXiv/i, { timeout: 5000 });
  }
  // Healthz reports the live pool head
  const health = await page.evaluate(async () => {
    const res = await fetch('/api/healthz');
    return res.json();
  });
  expect(health.checks?.modelPool).toContain('liquid');
  expect(health.runtimeKind).toBe('node');
});

test('the agent rail mounts with tools and log tabs', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-agent-input]')).toBeVisible();
  await expect(page.locator('[data-tab="tools"]')).toContainText(/TOOLS · \d+/);
  await expect(page.locator('[data-tab="log"]')).toContainText(/TRAIL · \d+/);
});
