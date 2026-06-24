import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'rename-html-to-ui',
      closeBundle() {
        const from = resolve(__dirname, 'dist/index.html');
        const to = resolve(__dirname, 'dist/ui.html');
        if (existsSync(from)) renameSync(from, to);
      },
    },
  ],
  root: 'src/ui',
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
    target: 'es2017',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
