import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { sanityTier, type SanityTier } from '../core/progress';
import { GameState } from '../core/GameState';

/**
 * 黑暗层：一张盖住视野的黑色渲染纹理，在上面「擦」出光的区域。
 *
 * 光有三类：玩家身上的光（半径随精神值档位缩小）、房间里的固定光源（窗下、门口），
 * 以及演出临时加的光。光效贴图（assets/sprites/lights/，黑底）没到时用代码生成的径向渐变。
 *
 * 只有视野、玩家或光的亮度变了才重画，不每帧重建。
 */

/**
 * 档位 → 玩家的光（屏幕像素）和光外的黑暗程度。
 * 由原来以屏幕中心为圆心的暗角换算过来：inner 内全亮，outer 处全暗。
 */
export const PLAYER_LIGHT: Record<SanityTier, { inner: number; outer: number; dark: number }> = {
  1: { inner: 170, outer: 470, dark: 0.74 },
  2: { inner: 130, outer: 380, dark: 0.82 },
  3: { inner: 90, outer: 280, dark: 0.9 },
  4: { inner: 45, outer: 180, dark: 0.96 },
};

export interface LightSource {
  /** 光效贴图名（sprites/lights/ 下，不带扩展名）；没有就用通用的柔光 */
  tex?: string;
  /** 世界坐标 */
  x: number;
  y: number;
  /** 光的半径（世界像素） */
  radius: number;
  /** 0~1 */
  intensity: number;
  /** 纵向压扁（地面上的光斑是扁的） */
  squash?: number;
}

const SOFT = 'light-soft';

/** 黑底光效图 → 以亮度作为透明度的笔刷，才能用来擦黑暗 */
function brushFor(scene: Phaser.Scene, name: string | undefined): string {
  if (name) {
    const src = `light:${name}`;
    const key = `light-brush:${name}`;
    if (scene.textures.exists(key)) return key;
    if (scene.textures.exists(src)) {
      const img = scene.textures.get(src).getSourceImage() as HTMLImageElement;
      const tex = scene.textures.createCanvas(key, img.width, img.height);
      if (tex) {
        const ctx = tex.getContext();
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i + 3] = Math.max(d[i], d[i + 1], d[i + 2]);
          d[i] = d[i + 1] = d[i + 2] = 255;
        }
        ctx.putImageData(data, 0, 0);
        tex.refresh();
        return key;
      }
    }
  }
  if (!scene.textures.exists(SOFT)) {
    const s = 256;
    const tex = scene.textures.createCanvas(SOFT, s, s);
    if (tex) {
      const ctx = tex.getContext();
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      tex.refresh();
    }
  }
  return SOFT;
}

/** 玩家的光：inner 以内全亮，到 outer 渐暗。每档一张 */
function playerBrush(scene: Phaser.Scene, tier: SanityTier): string {
  if (scene.textures.exists('light:light_player')) return brushFor(scene, 'light_player');
  const key = `light-player-${tier}`;
  if (!scene.textures.exists(key)) {
    const { inner, outer } = PLAYER_LIGHT[tier];
    const s = 256;
    const tex = scene.textures.createCanvas(key, s, s);
    if (tex) {
      const ctx = tex.getContext();
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(inner / outer, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      tex.refresh();
    }
  }
  return key;
}

export class Darkness {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly stamp: Phaser.GameObjects.Image;
  private sig = '';
  /** 节拍明灭：0 正常，越大越暗（调制全局亮度） */
  beat = 0;
  /** 关掉黑暗层（终周目） */
  enabled = true;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
  ) {
    // 比视野略大一圈，镜头抖动时边缘不会露出来
    this.rt = scene.add.renderTexture(0, 0, GAME_WIDTH + 64, GAME_HEIGHT + 64).setOrigin(0).setDepth(depth);
    this.stamp = scene.make.image({ x: 0, y: 0, key: SOFT }, false).setOrigin(0.5);
    brushFor(scene, undefined);
  }

  get object(): Phaser.GameObjects.RenderTexture {
    return this.rt;
  }

  /**
   * @param player 玩家脚底的世界坐标（光的中心在身体中间）
   * @param lights 其余光源
   */
  update(player: { x: number; y: number } | null, lights: LightSource[]): void {
    const on = this.enabled && !GameState.isFinal;
    this.rt.setVisible(on);
    if (!on) return;
    const cam = this.scene.cameras.main;
    const zoom = cam.zoom;
    const view = cam.worldView;
    const tier = sanityTier(GameState.save.sanity);
    const pl = PLAYER_LIGHT[tier];
    const pad = 32 / zoom;
    const ox = Math.floor(view.x - pad);
    const oy = Math.floor(view.y - pad);
    const w = Math.ceil(view.width + pad * 2);
    const h = Math.ceil(view.height + pad * 2);
    const beat = Phaser.Math.Clamp(this.beat, 0, 1);
    const sig = [
      ox, oy, w, h, tier, beat.toFixed(2),
      player ? `${Math.round(player.x)},${Math.round(player.y)}` : '-',
      ...lights.map((l) => `${Math.round(l.x)},${Math.round(l.y)},${l.radius},${l.intensity.toFixed(2)}`),
    ].join('|');
    if (sig === this.sig) return;
    this.sig = sig;

    // 渲染纹理用世界尺寸；放大镜头时它跟着放大，正好盖住视野
    if (this.rt.width !== w || this.rt.height !== h) this.rt.resize(w, h);
    this.rt.setPosition(ox, oy);
    this.rt.clear();
    const dark = pl.dark + (1 - pl.dark) * beat * 0.6;
    this.rt.fill(0x000000, dark);
    const lightK = 1 - beat * 0.7;

    const erase = (key: string, x: number, y: number, rx: number, ry: number, alpha: number) => {
      if (alpha <= 0.01) return;
      this.stamp.setTexture(key).setDisplaySize(rx * 2, ry * 2).setAlpha(Math.min(1, alpha));
      this.rt.erase(this.stamp, x - ox, y - oy);
    };
    if (player) {
      // 玩家光的大小按屏幕像素定，镜头放大时换算回世界尺寸，保证看到的范围一致
      const r = pl.outer / zoom;
      erase(playerBrush(this.scene, tier), player.x, player.y - 30, r, r, lightK);
    }
    for (const l of lights) {
      erase(brushFor(this.scene, l.tex), l.x, l.y, l.radius, l.radius * (l.squash ?? 1), l.intensity * lightK);
    }
  }

  destroy(): void {
    this.rt.destroy();
    this.stamp.destroy();
  }
}
