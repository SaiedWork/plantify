import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { AUTH_RATE_LIMIT: 'off', WEBHOOK_ALLOW_PRIVATE: '1' },
    // Files share one database (stock, totals), so they run one after another.
    fileParallelism: false,
  },
});
