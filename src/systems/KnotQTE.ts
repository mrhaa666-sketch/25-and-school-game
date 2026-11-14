import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TIMERS } from '../core/constants';
import { GameState } from '../core/GameState';
import { sanityTier } from '../core/progress';
import { COLORS, panel, textStyle } from './style';

const ARROWS = [
  { label: '↑', codes: ['ArrowUp', 'KeyW'] },
  { label: '↓', codes: ['ArrowDown', 'KeyS'] },
  { label: '←', codes: ['ArrowLeft', 'KeyA'] },
  { label: '→', codes: ['ArrowRight', 'KeyD'] },
];

/**
 * 打结 QTE（第三幕）。依次按下屏幕上的方向键，每个键限时。
 * 精神值越低提示越模糊：档位 3 半透明，档位 4 抖动 + 模糊。
 * 按错或超时 → 返回 false。
 */
export function runKnotQTE(scene: Phaser.Scene, title: string): Promise<boolean> {
  return new Promise((resolve) => {
    const n = TIMERS.knotKeys;
    const perKey = TIMERS.knotKeySec * 1000;
    const seq = Array.from({ length: n }, () => Phaser.Math.Between(0, ARROWS.length - 1));
    const tier = sanityTier(GameState.save.sanity);

    const W = 520;
    const H = 200;
    const X = (GAME_WIDTH - W) / 2;
    const Y = GAME_HEIGHT / 2 - H / 2 - 40;
    const root = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);
    root.add(panel(scene, X, Y, W, H, 0.92));
    root.add(scene.add.text(X + 24, Y + 18, title, textStyle(18, COLORS.textDim)));
    const keysLayer = scene.add.container(0, 0);
    root.add(keysLayer);
    const glyphs = seq.map((k, i) => {
      const t = scene.add.text(X + W / 2 + (i - (n - 1) / 2) * 80, Y + 100, ARROWS[k].label, textStyle(48, COLORS.textDim)).setOrigin(0.5);
      keysLayer.add(t);
      return t;
    });
    const bar = scene.add.graphics();
    root.add(bar);

    if (tier === 3) keysLayer.setAlpha(0.5);
    if (tier === 4) {
      keysLayer.setAlpha(0.65);
      glyphs.forEach((g) => g.preFX?.addBlur(1, 2, 2, 1.2));
    }

    let index = 0;
    // 用每帧 delta 累计，暂停（打开手机等）期间不会计时
    let elapsed = 0;
    let done = false;

    const render = () => {
      glyphs.forEach((g, i) => g.setColor(i < index ? '#4a4844' : i === index ? '#ffffff' : COLORS.textDim).setScale(i === index ? 1.15 : 1));
    };
    render();

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      scene.input.keyboard?.off('keydown', onKey);
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      if (!ok) {
        glyphs[Math.min(index, n - 1)].setColor('#a02020');
        scene.cameras.main.shake(200, 0.006);
      }
      scene.time.delayedCall(ok ? 250 : 600, () => {
        root.destroy();
        resolve(ok);
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (done || e.repeat) return;
      const hit = ARROWS.findIndex((a) => a.codes.includes(e.code));
      if (hit < 0) return;
      if (hit !== seq[index]) return finish(false);
      index++;
      elapsed = 0;
      if (index >= n) return finish(true);
      render();
    };

    const onUpdate = (_t: number, delta: number) => {
      if (done) return;
      elapsed += delta;
      const left = 1 - elapsed / perKey;
      bar.clear();
      bar.fillStyle(0x000000, 0.6).fillRect(X + 40, Y + H - 36, W - 80, 6);
      bar.fillStyle(left < 0.3 ? 0xa02020 : 0xb8b6b0, 1).fillRect(X + 40, Y + H - 36, (W - 80) * Math.max(0, left), 6);
      if (tier === 4) keysLayer.setPosition(Phaser.Math.Between(-4, 4), Phaser.Math.Between(-3, 3));
      if (left <= 0) finish(false);
    };

    scene.input.keyboard?.on('keydown', onKey);
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    // 中途离开场景（回到标题等）时清理监听
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      done = true;
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    });
  });
}
