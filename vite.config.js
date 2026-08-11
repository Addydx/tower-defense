import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tower-defense/',
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
});
