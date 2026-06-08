import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Inline (empty) PostCSS config so Vite doesn't walk up into the parent
  // repo's postcss.config.js (the Vite PWA) when resolving config.
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
