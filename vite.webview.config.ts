import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src/webviews',
  base: './',
  build: {
    outDir: '../../media',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/webviews/main.tsx'),
      },
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      shared: path.resolve(__dirname, 'src/shared'),
      webviews: path.resolve(__dirname, 'src/webviews'),
    }
  }
});
