import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**', 'dist-api/**', 'playwright/**'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
      exclude: ['tests/**', 'dist/**', 'dist-api/**', 'playwright/**', 'scripts/**'],
    },
  },
});
