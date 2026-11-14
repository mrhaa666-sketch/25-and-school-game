import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { GameState } from '../core/GameState';
import { sanityTier, type SanityTier } from '../core/progress';
import { tRaw } from '../core/text';
import { textStyle } from './style';

/** 档位 → 出现间隔（毫秒，区间）与一次出现几个 */
const SPAWN: Record<SanityTier, { min: number; max: number; burst: number; size: [number, number] }> = {
  1: { min: 40000, max: 70000, burst: 1, size: [18, 22] },
  2: { min: 12000, max: 22000, burst: 1, size: [20, 26] },
  3: { min: 3500, max: 7000, burst: 2, size: [22, 32] },
  4: { min: 700, max: 1600, burst: 3, size: [26, 46] },
};

/**
 * 从屏幕边缘浮现、停留、淡出的文字（交接文档 2.1 屏幕文字）。
 * 只出现在边缘带，不遮挡画面中央和左上角 HUD。
 */
export class ScreenText {
  private nextAt = 0;
  private readonly layer: Phaser.GameObjects.Container;
  enabled = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.layer = scene.add.container(0, 0).setDepth(700);
  }

  update(time: number): void {
    if (!this.enabled || GameState.isFinal) {
      this.nextAt = time + 2000;
      return;
    }
    const tier = sanityTier(GameState.save.sanity);
    if (this.nextAt === 0) this.nextAt = time + Phaser.Math.Between(SPAWN[tier].min, SPAWN[tier].max) * 0.5;
    if (time < this.nextAt) return;
    const cfg = SPAWN[tier];
    this.nextAt = time + Phaser.Math.Between(cfg.min, cfg.max);
    for (let i = 0; i < cfg.burst; i++) this.spawn(tier);
  }

  /** 精神值变化后立即重新排期，避免高档位时还在等低档位的长间隔 */
  reschedule(time: number): void {
    const cfg = SPAWN[sanityTier(GameState.save.sanity)];
    this.nextAt = Math.min(this.nextAt, time + cfg.max);
  }

  private words(): string[] {
    const base = tRaw<string[]>('screenWords');
    return GameState.save.blankPaperThisCycle ? [...base, tRaw<string>('screenWordBlankPaper')] : base;
  }

  private color(tier: SanityTier): string {
    if (tier === 1) return '#000000';
    if (tier === 3) return '#ffffff';
    if (tier === 4) return '#a01818';
    // 档位 2：黑 → 白 过渡（75 黑，51 白）
    const k = Phaser.Math.Clamp((75 - GameState.save.sanity) / 24, 0, 1);
    const v = Math.round(k * 255);
    return Phaser.Display.Color.RGBToString(v, v, v);
  }

  private spawn(tier: SanityTier): void {
    const pool = this.words();
    const word = pool[Phaser.Math.Between(0, pool.length - 1)];
    const size = Phaser.Math.Between(...SPAWN[tier].size);
    const { x, y } = this.edgePoint(tier);
    const t = this.scene.add
      .text(x, y, word, textStyle(size, this.color(tier)))
      .setOrigin(0.5)
      .setAlpha(0)
      .setAngle(tier === 4 ? Phaser.Math.Between(-8, 8) : 0);
    this.layer.add(t);
    const hold = tier === 4 ? Phaser.Math.Between(400, 1200) : Phaser.Math.Between(1200, 2400);
    this.scene.tweens.chain({
      targets: t,
      tweens: [
        { alpha: tier === 1 ? 0.55 : 0.85, duration: 600 },
        { alpha: tier === 1 ? 0.55 : 0.85, duration: hold },
        { alpha: 0, duration: 900 },
      ],
      onComplete: () => t.destroy(),
    });
  }

  /** 随机取边缘带上的一点。档位越高，边缘带越宽（覆盖画面边缘） */
  private edgePoint(tier: SanityTier): { x: number; y: number } {
    const band = tier === 4 ? 170 : tier === 3 ? 120 : 80;
    for (let tries = 0; tries < 10; tries++) {
      const side = Phaser.Math.Between(0, 3);
      let x: number;
      let y: number;
      // 文字以中心定位，左右各留 120px，保证最长的词也不会被屏幕边缘裁掉
      if (side === 0) [x, y] = [Phaser.Math.Between(120, GAME_WIDTH - 120), Phaser.Math.Between(40, band)];
      else if (side === 1) [x, y] = [Phaser.Math.Between(120, GAME_WIDTH - 120), GAME_HEIGHT - Phaser.Math.Between(40, band)];
      else if (side === 2) [x, y] = [Phaser.Math.Between(120, band + 80), Phaser.Math.Between(60, GAME_HEIGHT - 60)];
      else [x, y] = [GAME_WIDTH - Phaser.Math.Between(120, band + 80), Phaser.Math.Between(60, GAME_HEIGHT - 60)];
      const hitsHud = x < 460 && y < 100;
      if (!hitsHud) return { x, y };
    }
    return { x: GAME_WIDTH - 120, y: GAME_HEIGHT - 60 };
  }
}
