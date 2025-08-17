import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      PONDER_RPC_URL_1: 'http://localhost:8545',
      PONDER_RPC_URL_42161: 'http://localhost:8545',
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'bin', 'test'],
    },
  },
});
