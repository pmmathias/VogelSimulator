import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/vogelsimulator/',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
});
