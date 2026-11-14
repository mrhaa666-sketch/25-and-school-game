import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * virtual:asset-list —— 启动 / 打包时列出 assets/audio 下实际存在的文件。
 * 游戏只加载列表里有的文件，缺失的音效不会去请求，也不会报错。
 * 新加了文件后重启 npm run dev 即可。
 */
function assetList(): Plugin {
  const id = 'virtual:asset-list';
  const resolved = '\0' + id;
  const walk = (dir: string, base: string): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(path.join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`],
        )
      : [];
  return {
    name: 'asset-list',
    resolveId: (i) => (i === id ? resolved : undefined),
    load(i) {
      if (i !== resolved) return;
      const audio = walk(path.resolve('assets/audio'), 'audio/').filter((f) => /\.(ogg|mp3|wav|m4a)$/i.test(f));
      return `export const audioFiles = ${JSON.stringify(audio)};`;
    },
  };
}

export default defineConfig({
  base: './', // 相对路径，方便之后被 Electron 以 file:// 加载
  // assets/ 下的图片和音效原样提供，路径与 docs/art-prompts.md 一致（例如 sprites/characters/mafuyu_left.png）
  publicDir: 'assets',
  plugins: [assetList()],
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
