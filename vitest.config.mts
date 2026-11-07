import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./src/', import.meta.url)),
      '@data/': fileURLToPath(new URL('./data/', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Astronomy root-finding over long date ranges is CPU-bound; give it room.
    testTimeout: 60_000,
    // Tests must be hermetic: TZ is pinned to something exotic so any accidental
    // use of the system timezone shows up as a failure rather than passing by luck.
    env: { TZ: 'Pacific/Chatham' },
  },
});
