import Phaser from 'phaser';
import { Audio } from '../systems/audio';
import { GameState } from '../core/GameState';
import { runClimb } from '../systems/ClimbGame';
import { ROPE_VARIANT } from '../systems/figures';
import { runKnotQTE } from '../systems/KnotQTE';
import { textStyle } from '../systems/style';
import { actKey, startAct, triggerEnding } from './flow';
import { RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

/**
 * 第三幕 · 四楼教室（绳子）。
 * 扯下一根绳子 → 系在窗边（打结 QTE，失败 → 结局 2）
 * → 顺绳下爬，怪物在上面拉（超时 → 结局 3）→ 荡进三楼 → 第四幕。
 */
export class Act03Scene extends RoomScene {
  private hasRope = false;
  private busy = false;
  private bangTimer = 0;

  constructor() {
    super(actKey(3));
  }

  private t(key: string): string[] {
    return this.text(`act03.${key}`);
  }

  create(): void {
    super.create();
    this.hasRope = false;
    this.busy = false;
    this.bangTimer = 2500;
    this.loadRoom('classroom4');
    this.facing = 'right';
    this.syncPlayer();
    this.drawRopes();
    this.cameras.main.fadeIn(800, 0, 0, 0);
    void this.cutscene(() => this.say(this.t('enter')));
  }

  /** 天花板上垂下来的绳子（装饰） */
  private drawRopes(): void {
    const g = this.add.graphics().setDepth(120);
    g.lineStyle(1.5, 0x8a7e66, 0.55);
    const rnd = new Phaser.Math.RandomDataGenerator(['ropes']);
    for (let i = 0; i < 26; i++) {
      const x = this.originX + rnd.between(60, 17 * 40 - 20);
      const y = this.originY + rnd.between(60, 9 * 40);
      g.lineBetween(x, this.originY + 40, x, y);
      g.strokeCircle(x, y + 6, 6);
    }
    this.roomLayer.add(g);
  }

  protected onUpdate(_time: number, delta: number): void {
    // 怪物在撞门
    if (this.busy) return;
    this.bangTimer -= delta;
    if (this.bangTimer <= 0) {
      this.bangTimer = Phaser.Math.Between(2200, 4200);
      const d = this.objectCenter('D');
      this.cameras.main.shake(180, 0.004);
      Audio.play('door_bang', { rate: Phaser.Math.FloatBetween(0.9, 1.05) });
      const t = this.add.text(d.x + 30, d.y - 20, this.textOne('act03.bang'), textStyle(18, '#7a6a6a')).setDepth(130);
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 16, duration: 900, onComplete: () => t.destroy() });
    }
  }

  protected onObject(obj: RoomObject): void {
    if (this.busy) return;
    const material = this.materialAtSpot(obj.spot);
    if (material) {
      void this.pickup(material, this.text(`act03.${obj.spot}_material`));
      return;
    }
    switch (obj.id) {
      case 'ropes':
        if (this.hasRope) return this.ui.say(this.t('ropes_again'));
        this.hasRope = true;
        return this.ui.say(this.t('ropes'));
      case 'window':
        if (!this.hasRope) return this.ui.say(this.t('window_no_rope'));
        void this.tieAndClimb();
        return;
      case 'lectern':
        return this.ui.say(this.t('lectern'));
      case 'desk':
        return this.ui.say(this.t('desk'));
      case 'blackboard':
        return this.ui.say(this.t('blackboard'));
      case 'door':
        return this.ui.say(this.t('door'));
    }
  }

  private async tieAndClimb(): Promise<void> {
    this.busy = true;
    this.menusOpen = false;
    await this.cutscene(async () => {
      await this.say(this.t('window_tie'));
      const ok = await runKnotQTE(this, this.textOne('act03.qte_title'));
      if (!ok) {
        // 绳结没绑好：往下爬时摔下去
        await this.say(this.t('climb_start'));
        this.cameras.main.shake(400, 0.015);
        Audio.play('fall_crash');
        this.cameras.main.fadeOut(400, 0, 0, 0);
        await this.wait(500);
        triggerEnding(this, 2);
        return;
      }
      await this.say(this.t('knot_ok'));
      await this.say(this.t('climb_start'));
      const m = GameState.cycleDef.monsterA;
      const climbed = await runClimb(this, {
        monsterId: ROPE_VARIANT[m.id] ?? m.id,
        monsterColor: Phaser.Display.Color.HexStringToColor(m.color).color,
        monsterName: m.name,
        hint: this.textOne('act03.climb_hint'),
      });
      if (!climbed) {
        triggerEnding(this, 3);
        return;
      }
      await this.say(this.t('climb_ok'));
      startAct(this, 4);
    });
  }
}
