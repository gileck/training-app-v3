import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    testTimeout: 30_000,
    include: ['src/agents/tests/e2e/**/*.e2e.test.ts'],
    environment: 'node',
  },
});
