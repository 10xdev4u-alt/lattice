import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'public',
  publicDir: false,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'public/assets'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, 'public/index.html'),
    },
  },
  server: {
    port: 8888,
    strictPort: false,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 8888,
    host: '0.0.0.0',
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
});
