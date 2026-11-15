import { GameState } from '../core/GameState';
import Phaser from 'phaser';
import { Audio, type SoundKey } from '../systems/audio';
import { makeFigure, PALETTE } from '../systems/figures';
import { PLAYER_HEIGHT } from '../systems/playerSprite';
import { officialFrames, poseImage } from '../systems/sprites';

/** 小学生版真冬的身高（真冬是 PLAYER_HEIGHT） */
const CHILD_HEIGHT = 52;
import { TILE } from '../core/constants';
import { actKey, startAct } from './flow';
import { RoomScene } from './RoomScene';

/**
 * 第一幕 · 校门外（仅一周目，不可操作）。
 * 四人深夜来到废弃学校的校门外 → 校门里面站着一个背对着的小女孩，只有真冬看得见
 * → 真冬走到校门前 → 小女孩的头转过来 → 一阵眩晕，真冬晕倒 → 在学校的医务室醒来（第二幕）。
 */
export class Act01Scene extends RoomScene {
  constructor() {
    super(actKey(1));
  }

  protected onObject(): void {}

  allowMenus(): boolean {
    return false;
  }

  protected ambience(): SoundKey | null {
    return 'amb_night';
  }

  create(): void {
    super.create();
    this.menusOpen = false;
    this.loadRoom('school_gate');
    this.locked = true;
    void this.play();
  }

  /** 眩晕：边说话边加重，最后几乎看不清 */
  private async dizzy(): Promise<void> {
    const cam = this.cameras.main;
    const fx = cam.postFX;
    const blur = fx?.addBlur(1, 0, 0, 0);
    const vig = fx?.addVignette(0.5, 0.5, 0.95, 0.2);
    const color = fx?.addColorMatrix();
    Audio.loop('dizzy', 'heartbeat', 600); // 不用 heart 频道：界面每帧会按精神值重设它
    const base = cam.zoom;
    const state = { k: 0 };
    // k 从 0 慢慢到 1：晃动幅度、模糊、暗角、拉近都跟着 k 走
    const t0 = this.time.now;
    const tick = () => {
      const k = state.k;
      const t = (this.time.now - t0) / 1000;
      cam.setRotation(Math.sin(t * 1.7) * 0.05 * k);
      cam.setZoom(base * (1 + 0.12 * k + Math.sin(t * 2.3) * 0.02 * k));
      if (blur) blur.strength = 2.5 * k;
      if (vig) vig.radius = 0.95 - 0.55 * k;
      if (color) {
        color.reset();
        color.saturate(-0.6 * k).brightness(1 - 0.35 * k, true);
      }
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
    this.tweens.add({ targets: state, k: 0.6, duration: 2200, ease: 'Sine.easeIn' });
    await this.say(this.text('act01.dizzy'));
    await this.tween({ targets: state, k: 1, duration: 1200, ease: 'Sine.easeIn' });
    await this.wait(400);
    this.events.off(Phaser.Scenes.Events.UPDATE, tick);
    Audio.loop('dizzy', null, 2000);
  }

  private async play(): Promise<void> {
    const cam = this.cameras.main;
    cam.fadeIn(1500, 0, 0, 0);

    // 其他三人：视线不朝走廊那边
    const member = (who: 'kanade' | 'ena' | 'mizuki', label: string) => {
      const c = this.add.container(0, 0);
      const front = officialFrames(who, 'blink')[0];
      const img = poseImage(this, front, PLAYER_HEIGHT, officialFrames(who, 'blink'));
      c.add(img ?? makeFigure(this, 0, 0, { ...PALETTE[who], label, pose: 'stand' }));
      return c;
    };
    const others = [member('kanade', '奏'), member('ena', '绘名'), member('mizuki', '瑞希')];
    const spots = [this.tileCenter(2, 2), this.tileCenter(2, 4), this.tileCenter(1, 3)];
    others.forEach((f, i) => {
      f.setPosition(spots[i].x, spots[i].y + 8);
      this.addShadow(f);
      this.ySort(f);
    });
    this.facing = 'right';
    this.syncPlayer();

    // 校门里面的小女孩：小学制服，发型和真冬小时候一样（不点破）
    const g = this.tileCenter(11, 1);
    const end = { x: g.x + TILE / 2, y: g.y };
    const girl = this.add.container(end.x, end.y + 8);
    const girlImg = poseImage(this, 'mafuyu_child_back', CHILD_HEIGHT);
    girl.add(girlImg ?? makeFigure(this, 0, 0, { ...PALETTE.mafuyuChild, pose: 'away', scale: 0.75 }));
    this.addShadow(girl, 22);
    this.ySort(girl);

    await this.wait(1600);
    await this.say(this.text('act01.opening'));
    await this.say(this.text('act01.girl'));
    await this.say(this.text('act01.what'));
    await this.say(this.text('act01.walk'));
    await this.walkPlayerTo(end.x - 60, end.y + 90, 110);
    this.facing = 'up';
    this.syncPlayer();
    await this.wait(900);

    // 头旋转 180 度：脸转过来，嘴角流下黑色液体
    if (girlImg && this.textures.exists('mafuyu_child_turned')) {
      await this.tween({ targets: girlImg, scaleX: girlImg.scaleX * 0.15, duration: 380, ease: 'Sine.easeIn' });
      girlImg.setTexture('mafuyu_child_turned');
      Audio.play('sting');
      this.cameras.main.shake(160, 0.004);
      await this.tween({ targets: girlImg, scaleX: girlImg.scaleY, duration: 380, ease: 'Sine.easeOut' });
    } else {
      const head = (girl.list[0] as Phaser.GameObjects.Container).list[2] as Phaser.GameObjects.Arc;
      await this.tween({ targets: head, scaleX: 0, duration: 450, ease: 'Sine.easeIn' });
      head.setFillStyle(0xd9cfe8);
      await this.tween({ targets: head, scaleX: 1, duration: 450, ease: 'Sine.easeOut' });
    }
    await this.wait(1200);

    // 一阵眩晕：画面晃、慢慢拉近、越来越模糊、四周变暗，心跳声越来越响
    await this.dizzy();
    // 真冬倒下，黑屏
    this.setPlayerPose('mafuyu_fallen', () => makeFigure(this, 0, 0, { ...PALETTE.mafuyu, pose: 'lie' }));
    Audio.play('fall_crash', { volume: 0.35, rate: 0.8 });
    cam.fadeOut(1600, 0, 0, 0);
    await this.wait(2800);
    if (GameState.save.act === 1) startAct(this, 2);
  }
}
