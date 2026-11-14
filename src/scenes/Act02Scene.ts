import Phaser from 'phaser';
import { CHASE, SANITY_COST } from '../core/constants';
import { GameState } from '../core/GameState';
import { makeMonster } from '../systems/figures';
import { actKey, startAct, triggerEnding } from './flow';
import { type Actor, RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

/**
 * 第二幕 · 四楼医务室 → 走廊 → 追逐战 1。
 * 走到楼梯口附近，【怪物 A】出现并冲过来；只能往走廊另一头跑，
 * 进入尽头的教室并锁上门 → 第三幕。被抓到 → 结局 1。
 */
export class Act02Scene extends RoomScene {
  private chase: 'before' | 'running' | 'done' = 'before';
  private monster?: Actor;
  private classLockedSaid = false;

  constructor() {
    super(actKey(2));
  }

  private t(key: string): string[] {
    return this.text(`act02.${key}`);
  }

  create(): void {
    super.create();
    this.chase = 'before';
    this.monster = undefined;
    this.classLockedSaid = false;
    this.loadRoom('infirmary');
    this.locked = true;
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    this.time.delayedCall(900, () => this.ui.say(this.t('wake'), () => (this.locked = false)));
  }

  protected onEnterRoom(roomId: string, firstTime: boolean): void {
    if (roomId === 'corridor4' && firstTime) this.time.delayedCall(300, () => this.ui.say(this.t('door_out')));
  }

  protected onExit(ch: string): boolean {
    if (this.room.id !== 'corridor4') return false;
    if (ch === '1' && this.chase === 'running') {
      // 追逐中回不了医务室
      this.bounceBack();
      return true;
    }
    if (ch === '2') {
      if (this.chase === 'before') {
        this.bounceBack();
        if (!this.classLockedSaid) {
          this.classLockedSaid = true;
          this.ui.say(this.t('class_locked'));
        }
        return true;
      }
      if (this.chase === 'running') this.escape();
      return true;
    }
    return false;
  }

  protected onObject(obj: RoomObject): void {
    const material = this.materialAtSpot(obj.spot);
    if (material) {
      void this.pickup(material, this.text(`act02.${obj.spot}_material`));
      return;
    }
    switch (obj.id) {
      case 'bed':
        return this.ui.say(this.t('bedhead_empty'));
      case 'bed2':
        return this.ui.say(this.t('bed'));
      case 'mirror':
        return this.mirror();
      case 'cabinet':
        return this.ui.say(this.t('cabinet'));
      case 'desk':
        return this.ui.say(this.t('desk'));
      case 'corridor_window':
        return this.ui.say(this.t('corridor_window'));
    }
  }

  /** 镜子：镜中身后站着一个人影，回头什么都没有。每周目一次 -5。 */
  private mirror(): void {
    const s = GameState.save;
    if (s.mirrorSeenThisCycle || GameState.isFinal) return this.ui.say(this.t('mirror_again'));
    GameState.patch({ mirrorSeenThisCycle: true });
    const lines = this.t('mirror');
    void this.cutscene(async () => {
      await this.say(lines[0]);
      const shadow = this.add.rectangle(this.player.x, this.player.y + 30, 26, 52, 0x000000, 0.85).setDepth(99);
      this.cameras.main.flash(120, 40, 0, 0);
      GameState.deductSanity(SANITY_COST.mirror, 'mirror');
      await this.wait(260);
      shadow.destroy();
      await this.wait(240);
      await this.say(lines.slice(1));
    });
  }

  // ------------------------------------------------------------ 追逐战 1

  protected onUpdate(_time: number, delta: number): void {
    if (this.room?.id !== 'corridor4' || GameState.isFinal) return;
    if (this.chase === 'before' && this.playerTile().x >= 25) this.startChase();
    if (this.chase === 'running' && this.monster && !this.locked) {
      this.moveActor(this.monster, this.pos.x, this.pos.y, delta / 1000);
      if (this.distToPlayer(this.monster) < CHASE.caughtDist) this.caught();
    }
  }

  private startChase(): void {
    this.chase = 'running';
    const def = GameState.cycleDef.monsterA;
    const color = Phaser.Display.Color.HexStringToColor(def.color).color;
    const at = this.tileCenter(30, 2);
    // 怪物穿墙出现在楼梯口；碰撞盒设为 0，沿走廊直线追
    this.monster = this.addActor(makeMonster(this, 0, 0, color, def.name), at.x, at.y + 12, CHASE.chase1Speed);
    this.monster.obj.setAlpha(0);
    this.tweens.add({ targets: this.monster.obj, alpha: 1, duration: 200 });
    this.cameras.main.shake(250, 0.008);
    this.cameras.main.flash(100, 60, 0, 0);
    // 停顿一下再冲过来，给玩家反应时间
    this.locked = false;
    this.monster.speed = 0;
    this.time.delayedCall(CHASE.chase1Delay, () => {
      if (this.monster) this.monster.speed = CHASE.chase1Speed;
    });
  }

  private caught(): void {
    if (this.chase !== 'running') return;
    this.chase = 'done';
    this.locked = true;
    this.cameras.main.shake(300, 0.012);
    this.cameras.main.fadeOut(600, 30, 0, 0);
    this.time.delayedCall(700, () => triggerEnding(this, 1));
  }

  private escape(): void {
    this.chase = 'done';
    void this.cutscene(async () => {
      this.player.setVisible(false);
      this.cameras.main.shake(400, 0.01);
      await this.say(this.t('class_enter'));
      startAct(this, 3);
    });
  }
}
