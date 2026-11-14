import Phaser from 'phaser';
import { CHASE, GAME_HEIGHT, GAME_WIDTH, SANITY_COST, TIMERS } from '../core/constants';
import { GameState } from '../core/GameState';
import { Audio } from './audio';
import { makeFigure, makeMonsterById, PALETTE } from './figures';
import { hasAll, MAFUYU_STAND_REF, poseImage, tex } from './sprites';
import { textStyle } from './style';

/** 攀绳图里双手（拳头）的横向位置，占图宽的比例。对齐到绳子上 */
const CLIMB_HAND_X = 0.3;

export interface ClimbOptions {
  monsterId: string;
  monsterColor: number;
  monsterName: string;
  hint: string;
}

/**
 * 攀爬（第三幕）：连打 空格 / ↓ 顺着绳子往下爬，怪物在上面的窗口抓住绳子往上拉。
 * 限时内爬到三楼窗户 → true；超时 → false（结局 3）。
 * 每被拉回一段，精神值 -3。
 */
export function runClimb(scene: Phaser.Scene, o: ClimbOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const root = scene.add.container(0, 0).setDepth(990).setScrollFactor(0);
    const cx = GAME_WIDTH / 2;
    // 有外墙背景图时按图里两扇窗的位置排版（1920×1080 缩到 1280×720）
    const bgKey = tex('bg', 'climb_facade');
    const hasBg = hasAll(scene, [bgKey]);
    const topY = hasBg ? 205 : 150; // 四楼窗台（怪物站的位置）
    const startY = hasBg ? 330 : topY + 40; // 真冬一开始的脚底位置
    const goalY = hasBg ? 470 : 620; // 爬到这里就够到三楼的窗户

    if (hasBg) {
      root.add(scene.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setTint(0xb0b0b0));
    } else {
      const g = scene.add.graphics();
      g.fillStyle(0x07080b, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      g.fillStyle(0x15161a, 1).fillRect(cx - 260, 0, 520, GAME_HEIGHT);
      for (const wy of [topY - 70, goalY - 100]) {
        g.fillStyle(0x1e2a36, 1).fillRect(cx - 60, wy, 120, 110);
        g.lineStyle(2, 0x2c3440, 1).strokeRect(cx - 60, wy, 120, 110);
      }
      root.add(g);
    }
    root.add(scene.add.text(cx + 200, goalY - 90, '三楼', textStyle(14, '#55524c')));

    const rope = scene.add.line(0, 0, cx, topY - 4, cx, GAME_HEIGHT, 0xb8ab90).setOrigin(0).setLineWidth(2);
    root.add(rope);
    const monster = makeMonsterById(scene, cx, topY, o.monsterId, o.monsterColor, o.monsterName, 0.75).setVisible(false);
    root.add(monster);
    const climber = scene.add.container(cx, startY);
    // 攀绳图：手在绳子上，横向对齐到绳子
    const climbImg = poseImage(scene, 'mafuyu_climb', hasBg ? 100 : 120, MAFUYU_STAND_REF);
    if (climbImg) climber.add(climbImg.setOrigin(CLIMB_HAND_X, climbImg.originY));
    else climber.add(makeFigure(scene, 0, 0, { ...PALETTE.mafuyu }));
    root.add(climber);
    const hint = scene.add.text(cx, GAME_HEIGHT - 40, o.hint, textStyle(16, '#7d7a74')).setOrigin(0.5);
    root.add(hint);
    const timeBar = scene.add.graphics();
    root.add(timeBar);

    let progress = 0;
    let elapsed = 0;
    let nextPull = CHASE.climbPullStartSec * 1000;
    let done = false;
    const total = TIMERS.climbSec * 1000;

    const yFor = (p: number) => startY + ((goalY - startY) * p) / CHASE.climbGoal;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      scene.input.keyboard?.off('keydown', onKey);
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      if (ok) {
        scene.tweens.add({ targets: climber, x: cx - 40, duration: 300, yoyo: true });
        scene.time.delayedCall(700, () => {
          root.destroy();
          resolve(true);
        });
      } else {
        Audio.play('rope_creak', { rate: 0.8 });
        // 绳子被整个拉上去
        scene.tweens.add({ targets: climber, y: -80, duration: 2200, ease: 'Cubic.easeIn' });
        scene.time.delayedCall(2400, () => {
          root.destroy();
          resolve(false);
        });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (done || e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') {
        progress = Math.min(CHASE.climbGoal, progress + CHASE.climbPerPress);
        climber.y = yFor(progress);
        if (progress >= CHASE.climbGoal) finish(true);
      }
    };

    const onUpdate = (_t: number, delta: number) => {
      if (done) return;
      elapsed += delta;
      if (elapsed >= CHASE.climbPullStartSec * 1000) {
        monster.setVisible(true);
        progress = Math.max(0, progress - (CHASE.climbPullPerSec * delta) / 1000);
        if (elapsed >= nextPull) {
          nextPull += CHASE.climbPullEverySec * 1000;
          progress = Math.max(0, progress - CHASE.climbPullBack);
          GameState.deductSanity(SANITY_COST.ropePulled, 'rope');
          scene.cameras.main.shake(160, 0.006);
          Audio.play('rope_creak', { rate: Phaser.Math.FloatBetween(0.9, 1.1) });
          scene.tweens.add({ targets: monster, y: topY - 12, duration: 90, yoyo: true });
        }
      }
      climber.y = yFor(progress);
      rope.setTo(cx, topY - 4 - (monster.visible ? Math.sin(elapsed / 60) * 3 : 0), cx, GAME_HEIGHT);
      const left = Math.max(0, 1 - elapsed / total);
      timeBar.clear().fillStyle(0x8a1a1a, 0.8).fillRect(cx - 120, 24, 240 * left, 4);
      if (elapsed >= total) finish(false);
    };

    scene.input.keyboard?.on('keydown', onKey);
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      done = true;
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    });
  });
}
