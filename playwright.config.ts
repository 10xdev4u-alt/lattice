import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['junit', { outputFile: 'e2e-junit.xml' }]],
  use: {
    baseURL: 'http://localhost:8890',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build --silent && PORT=8890 node server.mjs',
    url: 'http://localhost:8890',
    reuseExistingServer: false,
    env: { LATTICE_STORE_DIR: '/tmp/lattice-e2e' },
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
