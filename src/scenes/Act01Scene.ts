import { GameState } from '../core/GameState';
import Phaser from 'phaser';
import { makeFigure, PALETTE } from '../systems/figures';
import { PLAYER_HEIGHT } from '../systems/playerSprite';
import { officialFrames, poseImage } from '../systems/sprites';

/** 小学生版真冬的身高（真冬是 PLAYER_HEIGHT） */
const CHILD_HEIGHT = 52;
import { actKey, startAct } from './flow';
import { RoomScene } from './RoomScene';

/**
 * 第一幕 · 废弃学校（仅一周目，不可操作）。
 * 四人深夜来到门口 → 走廊尽头站着一个背对着的小女孩，只有真冬看得见
 * → 真冬走过去 → 小女孩的头转过来 → 黑屏。
 */
export class Act01Scene extends RoomScene {
  constructor() {
    super(actKey(1));
  }

  protected onObject(): void {}

  allowMenus(): boolean {
    return false;
  }

  create(): void {
    super.create();
    this.menusOpen = false;
    this.loadRoom('school_gate');
    this.locked = true;
    void this.play();
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
    others.forEach((f, i) => f.setPosition(spots[i].x, spots[i].y + 8).setDepth(90 + i));
    this.facing = 'right';
    this.syncPlayer();

    // 走廊尽头的小女孩：小学制服，发型和真冬小时候一样（不点破）
    const end = this.tileCenter(29, 3);
    const girl = this.add.container(end.x, end.y + 8).setDepth(95);
    const girlImg = poseImage(this, 'mafuyu_child_back', CHILD_HEIGHT);
    girl.add(girlImg ?? makeFigure(this, 0, 0, { ...PALETTE.mafuyuChild, pose: 'away', scale: 0.75 }));

    await this.wait(1600);
    await this.say(this.text('act01.opening'));
    await this.say(this.text('act01.girl'));
    await this.say(this.text('act01.what'));
    await this.say(this.text('act01.walk'));
    await this.walkPlayerTo(end.x - 70, this.pos.y, 125);
    await this.wait(900);

    // 头旋转 180 度：脸转过来，嘴角流下黑色液体
    if (girlImg && this.textures.exists('mafuyu_child_turned')) {
      await this.tween({ targets: girlImg, scaleX: girlImg.scaleX * 0.15, duration: 380, ease: 'Sine.easeIn' });
      girlImg.setTexture('mafuyu_child_turned');
      this.cameras.main.shake(160, 0.004);
      await this.tween({ targets: girlImg, scaleX: girlImg.scaleY, duration: 380, ease: 'Sine.easeOut' });
    } else {
      const head = (girl.list[0] as Phaser.GameObjects.Container).list[2] as Phaser.GameObjects.Arc;
      await this.tween({ targets: head, scaleX: 0, duration: 450, ease: 'Sine.easeIn' });
      head.setFillStyle(0xd9cfe8);
      await this.tween({ targets: head, scaleX: 1, duration: 450, ease: 'Sine.easeOut' });
    }
    await this.wait(1800);

    // 黑屏，真冬晕倒
    cam.flash(80, 0, 0, 0);
    this.setPlayerPose('mafuyu_fallen', () => makeFigure(this, 0, 0, { ...PALETTE.mafuyu, pose: 'lie' }));
    cam.fadeOut(1400, 0, 0, 0);
    await this.wait(2600);
    if (GameState.save.act === 1) startAct(this, 2);
  }
}
