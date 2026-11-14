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

  static available(scene: Phaser.Scene): boolean {
    const k = MafuyuSprite.keys();
    return hasAll(scene, [...k.front, ...k.back, ...k.blink, ...k.left, ...k.right]);
  }

  constructor(scene: Phaser.Scene, private readonly height = PLAYER_HEIGHT) {
    const k = MafuyuSprite.keys();
    const down = [...k.front, ...k.blink];
    this.groups = {
      down: { walk: k.front, idle: [k.blink[0]], fps: 9, m: groupMetrics(scene, down, k.blink) },
      up: { walk: k.back, idle: [k.back[0]], fps: 9, m: groupMetrics(scene, k.back, k.back) },
      left: { walk: [k.left[1], k.left[0]], idle: [k.left[0]], fps: 5, m: groupMetrics(scene, k.left, [k.left[0]]) },
      right: { walk: [k.right[1], k.right[0]], idle: [k.right[0]], fps: 5, m: groupMetrics(scene, k.right, [k.right[0]]) },
    };
    this.image = scene.add.image(0, 0, k.blink[0]);
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
    if (this.dir === 'down') {
      const blink = MafuyuSprite.keys().blink;
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
