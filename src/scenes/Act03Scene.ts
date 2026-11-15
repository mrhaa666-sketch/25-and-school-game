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
  /** 走到窗边看过下面（引导：之后才提示用绳子） */
  private windowSeen = false;
  private hints: Phaser.GameObjects.GameObject[] = [];
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
    this.windowSeen = false;
    this.hints = [];
    this.busy = false;
    this.bangTimer = 2500;
    this.loadRoom('classroom4');
    this.facing = 'right';
    this.syncPlayer();
    this.drawRopes();
    this.cameras.main.fadeIn(800, 0, 0, 0);
    void this.cutscene(() => this.say(this.t('enter'))).then(() => this.hintAt('W'));
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

  protected objective(): string | null {
    if (this.busy) return null;
    if (!this.windowSeen) return '找办法离开教室（去右边的窗户看看）';
    if (!this.hasRope) return '扯下一根天花板上挂着的绳子';
    return '把绳子系在右边的窗户上';
  }

  /** 发光的小点：提示可以调查的地方 */
  // 改由 keyTargets 的发光来提示
  private hintAt(ch: string): void {
    void ch;
  }


  private clearHints(): void {
    this.hints.forEach((h) => h.destroy());
    this.hints = [];
  }

  /** 走到窗边：看到下面是三楼，想到用绳子 */
  private async seeWindow(): Promise<void> {
    this.windowSeen = true;
    await this.cutscene(async () => {
      this.facing = 'right';
      this.syncPlayer();
      await this.say(this.t('window_found'));
    });
    this.clearHints();
    if (!this.hasRope) this.hintAt('r');
    else this.hintAt('W');
  }

  protected onUpdate(_time: number, delta: number): void {
    // 走到窗边附近：触发「用绳子荡下去」的剧情
    if (!this.windowSeen && !this.locked && !this.busy) {
      const w = this.objectCenter('W');
      if (Phaser.Math.Distance.Between(w.x, w.y, this.pos.x, this.pos.y) < 120) void this.seeWindow();
    }
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

  protected keyTargets(): string[] {
    if (this.busy) return [];
    if (!this.windowSeen) return ['W'];
    return this.hasRope ? ['W'] : ['r'];
  }

  protected verbFor(ch: string, tile: { x: number; y: number }): string {
    const id = this.room.objects[ch]?.id;
    if (id === 'ropes') return this.hasRope ? '看看绳子' : '扯下一根绳子';
    if (id === 'window') return this.hasRope ? '把绳子系在窗边' : '看看窗外';
    if (id === 'door') return '推门';
    return super.verbFor(ch, tile);
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
        this.clearHints();
        this.hintAt('W');
        return this.ui.say(this.t('ropes'));
      case 'window':
        if (!this.windowSeen) return void this.seeWindow();
        if (!this.hasRope) return this.ui.say(this.t('window_no_rope'));
        this.clearHints();
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
      // 先换到三楼再说「荡进了三楼的窗户」（第四幕开头会说）
      this.cameras.main.fadeOut(300, 0, 0, 0);
      await this.wait(350);
      this.registry.set('fromRope', true);
      startAct(this, 4);
    });
  }
}
