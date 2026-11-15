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
    const perKey = TIMERS.knotKeySec * 1000 * 1.6; // 放宽：初次玩的人要先找键
    let slips = 0; // 按错或超时：绳结松一下，前两次还能重来
    const seq = Array.from({ length: n }, () => Phaser.Math.Between(0, ARROWS.length - 1));
    const tier = sanityTier(GameState.save.sanity);

    const W = 520;
    const H = 200;
    const X = (GAME_WIDTH - W) / 2;
    const Y = scene.textures.exists('bg:knot_closeup') ? GAME_HEIGHT - H - 30 : GAME_HEIGHT / 2 - H / 2 - 40;
    const root = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);
    // 有特写图时铺满画面（窗框、绳圈、手），按键框放在下面
    const close = 'bg:knot_closeup';
    if (scene.textures.exists(close)) {
      const bg = scene.add.image(0, 0, close).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setTint(0xb0b0b0).setAlpha(0);
      root.add(bg);
      scene.tweens.add({ targets: bg, alpha: 1, duration: 400 });
    }
    root.add(panel(scene, X, Y, W, H, 0.92));
    root.add(scene.add.text(X + 24, Y + 18, title, textStyle(18, COLORS.textDim)));
    const tip = scene.add.text(X + W / 2, Y + H - 58, '依次按下亮着的方向键（WASD / 方向键）', textStyle(14, COLORS.textDim)).setOrigin(0.5);
    root.add(tip);
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

    /** 失手：前两次只是绳结松了一下，从这一步重来；第三次才真的失败 */
    const slip = () => {
      slips++;
      if (slips >= 3) return finish(false);
      elapsed = 0;
      scene.cameras.main.shake(160, 0.005);
      glyphs[index].setColor('#a02020');
      tip.setText(slips === 1 ? '绳结松了一下……再来（还能失手 1 次）' : '再松就绑不住了（最后一次机会）').setColor('#c87070');
      scene.time.delayedCall(350, () => !done && render());
    };

    const onKey = (e: KeyboardEvent) => {
      if (done || e.repeat) return;
      const hit = ARROWS.findIndex((a) => a.codes.includes(e.code));
      if (hit < 0) return;
      if (hit !== seq[index]) return slip();
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
      if (left <= 0) slip();
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
