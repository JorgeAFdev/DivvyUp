import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Runs the stories as tests in a real browser via Playwright/chromium. Kept in
// its own config (run with `pnpm test:storybook`) so `pnpm test` never loads the
// addon or needs a browser. See vitest.config.js for the jsdom unit suites.
export default defineConfig({
  extends: 'vite.config.js',
  plugins: [
    // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
    storybookTest({ configDir: path.join(dirname, '.storybook') }),
  ],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      name: 'chromium',
      provider: 'playwright',
    },
    setupFiles: ['.storybook/vitest.setup.js'],
  },
});
