
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // process.env を定義してブラウザ側の実行エラーを防止
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    server: {
      host: true,
      port: 5173,
    },
    build: {
      outDir: 'dist',
      minify: 'terser',
      sourcemap: false
    }
  };
});
