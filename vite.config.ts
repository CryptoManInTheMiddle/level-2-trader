import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative base so the build works both at the domain root (local dev) and
  // under a GitHub Pages project subpath (e.g. /level-2-trader/).
  base: './',
  plugins: [react()],
  server: {
    host: true,
  },
});
