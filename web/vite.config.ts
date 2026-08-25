import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  // .env 放在 monorepo 根目錄，讓 web 與 server 共用同一份設定
  envDir: '..',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    // React Compiler（oxc 版）
    react({ compiler: true }),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { port: 5173 },
});
