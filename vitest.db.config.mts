import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Integration tests against a real Postgres (DATABASE_URL_TEST). Not part of
// `npm test`, which stays hermetic. Run with `npm run test:db`.
export default defineConfig({
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./src/', import.meta.url)),
      '@data/': fileURLToPath(new URL('./data/', import.meta.url)),
    },
  },
  test: {
    include: ['tests-db/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
