import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // The tests share one in-memory DB per file; run files one at a time so no
    // two ever race on the global mongoose connection or on spinning a mongod.
    fileParallelism: false,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
    },
  },
});
