import { GameState } from '../core/GameState';
import { makeFigure, PALETTE } from '../systems/figures';
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
    const others = [
      makeFigure(this, 0, 0, { ...PALETTE.kanade, label: '奏', pose: 'stand' }),
      makeFigure(this, 0, 0, { ...PALETTE.ena, label: '绘名', pose: 'stand' }),
      makeFigure(this, 0, 0, { ...PALETTE.mizuki, label: '瑞希', pose: 'stand' }),
    ];
    const spots = [this.tileCenter(2, 2), this.tileCenter(2, 4), this.tileCenter(1, 3)];
    others.forEach((f, i) => f.setPosition(spots[i].x, spots[i].y + 8).setDepth(90));
    this.facing = 'right';
    this.syncPlayer();

    // 走廊尽头的小女孩：小学制服，发型和真冬小时候一样（不点破）
    const end = this.tileCenter(29, 3);
    const girl = makeFigure(this, end.x, end.y + 8, { ...PALETTE.mafuyuChild, pose: 'away', scale: 0.75 }).setDepth(95);

    await this.wait(1600);
    await this.say(this.text('act01.opening'));
    await this.say(this.text('act01.girl'));
    await this.say(this.text('act01.what'));
    await this.say(this.text('act01.walk'));
    await this.walkPlayerTo(end.x - 70, this.pos.y, 125);
    await this.wait(900);

    // 头旋转 180 度：占位演出——背影换成正脸，嘴角流下黑色液体
    const head = girl.list[2] as Phaser.GameObjects.Arc;
    await this.tween({ targets: head, scaleX: 0, duration: 450, ease: 'Sine.easeIn' });
    head.setFillStyle(0xd9cfe8);
    const smile = this.add.arc(0, -32, 5, 20, 160, false, 0x000000, 0).setStrokeStyle(1.5, 0x111111);
    const drip = this.add.rectangle(3, -28, 2, 1, 0x050505).setOrigin(0.5, 0);
    girl.add([smile, drip]);
    await this.tween({ targets: head, scaleX: 1, duration: 450, ease: 'Sine.easeOut' });
    this.tween({ targets: drip, scaleY: 22, duration: 1400 });
    await this.wait(1600);

    // 黑屏，真冬晕倒
    cam.fadeOut(120, 0, 0, 0);
    await this.wait(1500);
    if (GameState.save.act === 1) startAct(this, 2);
  }
}
