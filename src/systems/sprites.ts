/**
 * 美术素材：清单、加载、测量。
 *
 * 图片放在 assets/ 下（Vite 的 publicDir），路径与 docs/art-prompts.md 一致。
 * 任何一张缺失都不会报错：对应的地方继续用代码画的色块占位。
 *
 * 不同来源的图绘制比例不同（GPT 生成的侧面约 430px 高，官方小人约 315px 高），
 * 所以不按原始像素缩放，而是测出每组图实际画出的范围，统一缩放到指定身高，
 * 原点放在脚底中央。
 */
import Phaser from 'phaser';

const C = 'sprites/characters/';
const O = 'sprites/official/';

const frames = (dir: string, n: number) => Array.from({ length: n }, (_, i) => `${dir}/0${i + 1}.png`);

/** key → 路径 */
export const SPRITE_FILES: Record<string, string> = {
  // GPT 生成（提交在仓库里）
  mafuyu_left: `${C}mafuyu_left.png`,
  mafuyu_left_walk: `${C}mafuyu_left_walk.png`,
  mafuyu_right: `${C}mafuyu_right.png`,
  mafuyu_right_walk: `${C}mafuyu_right_walk.png`,
  mafuyu_crawl: `${C}mafuyu_crawl.png`,
  mafuyu_climb: `${C}mafuyu_climb.png`,
  mafuyu_fallen: `${C}mafuyu_fallen.png`,
  mafuyu_sit_back: `${C}mafuyu_sit_back.png`,
  mafuyu_child_back: `${C}mafuyu_child_back.png`,
  mafuyu_child_turned: `${C}mafuyu_child_turned.png`,
  mafuyu_child_counting: `${C}mafuyu_child_counting.png`,
};

/** 官方小人的帧（不提交，本地放在 assets/sprites/official/） */
const OFFICIAL: Record<string, { front: string[]; back: string[]; blink: string[] }> = {};
for (const who of ['mafuyu', 'kanade', 'ena', 'mizuki']) {
  OFFICIAL[who] = {
    front: frames(`${O}${who}/walk_front`, 6),
    back: frames(`${O}${who}/walk_back`, 6),
    blink: frames(`${O}${who}/blink`, 4),
  };
}
const officialKey = (path: string) => `off:${path}`;
for (const set of Object.values(OFFICIAL)) {
  for (const p of [...set.front, ...set.back, ...set.blink]) SPRITE_FILES[officialKey(p)] = p;
}

export function officialFrames(who: string, kind: 'front' | 'back' | 'blink'): string[] {
  return (OFFICIAL[who]?.[kind] ?? []).map(officialKey);
}

/** 在 Boot 场景里调用。缺失的文件安静地跳过 */
export function preloadSprites(scene: Phaser.Scene): void {
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    if (SPRITE_FILES[file.key]) console.info(`[sprites] 没有找到 ${file.url}，使用占位图`);
  });
  for (const [key, path] of Object.entries(SPRITE_FILES)) scene.load.image(key, path);
}

export function hasAll(scene: Phaser.Scene, keys: string[]): boolean {
  return keys.length > 0 && keys.every((k) => scene.textures.exists(k) && k !== '__MISSING');
}

// ---------------------------------------------------------------- 测量

export interface Metrics {
  /** 缩放到 1 个单位身高需要的比例：scale = 目标身高 * unit */
  unit: number;
  originX: number;
  originY: number;
}

const bboxCache = new Map<string, { x0: number; y0: number; x1: number; y1: number; w: number; h: number }>();

function bbox(scene: Phaser.Scene, key: string) {
  const hit = bboxCache.get(key);
  if (hit) return hit;
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 24) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  const box = x1 < 0 ? { x0: 0, y0: 0, x1: w - 1, y1: h - 1, w, h } : { x0, y0, x1, y1, w, h };
  bboxCache.set(key, box);
  return box;
}

/**
 * 一组帧共用的缩放与原点：按这组帧画出范围的并集来算，
 * 原点在脚底中央，所以换帧时人物不会跳。
 * heightOf：用哪几帧的高度作为「身高」基准（默认就是这组帧）。
 */
export function groupMetrics(scene: Phaser.Scene, keys: string[], heightOf: string[] = keys): Metrics {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let w = 512;
  let h = 512;
  for (const k of keys) {
    const b = bbox(scene, k);
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    y1 = Math.max(y1, b.y1);
    w = b.w;
    h = b.h;
  }
  let top = Infinity;
  let bottom = -Infinity;
  for (const k of heightOf) {
    const b = bbox(scene, k);
    top = Math.min(top, b.y0);
    bottom = Math.max(bottom, b.y1);
  }
  return { unit: 1 / (bottom - top + 1), originX: (x0 + x1 + 1) / 2 / w, originY: (y1 + 1) / h };
}

/** 单张图：脚底对齐，按 heightOf 那组图的身高缩放到 height 像素 */
export function poseImage(
  scene: Phaser.Scene,
  key: string,
  height: number,
  heightOf: string[] = [key],
): Phaser.GameObjects.Image | null {
  if (!hasAll(scene, [key]) || !hasAll(scene, heightOf)) return null;
  const m = groupMetrics(scene, [key], heightOf);
  return scene.add.image(0, 0, key).setOrigin(m.originX, m.originY).setScale(height * m.unit);
}

/** GPT 生成的真冬站立图，用作其他姿势（爬、坐、躺）的身高基准，保证比例一致 */
export const MAFUYU_STAND_REF = ['mafuyu_left', 'mafuyu_right'];
