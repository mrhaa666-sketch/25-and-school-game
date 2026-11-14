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
import { imageFiles } from 'virtual:asset-list';

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

/** 场景类素材：key 就是文件名（不带扩展名），前缀区分类别 */
const GROUPS: Record<string, { dir: string; names: string[] }> = {
  obj: { dir: 'sprites/objects/', names: ['bed', 'blackboard', 'chair', 'class_door', 'easel_portraits', 'grand_piano', 'iron_door', 'lectern', 'locker', 'medicine_cabinet', 'medicine_cabinet_open', 'mirror', 'office_desk', 'pink_door', 'pipe_entrance', 'ropes', 'school_desk', 'school_desk_paper', 'school_desk_paper_filled', 'school_gate', 'scissors', 'shoe_locker', 'stairs', 'trash_can', 'wall_clock', 'window_night',
    // 新素材（美术文档）：门的变体、走廊和房间的物件、周目主题装饰
    'class_door_open', 'class_door_leak', 'exit_threshold', 'lamp_tube',
    'school_desk_tilted', 'school_desk_fallen', 'school_desk_carved',
    'fire_box', 'bulletin_board', 'class_sign', 'sink_row', 'broom_locker', 'locker_fallen', 'desk_pile',
    'curtain_bed', 'iv_stand', 'plaster_shelf', 'paint_sink', 'music_stand', 'metronome', 'trophy_case', 'shoes_pair',
    'mafuyu_award_wall', 'ena_portrait_01', 'ena_portrait_02', 'ena_portrait_03', 'ena_portrait_04', 'ena_portrait_05', 'ena_portrait_06',
    'ena_canvas_pile', 'mizuki_ribbon_01', 'mizuki_ribbon_02', 'mizuki_ribbon_03', 'mizuki_ribbon_04', 'mizuki_mannequin', 'kanade_cup_stack', 'rope_hanging'] },
  // CG：剧情关键时刻和结局的插画（1920×1080），缺图时跳过，游戏照常
  cg: { dir: 'ui/cg/', names: ['cg_act01_girl', 'cg_act02_wake', 'cg_act04_fall', 'cg_act07_fork', 'cg_act09_choir', 'cg_final_outside', 'cg_phone', 'cg_e1', 'cg_e2', 'cg_e3', 'cg_e4', 'cg_e6', 'cg_e7', 'cg_e8',
    'cg_e1_c1', 'cg_e1_c2', 'cg_e1_c3', 'cg_e1_c4', 'cg_e4_c1', 'cg_e4_c2', 'cg_e4_c3', 'cg_e4_c4'] },
  decal: { dir: 'sprites/decals/', names: ['decal_stain_01', 'decal_stain_02', 'decal_stain_03', 'decal_stain_04', 'decal_paper_01', 'decal_paper_02', 'decal_paper_03', 'decal_crack_01', 'decal_crack_02', 'decal_footprint_01', 'decal_glass_01', 'decal_chalk_01', 'decal_test_01', 'decal_test_02', 'decal_score_01', 'decal_score_02', 'decal_score_03', 'decal_score_04'] },
  backdrop: { dir: 'sprites/backdrop/', names: ['night_view', 'dawn_view'] },
  mon: { dir: 'sprites/monsters/', names: ['faceless', 'flying_score', 'moving_door', 'moving_door_folded', 'note', 'nurse', 'piano', 'piano_strings', 'plaster', 'turned_back', 'mafuyus_child', 'mafuyus_middle', 'mafuyus_high', 'mafuyus_doctor'] },
  scn: { dir: 'sprites/scenes/', names: ['floor2_clothes', 'floor2_lying', 'floor3_canvas', 'floor3_canvas_cut', 'floor3_hanged', 'music_kanade_blank', 'music_kanade_play', 'music_kanade_shatter'] },
  tile: { dir: 'tiles/', names: ['floor_final', 'floor_pink_room', 'floor_pipe', 'floor_school', 'floor_school_ena', 'floor_school_kanade', 'floor_school_mizuki', 'wall_school', 'wall_school_ena', 'wall_school_mizuki',
    'wall_face_school', 'wall_face_ena', 'wall_face_mizuki', 'wall_face_kanade', 'wall_top', 'floor_f3', 'floor_f2', 'floor_f1'] },
  bg: { dir: 'ui/bg/', names: ['climb_facade', 'ending10_lot', 'ending9_home', 'exam_closeup', 'final_gate', 'title', 'stairwell'] },
  light: { dir: 'sprites/lights/', names: ['light_player', 'light_window', 'light_window_dawn', 'light_lamp', 'light_door_leak'] },
  mat: { dir: 'ui/materials/', names: ['ena_comment', 'ena_paint', 'ena_sketch', 'kanade_cupnoodle', 'kanade_earphones', 'kanade_score', 'mafuyu_blank_paper', 'mafuyu_checkup', 'mafuyu_nameplate', 'mizuki_diary', 'mizuki_postcard', 'mizuki_ribbon'] },
};
for (const [prefix, g] of Object.entries(GROUPS)) {
  for (const n of g.names) SPRITE_FILES[`${prefix}:${n}`] = `${g.dir}${n}.png`;
}

/**
 * 房间里的剧情时刻 → CG。台词显示时把 CG 铺满画面，台词说完淡出。
 * 只在这里登记，不改剧本文字。
 */
export const CG_MOMENTS: Record<string, string> = {
  'act01.girl': 'cg_act01_girl',
  'act02.wake': 'cg_act02_wake',
  'act04.fall': 'cg_act04_fall',
  'act07.fork': 'cg_act07_fork',
  'act09.sing': 'cg_act09_choir',
  'finalrun.outside': 'cg_final_outside',
};

/** 例：tex('obj', 'bed') → 'obj:bed' */
export const tex = (prefix: 'obj' | 'mon' | 'scn' | 'tile' | 'bg' | 'mat' | 'light' | 'decal' | 'backdrop' | 'cg', name: string) => `${prefix}:${name}`;

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
  // 只加载实际存在的文件（例如官方小人素材不在仓库里，没放就跳过）
  const exists = new Set(imageFiles);
  for (const [key, path] of Object.entries(SPRITE_FILES)) if (exists.has(path)) scene.load.image(key, path);
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

/**
 * 把一张图放进矩形框里：按图实际画出的范围等比缩放到框内（contain），
 * 水平居中、底边对齐框的底边。用于物件、成员场景、怪物。
 */
export function fitImage(
  scene: Phaser.Scene,
  key: string,
  box: { x: number; y: number; w: number; h: number },
): Phaser.GameObjects.Image | null {
  if (!hasAll(scene, [key])) return null;
  const b = bbox(scene, key);
  const bw = b.x1 - b.x0 + 1;
  const bh = b.y1 - b.y0 + 1;
  const scale = Math.min(box.w / bw, box.h / bh);
  return scene.add
    .image(box.x + box.w / 2, box.y + box.h, key)
    .setOrigin((b.x0 + bw / 2) / b.w, (b.y1 + 1) / b.h)
    .setScale(scale);
}

/**
 * 只取图的一部分（crop 矩形，原图像素坐标），等比缩放进 box，水平居中、底边对齐。
 * 用于从贴图里裁出一幅人像、从绳子素材里裁出一根绳等。
 */
export function cropImage(
  scene: Phaser.Scene,
  key: string,
  crop: { x: number; y: number; w: number; h: number },
  box: { x: number; y: number; w: number; h: number },
): Phaser.GameObjects.Image | null {
  if (!hasAll(scene, [key])) return null;
  const sc = Math.min(box.w / crop.w, box.h / crop.h);
  const left = box.x + box.w / 2 - (crop.w * sc) / 2;
  const top = box.y + box.h - crop.h * sc;
  return scene.add
    .image(left - crop.x * sc, top - crop.y * sc, key)
    .setOrigin(0)
    .setScale(sc)
    .setCrop(crop.x, crop.y, crop.w, crop.h);
}

/** 二周目的人像：从墙面贴图中间那幅裁出来 */
export const PORTRAIT_CROP = { x: 186, y: 126, w: 144, h: 206 };
