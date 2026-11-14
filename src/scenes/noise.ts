import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';

/**
 * 「刺耳的声音」的画面表现（音效在 M6 加入）：随机的横向干扰条 + 轻微抖动。
 * 返回停止函数。
 */
export function startNoise(scene: Phaser.Scene, intensity = 1): () => void {
  const layer = scene.add.container(0, 0).setDepth(350).setScrollFactor(0);
  const timer = scene.time.addEvent({
    delay: 140,
    loop: true,
    callback: () => {
      if (Math.random() > 0.45 * intensity) return;
      const h = Phaser.Math.Between(2, 10);
      const bar = scene.add.rectangle(0, Phaser.Math.Between(0, GAME_HEIGHT), GAME_WIDTH, h, Math.random() < 0.5 ? 0xffffff : 0x000000, Phaser.Math.FloatBetween(0.05, 0.18) * intensity).setOrigin(0);
      layer.add(bar);
      scene.tweens.add({ targets: bar, alpha: 0, duration: 160, onComplete: () => bar.destroy() });
      if (Math.random() < 0.15 * intensity) scene.cameras.main.shake(80, 0.002 * intensity);
    },
  });
  return () => {
    timer.remove();
    layer.destroy();
  };
}
