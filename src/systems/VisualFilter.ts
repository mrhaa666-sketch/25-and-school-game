import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { GameState } from '../core/GameState';
import { EdgeBlurPipeline } from './EdgeBlurPipeline';
import { sanityTier, type SanityTier } from '../core/progress';

/**
 * 档位 → 暗角参数。inner/outer 是相对屏幕对角线一半的比例。
 * 档位 4「视野只剩中央一圈」。
 */
const VIGNETTE: Record<SanityTier, { inner: number; outer: number; edge: number; dim: number }> = {
  1: { inner: 0.55, outer: 1.05, edge: 0.55, dim: 0 },
  2: { inner: 0.4, outer: 0.9, edge: 0.8, dim: 0.12 },
  3: { inner: 0.24, outer: 0.62, edge: 0.95, dim: 0.2 },
  4: { inner: 0.1, outer: 0.34, edge: 1, dim: 0.25 },
};

/** 灯管闪烁的频率（毫秒） */
const FLICKER: Record<SanityTier, [number, number]> = {
  1: [6000, 14000],
  2: [4000, 9000],
  3: [2500, 6000],
  4: [900, 2500],
};

/**
 * 叠加在游戏画面之上的精神值滤镜：暗角、整体压暗、灯管闪烁。
 * 去饱和与画面抖动作用在游戏场景自己的镜头上，见 applyCameraFx。
 */
export class VisualFilter {
  private readonly vignette: Phaser.GameObjects.Image;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly flicker: Phaser.GameObjects.Rectangle;
  private tier: SanityTier | 0 = 0;
  private nextFlicker = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setDepth(600);
    this.vignette = scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(601);
    this.flicker = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setDepth(602);
  }

  /** 场景里不需要滤镜时（标题、结局演出）关掉 */
  setActive(on: boolean): void {
    this.dim.setVisible(on);
    this.vignette.setVisible(on);
    this.flicker.setVisible(on);
  }

  update(time: number): void {
    if (GameState.isFinal) {
      this.setActive(false);
      return;
    }
    this.setActive(true);
    const tier = sanityTier(GameState.save.sanity);
    if (tier !== this.tier) {
      this.tier = tier;
      this.redraw(tier);
    }
    if (time >= this.nextFlicker) {
      const first = this.nextFlicker === 0;
      const [a, b] = FLICKER[tier];
      this.nextFlicker = time + Phaser.Math.Between(a, b);
      if (!first) this.flick(tier);
    }
  }

  private flick(tier: SanityTier): void {
    const strength = 0.35 + tier * 0.1;
    this.scene.tweens.chain({
      targets: this.flicker,
      tweens: [
        { fillAlpha: strength, duration: 40 },
        { fillAlpha: 0, duration: 60 },
        { fillAlpha: strength * 0.8, duration: 30, delay: 70 },
        { fillAlpha: 0, duration: 120 },
      ],
    });
  }

  private redraw(tier: SanityTier): void {
    const key = `vignette-${tier}`;
    if (!this.scene.textures.exists(key)) {
      const v = VIGNETTE[tier];
      const tex = this.scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (!tex) return;
      const ctx = tex.getContext();
      const cx = GAME_WIDTH / 2;
      const cy = GAME_HEIGHT / 2;
      const r = Math.hypot(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, r * v.inner, cx, cy, r * v.outer);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${v.edge})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      tex.refresh();
    }
    this.vignette.setTexture(key);
    this.dim.setFillStyle(0x000000, VIGNETTE[tier].dim);
  }
}

/**
 * 作用在游戏场景镜头上的效果：档位 3 去饱和，档位 4 更强的去饱和 + 周期性抖动。
 * 返回一个 update 函数，由场景每帧调用。
 */
/** 档位 → 视野边缘模糊：最外圈的模糊半径（像素）与开始模糊的位置（0 中央 ~ 1 角落） */
const EDGE_BLUR: Record<SanityTier, { strength: number; inner: number }> = {
  1: { strength: 0, inner: 1 },
  2: { strength: 2.2, inner: 0.55 },
  3: { strength: 3.6, inner: 0.4 },
  4: { strength: 5.5, inner: 0.25 },
};

export function createCameraFx(camera: Phaser.Cameras.Scene2D.Camera): (time: number) => void {
  const matrix = camera.postFX?.addColorMatrix();
  // 视野边缘模糊（只有 WebGL 才有）
  let blur: EdgeBlurPipeline | undefined;
  if (camera.scene.game.renderer.type === Phaser.WEBGL) {
    camera.setPostPipeline(EdgeBlurPipeline);
    blur = camera.getPostPipeline(EdgeBlurPipeline) as EdgeBlurPipeline;
  }
  let tier: SanityTier | 0 = 0;
  let nextShake = 0;
  return (time: number) => {
    if (GameState.isFinal) {
      matrix?.reset();
      if (blur) blur.strength = 0;
      return;
    }
    const t = sanityTier(GameState.save.sanity);
    if (t !== tier) {
      tier = t;
      if (blur) Object.assign(blur, EDGE_BLUR[t]);
      if (matrix) {
        matrix.reset();
        if (t === 2) matrix.brightness(0.9, true);
        if (t === 3) matrix.saturate(-0.5, true).brightness(0.85, true);
        if (t === 4) matrix.saturate(-0.75, true).brightness(0.8, true);
      }
    }
    if (t === 4 && time >= nextShake) {
      nextShake = time + Phaser.Math.Between(1500, 3500);
      camera.shake(Phaser.Math.Between(150, 400), 0.003);
    }
  };
}
