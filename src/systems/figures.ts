import Phaser from 'phaser';
import { poseImage, tex } from './sprites';
import { textStyle } from './style';

/**
 * 占位人物 / 怪物。全部是色块，M6 换成美术素材时只需要改这里。
 * 原点在脚下中心。
 */
export type Pose = 'stand' | 'away' | 'hang' | 'lie' | 'sit' | 'crawl';

export interface FigureOpts {
  body: number;
  head?: number;
  hair?: number;
  label?: string;
  pose?: Pose;
  /** 缩放：小学生版真冬用 0.75 */
  scale?: number;
  alpha?: number;
}

export const PALETTE = {
  mafuyu: { body: 0x5c4f7c, head: 0xd9cfe8, hair: 0x6b5a96 },
  mafuyuChild: { body: 0x2e3a5a, head: 0xd9cfe8, hair: 0x6b5a96 },
  kanade: { body: 0x3d4250, head: 0xe6e6ee, hair: 0xd8dbe6 },
  ena: { body: 0x5a4a44, head: 0xe8d6c8, hair: 0x8a6a52 },
  mizuki: { body: 0x4a3a52, head: 0xf0dce4, hair: 0xe39fc0 },
} as const;

export function makeFigure(scene: Phaser.Scene, x: number, y: number, o: FigureOpts): Phaser.GameObjects.Container {
  const head = o.head ?? 0xd8d0c8;
  const hair = o.hair ?? o.body;
  const parts: Phaser.GameObjects.GameObject[] = [];
  const pose = o.pose ?? 'stand';

  if (pose === 'lie') {
    parts.push(scene.add.rectangle(4, -8, 30, 16, o.body));
    parts.push(scene.add.circle(-18, -8, 9, head));
    parts.push(scene.add.rectangle(-22, -8, 6, 18, hair));
  } else if (pose === 'sit') {
    parts.push(scene.add.rectangle(0, -10, 24, 20, o.body));
    parts.push(scene.add.circle(0, -27, 10, head));
    parts.push(scene.add.rectangle(0, -31, 22, 10, hair));
  } else if (pose === 'crawl') {
    parts.push(scene.add.rectangle(0, -8, 30, 14, o.body));
    parts.push(scene.add.circle(17, -10, 8, head));
    parts.push(scene.add.rectangle(19, -14, 10, 8, hair));
  } else {
    // stand / away / hang
    parts.push(scene.add.rectangle(0, -14, 24, 28, o.body));
    parts.push(scene.add.circle(0, -34, 10, head));
    if (pose === 'away') parts.push(scene.add.circle(0, -35, 10, hair)); // 背对：只看得到头发
    else parts.push(scene.add.rectangle(0, -40, 22, 8, hair));
    if (pose === 'hang') {
      // 脚离地，上方一根线。克制处理：不画细节
      parts.push(scene.add.line(0, 0, 0, -44, 0, -120, 0xc8c0b0).setOrigin(0).setLineWidth(1.5));
    }
  }

  const c = scene.add.container(x, pose === 'hang' ? y - 14 : y, parts);
  if (o.scale) c.setScale(o.scale);
  if (o.alpha !== undefined) c.setAlpha(o.alpha);
  if (o.label) {
    const t = scene.add.text(0, pose === 'lie' ? 8 : 6, o.label, textStyle(11, '#8a867e')).setOrigin(0.5, 0);
    c.add(t);
  }
  return c;
}

/** 怪物的占位：比人高一点的扭曲色块，带名字 */
export function makeMonster(scene: Phaser.Scene, x: number, y: number, color: number, label: string, size = 1): Phaser.GameObjects.Container {
  const body = scene.add.rectangle(0, -22 * size, 30 * size, 44 * size, color);
  const head = scene.add.ellipse(3 * size, -50 * size, 22 * size, 26 * size, color);
  const eyes = scene.add.rectangle(4 * size, -52 * size, 12 * size, 3 * size, 0x000000);
  const c = scene.add.container(x, y, [body, head, eyes]);
  c.add(scene.add.text(0, 6, label, textStyle(11, '#8a6a6a')).setOrigin(0.5, 0));
  scene.tweens.add({ targets: head, angle: { from: -8, to: 10 }, duration: 380, yoyo: true, repeat: -1 });
  return c;
}

/** 音符形态的怪物 */
export function makeNoteMonster(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const img = poseImage(scene, tex('mon', 'note'), 50);
  if (img) return scene.add.container(x, y, [img.setTint(0xb8b8b8)]);
  const headN = scene.add.ellipse(-6, -10, 18, 13, 0x050505).setAngle(-20);
  const stem = scene.add.rectangle(2, -28, 3, 34, 0x050505);
  const flag = scene.add.triangle(4, -44, 0, 0, 12, 8, 0, 14, 0x050505);
  const eye = scene.add.circle(-6, -11, 2, 0x8b1a1a);
  return scene.add.container(x, y, [headN, stem, flag, eye]);
}

/** 化成黑色的灰 */
export function ashBurst(scene: Phaser.Scene, x: number, y: number, count = 26): void {
  for (let i = 0; i < count; i++) {
    const p = scene.add.rectangle(x + Phaser.Math.Between(-14, 14), y + Phaser.Math.Between(-40, 0), 3, 3, 0x111111).setDepth(150);
    scene.tweens.add({
      targets: p,
      x: p.x + Phaser.Math.Between(-40, 40),
      y: p.y + Phaser.Math.Between(10, 50),
      alpha: 0,
      duration: Phaser.Math.Between(700, 1500),
      onComplete: () => p.destroy(),
    });
  }
}

/** 怪物 id（cycles/*.json）→ 素材文件名与游戏里的身高（像素；真冬是 66） */
const MONSTER_ART: Record<string, { file: string; height: number }> = {
  nurse: { file: 'nurse', height: 130 },
  plaster: { file: 'plaster', height: 124 },
  moving_door: { file: 'moving_door', height: 112 },
  moving_door_folded: { file: 'moving_door_folded', height: 112 },
  piano: { file: 'piano', height: 96 },
  piano_strings: { file: 'piano_strings', height: 96 },
  faceless: { file: 'faceless', height: 92 },
  turned_backs: { file: 'turned_back', height: 104 },
  flying_scores: { file: 'flying_score', height: 52 },
  note: { file: 'note', height: 50 },
};

/**
 * 怪物：有图用图，没有图用色块占位。原点在脚底中央。
 */
export function makeMonsterById(
  scene: Phaser.Scene,
  x: number,
  y: number,
  id: string,
  color: number,
  label: string,
  sizeScale = 1,
): Phaser.GameObjects.Container {
  const art = MONSTER_ART[id];
  const img = art ? poseImage(scene, tex('mon', art.file), art.height * sizeScale) : null;
  if (!img) return makeMonster(scene, x, y, color, label, sizeScale);
  img.setTint(0xd0d0d0);
  const c = scene.add.container(x, y, [img]);
  // 轻微的晃动，让它看起来是活的
  scene.tweens.add({ targets: img, angle: { from: -2, to: 2 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return c;
}

/**
 * 换怪物的姿势图（例如护士：nurse → nurse_alert → nurse_lunge）。
 * 新图缺失时什么也不做，保持原来的样子。身高按原图算，脚底对齐。
 */
export function setMonsterPose(scene: Phaser.Scene, c: Phaser.GameObjects.Container, id: string, pose: string): void {
  const art = MONSTER_ART[id];
  const key = tex('mon', pose);
  if (!art || !scene.textures.exists(key)) return;
  const old = c.list.find((o): o is Phaser.GameObjects.Image => o instanceof Phaser.GameObjects.Image);
  if (!old || old.texture.key === key) return;
  const img = poseImage(scene, key, art.height);
  if (!img) return;
  img.setTint(0xd0d0d0);
  scene.tweens.killTweensOf(old);
  c.replace(old, img, true);
  scene.tweens.add({ targets: img, angle: { from: -2, to: 2 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** 第三幕拽绳 / 第四幕顺绳下降时，怪物换成的样子（交接文档 4.2 绳子事件） */
export const ROPE_VARIANT: Record<string, string> = {
  moving_door: 'moving_door_folded', // 门板折叠、卷起来缠住绳子
  piano: 'piano_strings', // 把琴弦吐出来缠住绳子
};
