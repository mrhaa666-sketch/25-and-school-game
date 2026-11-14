import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 相对路径，方便之后被 Electron 以 file:// 加载
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
