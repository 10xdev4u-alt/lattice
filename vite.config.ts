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
      output: {
        // web-llm is ~6MB and rarely needed (offline fallback
        // only). Its own chunk lets the browser cache it forever
        // independently of app-code changes.
        manualChunks: (id) => {
          if (id.includes('@mlc-ai/web-llm')) return 'webllm-vendor';
          if (id.includes('pdfjs-dist')) return 'pdfjs-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
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
