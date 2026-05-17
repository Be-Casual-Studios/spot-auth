import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use happy-dom for browser-specific tests (localStorage, etc.)
    environmentMatchGlobs: [
      ['test/browser/**', 'happy-dom'],
    ],
  },
});
