import Phaser from 'phaser';
import { CHASE, GAME_HEIGHT, GAME_WIDTH, SANITY_COST, TILE, TIMERS } from '../core/constants';
import { GameState } from '../core/GameState';
import { hintLevel } from '../core/progress';
import { ashBurst, makeFigure, makeMonsterById, PALETTE, ROPE_VARIANT } from '../systems/figures';
import { fitImage, tex } from '../systems/sprites';
import { actKey, startAct, triggerEnding } from './flow';
import { drawMemberScene, hasMemberOverlay, showMemberOverlay } from './memberScenes';
import { type Actor, RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

/** 在成员场景前停留多久开始扣（毫秒） */
const LINGER_MS = 5000;
const LINGER_DIST = 100;

/**
 * 第四幕 · 三楼。
 * 荡进三楼教室 → 成员场景 → 楼上的怪物顺绳往下爬 → 讲台拿剪刀，剪断自己那根绳子
 * → 走廊：对面的门被撞开，涌出怪物群，走廊被无限拉长 → 坚持 30 秒后出现考场门 → 第五幕。
 * 被追上 → 结局 4。
 */
export class Act04Scene extends RoomScene {
  private hasScissors = false;
  private ropeCut = false;
  private memberSeen = false;
  private lingerMs = 0;
  private descending?: Phaser.GameObjects.Container;
  private descentTween?: Phaser.Tweens.Tween;
  /** 四周目：被乐谱割伤的时间（3 次在 4 秒内 → 被追上） */
  private cuts: number[] = [];
  private trash?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private ropeLine?: Phaser.GameObjects.Line;
  // 追逐战 2
  private chase: 'none' | 'intro' | 'running' | 'done' = 'none';
  private swarm: { a: Actor; dy: number }[] = [];
  private elapsed = 0;
  private nearAcc = 0;
  private examDoorX: number | null = null;
  private redEdge?: Phaser.GameObjects.Image;

  constructor() {
    super(actKey(4));
  }

  private t(key: string): string[] {
    return this.text(`act04.${key}`);
  }

  create(): void {
    super.create();
    Object.assign(this, { hasScissors: false, ropeCut: false, memberSeen: false, lingerMs: 0, chase: 'none', swarm: [], elapsed: 0, nearAcc: 0, examDoorX: null });
    this.descending = undefined;
    this.descentTween = undefined;
    this.cuts = [];
    this.trash = undefined;
    this.ropeLine = undefined;
    this.loadRoom('classroom3');
    this.facing = 'right';
    this.syncPlayer();
    this.cameras.main.fadeIn(600, 0, 0, 0);
    void this.intro();
  }

  private memberPos(): { x: number; y: number } {
    return this.objectCenter('E');
  }

  protected onEnterRoom(roomId: string): void {
    if (roomId === 'classroom3') {
      const p = this.memberPos();
      this.roomLayer.add(drawMemberScene(this, GameState.cycleDef.scenes.floor3, p.x, p.y + 14));
    }
  }

  private async intro(): Promise<void> {
    await this.cutscene(async () => {
      await this.wait(500);
      await this.say(this.t('enter'));
      // 看到成员场景，站着不动
      this.facing = 'right';
      this.syncPlayer();
      const id = GameState.cycleDef.scenes.floor3;
      const close = hasMemberOverlay(this, id) ? showMemberOverlay(this, id) : null;
      await this.wait(2200);
      await this.say(this.t('member'));
      await close?.();
      // 楼上传来嘶吼，窗外的绳子绷紧，怪物正在往下爬
      this.cameras.main.shake(400, 0.006);
      this.startDescent();
      await this.say(this.t('roar'));
    });
  }

  /** 窗外：真冬自己那根绳子，和顺着它往下爬的怪物 */
  private startDescent(): void {
    const w = this.objectCenter('W');
    const x = this.originX - 18;
    this.ropeLine = this.add.line(0, 0, x, 0, x, w.y + 20, 0xb8ab90).setOrigin(0).setLineWidth(2).setDepth(80);
    const m = GameState.cycleDef.monsterA;
    this.descending = makeMonsterById(this, x, -20, ROPE_VARIANT[m.id] ?? m.id, Phaser.Display.Color.HexStringToColor(m.color).color, m.name, 0.8).setDepth(81);
    // 慢慢往下，停在窗口上方。剪断之前它不会下来，但一直在那里
    this.descentTween = this.tweens.add({ targets: this.descending, y: w.y - 50, duration: 14000, ease: 'Sine.easeOut' });
  }

  // ------------------------------------------------------------ 调查

  protected onObject(obj: RoomObject): void {
    switch (obj.id) {
      case 'locker3': {
        // 三楼储物柜：只在三周目能打开（日记本）
        const m = this.materialAtSpot(obj.spot);
        if (m) return void this.pickup(m, this.t('locker_material'));
        return this.ui.say(this.t(GameState.save.cycle === 3 ? 'locker_empty' : 'locker_locked'));
      }
      case 'lectern':
        if (!this.hasScissors) {
          this.hasScissors = true;
          return this.ui.say(this.t('lectern_scissors'));
        }
        return this.ui.say(this.t('lectern'));
      case 'window':
        if (!this.ropeCut) {
          if (this.hasScissors) void this.cutRope();
          else this.ui.say(this.t('window_before'));
          return;
        }
        {
          const m = this.materialAtSpot(obj.spot);
          if (m) void this.pickup(m, this.t('window_material'));
          else this.ui.say(this.t('window_after'));
        }
        return;
      case 'member_scene':
        if (!this.memberSeen) {
          this.memberSeen = true;
          GameState.deductSanity(SANITY_COST.floor3Scene, 'floor3');
        }
        {
          const id = GameState.cycleDef.scenes.floor3;
          if (hasMemberOverlay(this, id)) {
            const close = showMemberOverlay(this, id);
            this.ui.say(this.t('member_investigate'), () => void close());
            return;
          }
        }
        return this.ui.say(this.t('member_investigate'));
      case 'desk':
        return this.ui.say(this.t('desk'));
      case 'blackboard':
        return this.ui.say(this.t('blackboard'));
      case 'class_door':
        return this.ui.say(this.t('class_door'));
    }
  }

  private async cutRope(): Promise<void> {
    await this.cutscene(async () => {
      await this.say(this.t('cut'));
      this.ropeCut = true;
      this.tweens.killTweensOf(this.descending!);
      const fallY = GAME_HEIGHT + 80;
      this.ropeLine?.destroy();
      this.canvasBleeds();
      await this.tween({ targets: this.descending, y: fallY, duration: 700, ease: 'Cubic.easeIn' });
      const ai = GameState.cycleDef.monsterA.ai;
      const x = this.descending!.x;
      if (ai === 'statue') this.chunks(x, GAME_HEIGHT - 20, 0xd8d4cc); // 碎成石膏块，再化成灰
      if (ai === 'piano') this.cameras.main.flash(120, 90, 90, 90); // 琴弦乱响一声
      this.cameras.main.shake(ai === 'piano' ? 380 : 200, ai === 'piano' ? 0.012 : 0.006);
      this.time.delayedCall(ai === 'statue' ? 500 : 0, () => ashBurst(this, x, GAME_HEIGHT - 20));
      this.descending?.destroy();
      await this.wait(800);
      await this.say(this.t('fall'));
      await this.say(this.t('after_cut'));
    });
  }

  /** 二~四周目：剪断时，画布上的颜料往下流 */
  private canvasBleeds(): void {
    if (GameState.cycleDef.scenes.floor3 !== 'canvas_ena') return;
    const img = this.roomLayer.list
      .filter((o): o is Phaser.GameObjects.Container => o instanceof Phaser.GameObjects.Container && o.name === 'floor3_canvas')
      .map((c) => c.list[0])[0];
    if (img instanceof Phaser.GameObjects.Image && this.textures.exists(tex('scn', 'floor3_canvas_cut'))) {
      img.setTexture(tex('scn', 'floor3_canvas_cut'));
      this.tweens.add({ targets: img, scaleY: img.scaleY * 1.03, y: img.y + 2, duration: 2400, ease: 'Sine.easeOut' });
    }
  }

  private chunks(x: number, y: number, color: number): void {
    for (let i = 0; i < 12; i++) {
      const p = this.add.rectangle(x, y - 20, Phaser.Math.Between(4, 9), Phaser.Math.Between(4, 9), color).setDepth(150);
      this.tweens.add({ targets: p, x: x + Phaser.Math.Between(-60, 60), y: y + Phaser.Math.Between(-30, 20), angle: Phaser.Math.Between(-90, 90), alpha: 0, duration: 900, onComplete: () => p.destroy() });
    }
  }

  protected onExit(ch: string): boolean {
    if (this.room.id === 'classroom3' && ch === '1') {
      if (!this.ropeCut) {
        this.bounceBack();
        this.ui.say(this.t('door_before'));
        return true;
      }
      this.loadRoom('corridor3_long', '1');
      void this.chaseIntro();
      return true;
    }
    if (this.room.id === 'corridor3_long') {
      this.bounceBack(); // 回不去了
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ 停留扣除 / 追逐

  protected onUpdate(_time: number, delta: number): void {
    if (this.room.id === 'classroom3' && this.descentTween && !this.ropeCut && GameState.cycleDef.monsterA.ai === 'statue') {
      // 石膏像：真冬看着窗口（面朝左）时停住，移开视线才继续往下爬
      const watching = this.facing === 'left';
      if (watching && this.descentTween.isPlaying()) this.descentTween.pause();
      if (!watching && this.descentTween.isPaused()) this.descentTween.resume();
    }
    if (this.room.id === 'classroom3') {
      const p = this.memberPos();
      if (Phaser.Math.Distance.Between(p.x, p.y, this.pos.x, this.pos.y) < LINGER_DIST && !this.locked) {
        this.lingerMs += delta;
        if (this.lingerMs >= LINGER_MS) {
          this.lingerMs -= LINGER_MS;
          GameState.deductSanity(SANITY_COST.floor3SceneLinger, 'floor3-linger');
        }
      } else this.lingerMs = 0;
      return;
    }
    if (this.chase === 'running') this.updateChase(delta);
  }

  private async chaseIntro(): Promise<void> {
    this.chase = 'intro';
    this.ensureRedEdge();
    await this.cutscene(async () => {
      this.facing = 'down';
      this.syncPlayer();
      await this.wait(400);
      await this.say(this.t('corridor_bang'));
      for (let i = 0; i < 3; i++) {
        this.cameras.main.shake(160, 0.008);
        await this.wait(380 - i * 80);
      }
      // 门被撞开
      const d = this.objectCenter('B');
      this.add.rectangle(d.x, d.y, 76, 34, 0x000000).setDepth(5);
      this.cameras.main.flash(120, 50, 0, 0);
      this.spawnSwarm(d.x, d.y - 30);
      await this.wait(350);
    });
    this.facing = 'right';
    this.syncPlayer();
    this.elapsed = 0;
    this.chase = 'running';
  }

  private spawnSwarm(x: number, y: number): void {
    const def = GameState.cycleDef.monsterB;
    const color = Phaser.Display.Color.HexStringToColor(def.color).color;
    for (let i = 0; i < CHASE.chase2Count; i++) {
      let obj: Phaser.GameObjects.Container;
      if (def.id === 'mafuyus') {
        // 一周目：小时候、初中、高中、成为医生之后的真冬，带着诡异的微笑
        const variants = [
          { ...PALETTE.mafuyuChild, scale: 0.75 },
          { ...PALETTE.mafuyu, body: 0x2a2a3a, scale: 0.9 },
          { ...PALETTE.mafuyu },
          { ...PALETTE.mafuyu, body: 0xe8e8e8 },
          { ...PALETTE.mafuyu, body: 0x3a3a4a },
        ];
        obj = makeFigure(this, 0, 0, variants[i % variants.length]);
        obj.add(this.add.arc(0, -32, 5, 20, 160, false, 0, 0).setStrokeStyle(1.5, 0x111111));
      } else {
        obj = makeMonsterById(this, 0, 0, def.id, color, i === 0 ? def.name : '', 0.85);
      }
      const a = this.addActor(obj, x - i * 18, y + (i % 3) * 10, CHASE.chase2Speed * Phaser.Math.FloatBetween(0.94, 1.04), 0, 0);
      this.swarm.push({ a, dy: ((i % 3) - 1) * 26 });
    }
  }

  private updateChase(delta: number): void {
    const dt = delta / 1000;
    this.elapsed += delta;
    const top = this.tileCenter(0, 1).y + 4;
    const bottom = this.tileCenter(0, 3).y + 18;
    let nearest = Infinity;
    const scores = GameState.cycleDef.monsterB.id === 'flying_scores';
    for (const { a, dy } of this.swarm) {
      // 乐谱在空中翻飞：上下飘
      const wobble = scores ? Math.sin((this.elapsed + a.speed * 40) / 260) * 30 : 0;
      this.moveActor(a, this.pos.x, Phaser.Math.Clamp(this.pos.y + dy + wobble, top, bottom), dt);
      a.y = Phaser.Math.Clamp(a.y, top, bottom);
      if (scores && this.distToPlayer(a) < CHASE.caughtDist + 6) {
        this.scoreCut(a);
        continue;
      }
      nearest = Math.min(nearest, this.distToPlayer(a));
    }
    if (!scores && nearest < CHASE.caughtDist) return this.caught();

    // 近距离：屏幕边缘泛红，每持续 1 秒 -1
    const near = nearest < CHASE.chase2NearDist;
    this.redEdge?.setAlpha(near ? 0.35 + 0.5 * (1 - nearest / CHASE.chase2NearDist) : Math.max(0, (this.redEdge?.alpha ?? 0) - dt * 2));
    if (near) {
      this.nearAcc += delta;
      while (this.nearAcc >= 1000) {
        this.nearAcc -= 1000;
        GameState.deductSanity(SANITY_COST.chase2Near, 'chase2-near');
      }
    } else this.nearAcc = 0;

    // 坚持够时间后，前方出现一扇教室门
    if (this.examDoorX === null && this.elapsed >= TIMERS.chase2Sec * 1000) {
      const tx = Math.min(this.playerTile().x + 7, this.room.map[0].length - 3);
      const c = this.tileCenter(tx, 0);
      this.examDoorX = c.x;
      const doorImg = fitImage(this, tex('obj', 'class_door'), { x: c.x - 22, y: c.y - TILE * 1.2 - 20, w: 44, h: TILE * 1.2 + 40 });
      const door = doorImg ?? this.add.rectangle(c.x, c.y + 4, 34, 40, 0x6a5a48).setStrokeStyle(2, 0xb8a888);
      door.setDepth(6);
      this.tweens.add({ targets: door, alpha: { from: 0, to: 1 }, duration: 400 });
      this.clearSwarm();
      this.placeTrash(tx - 2);
    }
    if (this.examDoorX !== null && Math.abs(this.pos.x - this.examDoorX) < 22) {
      this.chase = 'done';
      this.redEdge?.setAlpha(0);
      this.player.setVisible(false);
      startAct(this, 5);
    }
  }

  /** 四周目：被飞散的乐谱割伤 -5，乐谱被弹开。4 秒内被割 3 次 → 被追上 */
  private scoreCut(a: Actor): void {
    GameState.deductSanity(SANITY_COST.scoreCut, 'score-cut');
    this.cameras.main.flash(90, 120, 0, 0);
    a.x -= 170;
    a.obj.setPosition(a.x, a.y);
    const now = this.elapsed;
    this.cuts = [...this.cuts.filter((t) => now - t < 4000), now];
    if (this.cuts.length >= 3) this.caught();
  }

  /** 坚持够时间：考场门出现，怪物群停下、散去 */
  private clearSwarm(): void {
    this.redEdge?.setAlpha(0);
    for (const { a } of this.swarm) {
      a.speed = 0;
      this.tweens.add({ targets: a.obj, alpha: 0, duration: 1200, onComplete: () => a.obj.setVisible(false) });
    }
    this.swarm = [];
  }

  /** 考场门旁边的垃圾桶（追逐路线上的材料：追逐结束后再调查） */
  private placeTrash(tx: number): void {
    const c = this.tileCenter(tx, 3);
    this.trash = fitImage(this, tex('obj', 'trash_can'), { x: c.x - 18, y: c.y - 30, w: 36, h: 52 }) ?? this.add.rectangle(c.x, c.y, 24, 30, 0x3a3a3a);
    this.trash.setDepth(7);
    const m = this.materialsHere().find((x) => x.spot === 'trash_can');
    if (m && hintLevel(GameState.save) >= 1) {
      const dot = this.add.circle(c.x, c.y - 10, 3, 0xfff6d0, 0.8).setDepth(8);
      this.tweens.add({ targets: dot, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  onInteract(): void {
    if (this.trash && !this.locked && Phaser.Math.Distance.Between(this.trash.x, this.trash.y, this.pos.x, this.pos.y) < 60) {
      const m = this.materialsHere().find((x) => x.spot === 'trash_can');
      if (m) void this.pickup(m, this.t('trash_material'));
      else this.ui.say(this.t('trash'));
      return;
    }
    super.onInteract();
  }

  private caught(): void {
    if (this.chase !== 'running') return;
    this.chase = 'done';
    this.locked = true;
    this.redEdge?.setAlpha(0.9);
    // 怪物群围上来
    this.swarm.forEach(({ a }, i) => {
      const ang = (i / this.swarm.length) * Math.PI * 2;
      this.tweens.add({ targets: a.obj, x: this.pos.x + Math.cos(ang) * 30, y: this.pos.y + Math.sin(ang) * 14, duration: 500 });
    });
    this.cameras.main.fadeOut(1400, 0, 0, 0);
    this.time.delayedCall(1500, () => triggerEnding(this, 4));
  }

  private ensureRedEdge(): void {
    const key = 'red-edge';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 260, GAME_WIDTH / 2, GAME_HEIGHT / 2, 760);
        grad.addColorStop(0, 'rgba(120,0,0,0)');
        grad.addColorStop(1, 'rgba(150,0,0,0.9)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        tex.refresh();
      }
    }
    this.redEdge = this.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(400).setAlpha(0);
  }
}
