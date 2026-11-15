import Phaser from 'phaser';
import { Audio } from '../systems/audio';
import { CHASE, SANITY_COST, TILE } from '../core/constants';
import { GameState } from '../core/GameState';
import { makeMonsterById } from '../systems/figures';
import { godMode } from './debug';
import { actKey, startAct, triggerEnding } from './flow';
import { hintLevel } from '../core/progress';
import { tex } from '../systems/sprites';
import { type Actor, DIR_VEC, RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

/**
 * 第二幕 · 四楼医务室 → 走廊 → 追逐战 1。
 * 走到楼梯口附近，【怪物 A】出现并冲过来；只能往走廊另一头跑，
 * 进入尽头的教室并锁上门 → 第三幕。被抓到 → 结局 1。
 */
export class Act02Scene extends RoomScene {
  private chase: 'before' | 'intro' | 'running' | 'done' = 'before';
  private monster?: Actor;
  private classLockedSaid = false;
  /** 三周目：医务室药柜里的钥匙（打开四楼锁着的教室） */
  private hasKey = false;
  // 怪物 A 的行为状态
  private seen = false;
  private dashMs = 0;
  private cooldownMs = 0;
  private stareMs = 0;
  private heading = Math.PI;

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
    this.hasKey = false;
    this.seen = false;
    this.dashMs = 0;
    this.cooldownMs = 0;
    this.stareMs = 0;
    this.heading = Math.PI;
    // 追逐中被抓之后重来：直接回到走廊，护士出现之前（不用再从医务室走一遍）
    if (this.registry.get('retryFrom') === 'chase1') {
      this.registry.set('retryFrom', null);
      this.classLockedSaid = true;
      this.loadRoom('corridor4', undefined, { x: 22, y: 2 });
      this.facing = 'right';
      this.syncPlayer();
      this.cameras.main.fadeIn(600, 0, 0, 0);
      return;
    }
    this.loadRoom('infirmary');
    this.locked = true;
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    this.time.delayedCall(900, () => void this.cutscene(() => this.say(this.t('wake'))));
  }

  protected onEnterRoom(roomId: string, firstTime: boolean): void {
    if (roomId === 'corridor4' && firstTime && !this.classLockedSaid) {
      this.time.delayedCall(300, () => this.ui.say(this.t('door_out')));
      this.time.delayedCall(2200, () => Audio.play('cart', { volume: 0.7 })); // 远处有推车滚过
    }
    if (roomId === 'infirmary' && this.cabinetHint()) {
      // 补充周目（瑞希主题）的提示：药柜的柜门微微开着
      this.objectImages.get('K')?.forEach((i) => i.setTexture(tex('obj', 'medicine_cabinet_open')));
    }
    if (firstTime && ['art_prep4', 'locked_class4', 'music_prep4'].includes(roomId)) {
      this.time.delayedCall(300, () => this.ui.say(this.text(`act02.enter_${roomId}`)));
    }
  }

  private cabinetHint(): boolean {
    const s = GameState.save;
    return s.cycle === 3 && hintLevel(s) >= 1 && !s.materials.includes('mizuki_ribbon') && !this.hasKey;
  }

  /** 四楼的限定房间：只在对应周目能进（锁着的教室还需要钥匙） */
  private limitedRoomOpen(ch: string): boolean {
    const c = GameState.save.cycle;
    if (ch === '3') return c === 2;
    if (ch === '4') return c === 3 && this.hasKey;
    if (ch === '5') return c === 4;
    return false;
  }

  protected onExit(ch: string): boolean {
    if (this.room.id !== 'corridor4') return false;
    if (ch === '3' || ch === '4' || ch === '5') {
      if (this.chase === 'running' || !this.limitedRoomOpen(ch)) {
        this.bounceBack();
        if (this.chase !== 'running') {
          const keyed = ch === '4' && GameState.save.cycle === 3;
          this.ui.say(this.t(keyed ? 'locked_class_no_key' : 'limited_locked'));
        }
        return true;
      }
      return false; // 交给基类切换房间
    }
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
        // 三周目：药柜里有锁着的教室的钥匙
        if (GameState.save.cycle === 3 && !this.hasKey && !GameState.hasMaterial('mizuki_ribbon')) {
          this.hasKey = true;
          this.objectImages.get('K')?.forEach((i) => i.setTexture(tex('obj', 'medicine_cabinet')));
          return this.ui.say(this.t('cabinet_key'));
        }
        return this.ui.say(this.t('cabinet'));
      case 'easel':
        return this.ui.say(this.t('easel'));
      case 'shelf':
        return this.ui.say(this.t('shelf'));
      case 'prep_desk':
        return this.ui.say(this.t('prep_desk'));
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
      Audio.play('sting');
      GameState.deductSanity(SANITY_COST.mirror, 'mirror');
      await this.wait(260);
      shadow.destroy();
      await this.wait(240);
      await this.say(lines.slice(1));
    });
  }

  // ------------------------------------------------------------ 追逐战 1

  protected isChasing(): boolean {
    return this.chase === 'running';
  }

  protected onUpdate(_time: number, delta: number): void {
    if (this.room?.id !== 'corridor4' || GameState.isFinal) return;
    if (this.chase === 'before' && this.playerTile().x >= 25) this.startChase();
    if (this.chase === 'running' && this.monster && !this.locked) {
      // 逃生门的判定放宽：跑到门前一格以内就算进去了
      const t = this.findTile('2');
      if (t) {
        const c = this.tileCenter(t.x, t.y);
        if (Math.abs(this.pos.x - c.x) < TILE * 0.9 && this.pos.y - c.y < TILE * 1.6) return this.escape();
      }
      this.stepMonster(this.monster, delta);
      const reach = GameState.cycleDef.monsterA.ai === 'piano' ? CHASE.caughtDist + 10 : CHASE.caughtDist;
      if (this.distToPlayer(this.monster) < reach) this.caught();
    }
  }

  /** 真冬是不是正看着怪物（面朝它的方向） */
  private facingMonster(m: Actor): boolean {
    const v = DIR_VEC[this.facing];
    const dx = m.x - this.pos.x;
    const dy = m.y - this.pos.y;
    const len = Math.hypot(dx, dy) || 1;
    return (v.x * dx + v.y * dy) / len > 0.55;
  }

  /**
   * 怪物 A 的行为（交接文档 7.2）：
   * - linear：沿走廊直线追，速度略低于真冬奔跑
   * - statue（石膏像）：真冬看着它时不动；背对时比真冬走路快。直视超过 3 秒起每 3 秒 -3
   * - door（会移动的门）：平时慢慢靠近；被看见的那一瞬间冲过来一段
   * - piano（钢琴）：速度快，转弯慢
   */
  private stepMonster(m: Actor, delta: number): void {
    const dt = delta / 1000;
    if (m.speed === 0) return; // 刚出现时的停顿
    const ai = GameState.cycleDef.monsterA.ai;
    const looking = this.facingMonster(m);
    if (ai === 'statue') {
      if (looking) {
        this.stareMs += delta;
        if (this.stareMs >= 3000) {
          this.stareMs -= 3000;
          GameState.deductSanity(SANITY_COST.plasterStare, 'plaster-stare');
        }
        return; // 被看着：一动不动
      }
      this.stareMs = 0;
      this.moveActor(m, this.pos.x, this.pos.y, dt, 215);
      return;
    }
    if (ai === 'door') {
      if (looking && !this.seen && this.cooldownMs <= 0) {
        this.dashMs = 340; // 被看见：冲过来
        this.cameras.main.shake(120, 0.004);
        Audio.play('door_bang', { volume: 0.6, rate: 1.3 });
      }
      this.seen = looking;
      if (this.dashMs > 0) {
        this.dashMs -= delta;
        if (this.dashMs <= 0) this.cooldownMs = 900;
        this.moveActor(m, this.pos.x, this.pos.y, dt, 520);
        return;
      }
      this.cooldownMs -= delta;
      this.moveActor(m, this.pos.x, this.pos.y, dt, 120);
      return;
    }
    if (ai === 'piano') {
      // 朝向只能慢慢转：每秒最多转 1.4 弧度
      const want = Math.atan2(this.pos.y - m.y, this.pos.x - m.x);
      const diff = Phaser.Math.Angle.Wrap(want - this.heading);
      this.heading += Phaser.Math.Clamp(diff, -1.4 * dt, 1.4 * dt);
      const sp = 235;
      m.x += Math.cos(this.heading) * sp * dt;
      m.y += Math.sin(this.heading) * sp * dt;
      // 走廊上下有墙：撞墙就贴着墙（最下面一排可走的格子在底墙上方）
      const top = this.tileCenter(0, 1).y + 4;
      const bottom = this.tileCenter(0, this.room.map.length - 2).y + 18;
      m.y = Phaser.Math.Clamp(m.y, top, bottom);
      m.obj.setPosition(Math.round(m.x), Math.round(m.y));
      return;
    }
    this.moveActor(m, this.pos.x, this.pos.y, dt);
  }

  /** 遇到怪物 A：先演一段，再开始追（L 引导：告诉玩家往哪里逃） */
  private startChase(): void {
    this.chase = 'intro';
    const def = GameState.cycleDef.monsterA;
    const color = Phaser.Display.Color.HexStringToColor(def.color).color;
    const at = this.tileCenter(30, 2);
    // 怪物出现在楼梯口；碰撞盒设为 0，沿走廊直线追
    this.monster = this.addActor(makeMonsterById(this, 0, 0, def.id, color, def.name), at.x, at.y + 12, 0);
    this.heading = Math.PI; // 钢琴一开始朝走廊另一头
    this.monster.obj.setAlpha(0);
    const name = def.name;
    void this.cutscene(async () => {
      this.facing = 'right';
      this.syncPlayer();
      Audio.play('sting', { volume: 0.6 });
      await this.tween({ targets: this.monster!.obj, alpha: 1, duration: 1400 });
      await this.say(this.t('monster_appear').map((l) => l.replace('{monster}', name)));
      this.cameras.main.shake(300, 0.01);
      this.cameras.main.flash(100, 60, 0, 0);
      Audio.play('roar');
      await this.wait(300);
      // 最左边那间教室的门开了：画成半开的门，告诉玩家往哪里逃
      const t = this.findTile('2');
      if (t) {
        const c = this.tileCenter(t.x, t.y);
        this.drawDoor({ id: 'class_door', color: 0, tex: 'class_door' }, c.x, c.y + TILE / 2, undefined, 0, true);
      }
      Audio.play('door_open', { volume: 0.5 });
      // 镜头转过去，让玩家亲眼看到开了的那扇门，再转回来
      const cam = this.cameras.main;
      const door = t ? this.tileCenter(t.x, t.y) : null;
      if (door) {
        cam.stopFollow();
        cam.pan(door.x, door.y + TILE, 700, 'Sine.easeInOut');
        await this.wait(750);
        await this.say(this.t('door_opened'));
        cam.pan(this.player.x, this.player.y, 500, 'Sine.easeInOut');
        await this.wait(550);
        cam.startFollow(this.player, true, 0.12, 0.12);
      } else await this.say(this.t('door_opened'));
      this.facing = 'left';
      this.syncPlayer();
    });
    // 演出结束后才开始追；再停顿一下给玩家反应时间
    const begin = () => {
      if (this.locked) return void this.time.delayedCall(100, begin);
      this.chase = 'running';
      this.seen = true; // 出现时本来就在视野里：要先移开视线、再看回去，门才会冲过来
      this.cooldownMs = 0;
      this.time.delayedCall(CHASE.chase1Delay, () => {
        if (this.monster) this.monster.speed = CHASE.chase1Speed;
      });
    };
    this.time.delayedCall(100, begin);
  }

  /** 逃生门：追逐中在门口亮一块光 */
  protected keyTargets(): string[] {
    if (this.chase === 'running' && this.room.id === 'corridor4') {
      const t = this.findTile('2');
      if (t) {
        const c = this.tileCenter(t.x, t.y);
        this.extraLights = [{ x: c.x, y: c.y + TILE, radius: TILE * 2, intensity: 0.85, squash: 0.7 }];
      }
    }
    return [];
  }

  protected objective(): string | null {
    if (this.chase === 'running') return '逃进走廊最左边那间开了门的教室！';
    if (this.chase !== 'before') return null;
    if (this.room.id === 'infirmary') return '离开医务室（下方的门）';
    if (this.room.id === 'corridor4') return '门都锁着。沿着走廊往右，走到尽头看看';
    return '回到走廊';
  }

  private caught(): void {
    if (godMode()) return; // 开发者模式：无敌
    if (this.chase !== 'running') return;
    this.chase = 'done';
    this.locked = true;
    this.cameras.main.shake(300, 0.012);
    this.cameras.main.fadeOut(600, 30, 0, 0);
    this.registry.set('retryFrom', 'chase1');
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
