import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // 引用符の扱いを厳密にしてビルドエラーを防ぐ
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || ''),
      'process.env.STORE_NAME': JSON.stringify(env.STORE_NAME || process.env.STORE_NAME || '')
    },
    server: {
      host: true,
      port: 5173,
    },
    build: {
      outDir: 'dist',
      minify: 'esbuild',
      sourcemap: false
    }
  };
});
