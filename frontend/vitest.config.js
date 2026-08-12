import { defineConfig } from 'vitest/config';

// The jsdom component suites — what `pnpm test` runs. The Storybook browser
// tests live in vitest.storybook.config.js so loading this config never pulls in
// the Storybook addon (and its "no story files" noise) or needs chromium.
export default defineConfig({
  test: {
    // extends the app's vite.config.js for the react-swc plugin that transforms JSX.
    projects: [
      {
        extends: 'vite.config.js',
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.js'],
          include: ['src/**/*.test.{js,jsx,ts,tsx}'],
        },
        resolve: {
          // Mirror jest's moduleNameMapper: a stylesheet import resolves whole to
          // a proxy that returns the class name unchanged, so `styles.icon ===
          // 'icon'`. The regex must match the entire id (Vite string-replaces the
          // match), or only the extension is swapped and the path fails to resolve.
          alias: [{ find: /^.+\.(css|less|scss|sass)$/, replacement: 'identity-obj-proxy' }],
        },
      },
    ],
  },
});
