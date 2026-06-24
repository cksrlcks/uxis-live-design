import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2017',
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      formats: ['iife'],
      name: 'covaPluginMain',
      fileName: () => 'main.js',
    },
    rollupOptions: { output: { extend: true } },
  },
});
