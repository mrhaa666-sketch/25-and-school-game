import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // 相对路径，方便之后被 Electron 以 file:// 加载
  // assets/ 下的图片和音效原样提供，路径与 docs/art-prompts.md 一致（例如 sprites/characters/mafuyu_left.png）
  publicDir: 'assets',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
