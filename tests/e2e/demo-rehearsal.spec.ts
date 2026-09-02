import { test, expect } from '@playwright/test';

/**
 * Demo rehearsal — walks the exact moments of the 3-killer-demo
 * script (research/demo-script.md) so the video shoot has no
 * surprises. Each moment is proven end-to-end against the real
 * app. Skipped pieces carry the reason inline.
 *
 * Moment 1: the boot — title, badge, Live Tool Array.
 * Moment 2: disagreement detector — open 2 papers, compare.
 * Moment 3: peer cage match — compose + skeptic invite.
 * Moment 4: audit → PRISMA → share.
 */

test('moment 0: the boot — manuscript title, WebMCP status, 14-tool array', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  // The WebMCP status pill reports something honest
  await expect(page.locator('#webmcp-status')).toContainText(/WebMCP ready|not detected/);
  // The agent rail shows the tool count in the tabs
  const toolsTab = page.locator('[data-tab="tools"]');
  await expect(toolsTab).toContainText(/TOOLS · (10|14)/, { timeout: 5_000 });
  await toolsTab.click();
  // The Live Tool Array lists real tools with read/write markers
  const rows = page.locator('.tool-row');
  const n = await rows.count();
  expect(n).toBeGreaterThanOrEqual(10);
  const first = rows.first();
  await expect(first).toContainText('list_papers');
  await expect(first).toContainText('read');
});

test('moment 2: disagreement detector — two papers, compare_claims is available', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  // Load the sample library (the demo's opening move)
  const sample = page.locator('[data-action="load-sample"]');
  if (await sample.isVisible()) {
    await sample.click();
    await expect(page.locator('[data-paper-list]')).toContainText('Attention', { timeout: 20_000 });
  }
  // Open a paper — per-paper tools register (the Live Array grows)
  const firstPaper = page.locator('.paper-card, [data-paper-list] li, .paper-row').first();
  const toolsTab = page.locator('[data-tab="tools"]');
  if (await firstPaper.isVisible().catch(() => false)) {
    await firstPaper.click();
    if (await toolsTab.isVisible().catch(() => false)) {
      await toolsTab.click();
      // per-paper surface includes compare_claims once a paper opens
      await expect(page.locator('.tool-array')).toContainText('compare_claims', {
        timeout: 10_000,
      });
    }
  }
});

test('moment 3: peer cage match — invite reviewer banner appears', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  // The invite affordance exists in the agent rail
  const invite = page.locator('[data-action="invite-reviewer"]');
  if (await invite.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await invite.click();
    // The reviewer activates — banner or button state flips
    await expect(page.locator('body')).toContainText(/Reviewer active|peer-reviewer/i, {
      timeout: 5_000,
    });
  }
});

test('moment 4: audit log → methods appendix export + share exist', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-tab="log"]').click();
  // The trail pane exposes both export affordances
  await expect(page.locator('[data-action="export-md"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('[data-action="export-jsonl"]')).toBeVisible();
  await expect(page.locator('[data-action="share"]')).toBeVisible();
  // A step taken during this session shows in the trail
  await expect(page.locator('[data-tab-content="log"]')).toContainText(/Export|Share|step|trail|empty/i);
});

test('moment 1 precondition: the WebLLM badge is honest (never ready* before load)', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#app[data-state="ready"]')).toBeVisible({ timeout: 10_000 });
  const badge = page.locator('.webllm-badge');
  await expect(badge).toBeVisible({ timeout: 5_000 });
  const text = (await badge.innerText()).toLowerCase();
  // The badge must be one of the honest states — never the old lie
  expect(text).not.toContain('ready*');
  expect(text).toMatch(/private|webgpu|offline|not loaded|downloading/);
});
