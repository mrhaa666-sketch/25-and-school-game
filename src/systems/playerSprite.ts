import Phaser from 'phaser';
import { groupMetrics, hasAll, officialFrames, type Metrics } from './sprites';

type Dir = 'up' | 'down' | 'left' | 'right';

interface Group {
  walk: string[];
  idle: string[];
  fps: number;
  m: Metrics;
}

/** 游戏里真冬的身高（像素）。一格是 40px */
export const PLAYER_HEIGHT = 66;

/**
 * 真冬的行走动画。
 * - 朝下 / 朝上：官方小人的 6 帧走路（本地素材）；朝下站着时偶尔眨眼
 * - 朝左 / 朝右：GPT 生成的站立 + 迈步两帧
 * 任何一组缺图时 available() 返回 false，游戏继续用色块占位。
 */
export class MafuyuSprite {
  readonly image: Phaser.GameObjects.Image;
  private readonly groups: Record<Dir, Group>;
  private dir: Dir = 'down';
  private t = 0;
  private blinkIn = 2500;
  private blinkT = -1;

  static keys() {
    return {
      front: officialFrames('mafuyu', 'front'),
      back: officialFrames('mafuyu', 'back'),
      blink: officialFrames('mafuyu', 'blink'),
      left: ['mafuyu_left', 'mafuyu_left_walk'],
      right: ['mafuyu_right', 'mafuyu_right_walk'],
    };
  }

  /** 只要有侧面图（仓库里的 GPT 图）就能用；官方小人的正面 / 背面帧是可选的 */
  static available(scene: Phaser.Scene): boolean {
    const k = MafuyuSprite.keys();
    return hasAll(scene, [...k.left, ...k.right]);
  }

  /** 本地有没有官方小人的正面 / 背面帧（不在仓库里） */
  static hasOfficial(scene: Phaser.Scene): boolean {
    const k = MafuyuSprite.keys();
    return hasAll(scene, [...k.front, ...k.back, ...k.blink]);
  }

  private readonly blinkFrames: string[];

  constructor(scene: Phaser.Scene, private readonly height = PLAYER_HEIGHT) {
    const k = MafuyuSprite.keys();
    const side = (keys: string[]) => ({ walk: [keys[1], keys[0]], idle: [keys[0]], fps: 5, m: groupMetrics(scene, keys, [keys[0]]) });
    const official = MafuyuSprite.hasOfficial(scene);
    // 没有官方帧时，朝上 / 朝下也用侧面图（朝下用朝右的，朝上用朝左的），不再退回色块
    this.blinkFrames = official ? k.blink : [];
    this.groups = {
      down: official ? { walk: k.front, idle: [k.blink[0]], fps: 9, m: groupMetrics(scene, [...k.front, ...k.blink], k.blink) } : side(k.right),
      up: official ? { walk: k.back, idle: [k.back[0]], fps: 9, m: groupMetrics(scene, k.back, k.back) } : side(k.left),
      left: { walk: [k.left[1], k.left[0]], idle: [k.left[0]], fps: 5, m: groupMetrics(scene, k.left, [k.left[0]]) },
      right: { walk: [k.right[1], k.right[0]], idle: [k.right[0]], fps: 5, m: groupMetrics(scene, k.right, [k.right[0]]) },
    };
    this.image = scene.add.image(0, 0, this.groups.down.idle[0]);
    this.applyGroup('down');
  }

  private applyGroup(dir: Dir): void {
    this.dir = dir;
    const m = this.groups[dir].m;
    this.image.setOrigin(m.originX, m.originY).setScale(this.height * m.unit);
  }

  update(facing: Dir, moving: boolean, delta: number): void {
    if (facing !== this.dir) {
      this.applyGroup(facing);
      this.t = 0;
    }
    const g = this.groups[this.dir];
    if (moving) {
      this.t += delta / 1000;
      this.blinkT = -1;
      this.image.setTexture(g.walk[Math.floor(this.t * g.fps) % g.walk.length]);
      return;
    }
    this.t = 0;
    // 朝下站着时偶尔眨眼：01→04→01
    if (this.dir === 'down' && this.blinkFrames.length) {
      const blink = this.blinkFrames;
      if (this.blinkT < 0) {
        this.blinkIn -= delta;
        if (this.blinkIn <= 0) {
          this.blinkT = 0;
          this.blinkIn = Phaser.Math.Between(2500, 5500);
        }
      }
      if (this.blinkT >= 0) {
        this.blinkT += delta;
        const seq = [0, 1, 2, 3, 2, 1, 0];
        const i = Math.floor(this.blinkT / 55);
        if (i >= seq.length) this.blinkT = -1;
        else return void this.image.setTexture(blink[seq[i]]);
      }
    }
    this.image.setTexture(g.idle[0]);
  }
}
