import Phaser from 'phaser';
import { Audio } from '../systems/audio';
import { CHASE, GAME_HEIGHT, GAME_WIDTH, SANITY_COST, TILE, TIMERS } from '../core/constants';
import { GameState } from '../core/GameState';
import { hintLevel } from '../core/progress';
import { ashBurst, makeFigure, makeMonsterById, PALETTE, ROPE_VARIANT } from '../systems/figures';
import { fitImage, poseImage, tex } from '../systems/sprites';
import { godMode } from './debug';
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
  private examDoorY = 0;
  private memberLight?: { x: number; y: number; radius: number; intensity: number };
  private redEdge?: Phaser.GameObjects.Image;
  /** 讲台上的剪刀（拿走后消失） */
  private scissorsImg?: Phaser.GameObjects.GameObject;

  constructor() {
    super(actKey(4));
  }

  private t(key: string): string[] {
    return this.text(`act04.${key}`);
  }

  create(): void {
    super.create();
    Object.assign(this, { hasScissors: false, ropeCut: false, memberSeen: false, lingerMs: 0, chase: 'none', swarm: [], elapsed: 0, nearAcc: 0, examDoorX: null, gateProg: new Map() });
    this.descending = undefined;
    this.descentTween = undefined;
    this.cuts = [];
    this.trash = undefined;
    this.ropeLine = undefined;
    this.scissorsImg = undefined;
    // 追逐中被抓之后重来：直接回到三楼走廊（剪刀、剪绳都算已经做过）
    if (this.registry.get('retryFrom') === 'chase2') {
      this.registry.set('retryFrom', null);
      this.registry.set('fromRope', false);
      this.hasScissors = true;
      this.ropeCut = true;
      this.memberSeen = true;
      this.loadRoom('corridor3_long', '1');
      this.cameras.main.fadeIn(600, 0, 0, 0);
      void this.corridorEnter();
      return;
    }
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
      this.addRoomSorted(drawMemberScene(this, GameState.cycleDef.scenes.floor3, p.x, p.y + 14));
      // 讲台上放着一把剪刀
      if (!this.hasScissors) {
        const l = this.objectCenter('L');
        // 放在讲台台面的右上角，比讲台亮，刀刃上有一道反光，远处也看得见
        const img = fitImage(this, tex('obj', 'scissors'), { x: l.x + 4, y: l.y - 62, w: 40, h: 30 });
        this.scissorsImg = img ?? this.add.rectangle(l.x + 22, l.y - 44, 20, 7, 0xd8d8e0);
        const si = this.scissorsImg as Phaser.GameObjects.Image;
        si.setDepth(104);
        si.preFX?.addGlow(0xfff0c8, 3, 0, false, 0.1, 8);
        this.tweens.add({ targets: si, alpha: { from: 1, to: 0.65 }, duration: 600, yoyo: true, repeat: -1 });
      }
    }
  }

  private async intro(): Promise<void> {
    await this.cutscene(async () => {
      await this.wait(500);
      // 从四楼荡下来：在三楼的画面里说
      if (this.registry.get('fromRope')) {
        this.registry.set('fromRope', false);
        this.cameras.main.shake(300, 0.008);
        Audio.play('fall_crash', { volume: 0.5 });
        await this.say(this.text('act03.climb_ok'));
      }
      await this.say(this.t('enter'));
      // 看到成员场景，站着不动
      this.facing = 'right';
      this.syncPlayer();
      const id = GameState.cycleDef.scenes.floor3;
      // 绳子吱呀一声，视线被引过去：镜头转向她，她身上亮起一道侧光
      Audio.play('rope_creak', { volume: 0.7 });
      const mp = this.memberPos();
      this.memberLight = { x: mp.x - 10, y: mp.y - 40, radius: TILE * 2.2, intensity: 0.85 };
      this.extraLights.push(this.memberLight);
      const cam = this.cameras.main;
      const home = { x: cam.midPoint.x, y: cam.midPoint.y };
      const following = !!(cam as unknown as { _follow: unknown })._follow;
      cam.stopFollow();
      cam.pan(mp.x, mp.y - 40, 900, 'Sine.easeInOut');
      await this.wait(1000);
      // 有绘名的 CG 时由 CG 来演（台词 act04.member 登记了 CG），不再叠只有鞋的那张小图
      const close = hasMemberOverlay(this, id) && !this.textures.exists(tex('cg', 'cg_act04_ena')) ? showMemberOverlay(this, id) : null;
      await this.wait(2200);
      await this.say(this.t('member'));
      await close?.();
      // 回到原来的镜头位置
      cam.pan(home.x, home.y, 600, 'Sine.easeInOut');
      await this.wait(650);
      if (following) cam.startFollow(this.player, true, 0.12, 0.12);
      // 侧光减弱，但一直留着一点：她一直在那里
      if (this.memberLight) this.memberLight.intensity = 0.45;
      // 楼上传来嘶吼，窗外的绳子绷紧，怪物正在往下爬
      this.cameras.main.shake(400, 0.006);
      Audio.play('roar', { volume: 0.7, rate: 0.85 });
      this.startDescent();
      await this.say(this.t('roar'));
    });
    this.setHint('L');
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

  protected keyTargets(): string[] {
    if (this.room.id === 'classroom3') {
      if (this.ropeCut) return [];
      if (!this.descending) return [];
      return this.hasScissors ? ['W'] : ['L'];
    }
    if (this.room.id === 'corridor3_long' && this.chase === 'none') return ['B'];
    return [];
  }

  protected verbFor(ch: string, tile: { x: number; y: number }): string {
    const id = this.room.objects[ch]?.id;
    if (id === 'lectern' && !this.hasScissors) return '拿剪刀';
    if (id === 'window' && this.hasScissors && !this.ropeCut) return '剪断绳子';
    if (id === 'member_scene') return '看着她';
    if (id === 'burst_door' && this.chase === 'none') return '查看那扇门';
    return super.verbFor(ch, tile);
  }

  protected heldItems(): string[] {
    return this.hasScissors && !this.ropeCut ? ['剪刀'] : [];
  }

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
          void this.takeScissors();
          return;
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
      case 'burst_door':
        if (this.room.id === 'corridor3_long' && this.chase === 'none') void this.chaseIntro();
        return;
    }
  }

  /** 拿到剪刀：窗外的怪物又往下爬了一截，提示去剪绳子 */
  private async takeScissors(): Promise<void> {
    await this.cutscene(async () => {
      this.scissorsImg?.destroy();
      this.scissorsImg = undefined;
      await this.say(this.t('lectern_scissors'));
      this.cameras.main.shake(300, 0.008);
      Audio.play('roar', { volume: 0.6, rate: 0.9 });
      if (this.descending) {
        this.descentTween?.stop();
        const w = this.objectCenter('W');
        await this.tween({ targets: this.descending, y: w.y - 24, duration: 900, ease: 'Sine.easeIn' });
      }
      await this.say(this.t('scissors_taken'));
    });
    this.setHint('W');
  }

  // 改由 keyTargets 的发光来提示
  private setHint(ch: string | null): void {
    void ch;
  }


  protected objective(): string | null {
    if (this.room.id === 'classroom3') {
      if (!this.descending && !this.ropeCut) return null;
      if (!this.hasScissors) return '找能剪断绳子的东西（讲台上）';
      if (!this.ropeCut) return '去左边的窗户，剪断绳子';
      return '离开教室（下方的门）';
    }
    if (this.room.id === 'corridor3_long') {
      if (this.chase === 'none') return '看看对面那扇在响的门';
      if (this.chase === 'running') return this.examDoorX !== null ? '跑进前面出现的那扇门！' : '往右跑！别被追上';
    }
    return null;
  }

  private async cutRope(): Promise<void> {
    await this.cutscene(async () => {
      await this.say(this.t('cut'));
      this.ropeCut = true;
      this.tweens.killTweensOf(this.descending!);
      // 镜头可能放大了：按当前视野的下沿算，而不是屏幕高度
      const viewBottom = this.cameras.main.worldView.bottom;
      const fallY = viewBottom + 80;
      this.ropeLine?.destroy();
      Audio.play('scissors');
      this.canvasBleeds();
      await this.tween({ targets: this.descending, y: fallY, duration: 700, ease: 'Cubic.easeIn' });
      const ai = GameState.cycleDef.monsterA.ai;
      const x = this.descending!.x;
      Audio.play(ai === 'statue' ? 'plaster_break' : ai === 'piano' ? 'piano_crash' : 'fall_crash');
      if (ai === 'statue') this.chunks(x, viewBottom - 20, 0xd8d4cc); // 碎成石膏块，再化成灰
      if (ai === 'piano') this.cameras.main.flash(120, 90, 90, 90); // 琴弦乱响一声
      this.cameras.main.shake(ai === 'piano' ? 380 : 200, ai === 'piano' ? 0.012 : 0.006);
      this.time.delayedCall(ai === 'statue' ? 500 : 0, () => ashBurst(this, x, viewBottom - 20));
      this.descending?.destroy();
      await this.wait(800);
      await this.say(this.t('fall'));
      await this.say(this.t('after_cut'));
    });
    this.setHint(null);
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
      this.extraLights = []; // 教室里的侧光不要带到走廊
      this.loadRoom('corridor3_long', '1');
      void this.corridorEnter();
      return true;
    }
    if (this.room.id === 'corridor3_long') {
      this.bounceBack(); // 回不去了
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ 停留扣除 / 追逐

  protected isChasing(): boolean {
    return this.chase === 'running' || this.chase === 'intro';
  }

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

  /** 进走廊：对面的门在响，等真冬去查看那扇门，怪物群才涌出来 */
  private async corridorEnter(): Promise<void> {
    await this.cutscene(async () => {
      this.facing = 'down';
      this.syncPlayer();
      await this.wait(400);
      Audio.play('door_bang', { volume: 0.6 });
      await this.say(this.t('corridor_bang'));
    });
    this.setHint('B');
  }

  private async chaseIntro(): Promise<void> {
    this.chase = 'intro';
    this.setHint(null);
    this.ensureRedEdge();
    await this.cutscene(async () => {
      this.facing = 'down';
      this.syncPlayer();
      await this.say(this.t('door_check'));
      // 门开了一条缝，缝里露出一张笑脸（有图才演）
      const faceKey = tex('obj', 'burst_door_face');
      if (this.textures.exists(faceKey)) {
        const d0 = this.objectCenter('B');
        const face = this.add.image(d0.x, d0.y + TILE / 2, faceKey).setOrigin(0.5, 1).setDisplaySize(TILE * 1.5, TILE * 2.4).setDepth(104).setAlpha(0);
        await this.tween({ targets: face, alpha: 1, duration: 500 });
        Audio.play('sting', { volume: 0.5 });
        await this.wait(1100);
        face.destroy();
      }
      for (let i = 0; i < 3; i++) {
        this.cameras.main.shake(160, 0.008);
        Audio.play('door_bang', { rate: 1 + i * 0.05 });
        await this.wait(380 - i * 80);
      }
      // 门被撞开
      const d = this.objectCenter('B');
      this.add.rectangle(d.x, d.y, 76, 34, 0x000000).setDepth(5);
      this.cameras.main.flash(120, 50, 0, 0);
      Audio.play('door_burst');
      this.spawnSwarm(d.x, d.y - 30);
      await this.wait(350);
      const name = GameState.cycleDef.monsterB.name;
      await this.say(this.t('burst').map((l) => l.replace('{monster}', name)));
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
        // 有图就用图：小学 / 初中 / 现在 / 医生，身高逐个递增（第五个再从小学开始）
        const ART = [
          { file: 'mafuyus_child', h: 50 },
          { file: 'mafuyus_middle', h: 58 },
          { file: 'mafuyus_high', h: 66 },
          { file: 'mafuyus_doctor', h: 74 },
        ];
        const art = ART[i % ART.length];
        const img = poseImage(this, tex('mon', art.file), art.h);
        if (img) {
          obj = this.add.container(0, 0, [img.setTint(0xc8c8c8)]);
        } else {
          obj = makeFigure(this, 0, 0, variants[i % variants.length]);
          obj.add(this.add.arc(0, -32, 5, 20, 160, false, 0, 0).setStrokeStyle(1.5, 0x111111));
        }
      } else {
        obj = makeMonsterById(this, 0, 0, def.id, color, i === 0 ? def.name : '', 0.85);
      }
      // 有碰撞盒：沿墙滑动，配合绕行点绕过障碍（L2）
      // 生成在门口往上的位置，卡进墙里的话再往上挪
      let sy = y - (i % 3) * 10;
      while (this.blockedBox(x - i * 18, sy, 18, 12) && sy > y - TILE * 3) sy -= 6;
      const a = this.addActor(obj, x - i * 18, sy, CHASE.chase2Speed * Phaser.Math.FloatBetween(0.94, 1.04), 18, 12);
      this.swarm.push({ a, dy: ((i % 3) - 1) * 26 });
    }
  }

  private updateChase(delta: number): void {
    const dt = delta / 1000;
    this.elapsed += delta;
    let nearest = Infinity;
    const scores = GameState.cycleDef.monsterB.id === 'flying_scores';
    for (const { a, dy } of this.swarm) {
      const wp = this.gateWaypoint(a);
      if (wp) this.moveActor(a, wp.x, wp.y, dt);
      else {
        // 乐谱在空中翻飞：上下飘
        const wobble = scores ? Math.sin((this.elapsed + a.speed * 40) / 260) * 30 : 0;
        this.moveActor(a, this.pos.x, this.pos.y + dy + wobble, dt);
      }
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
      // 前方 7 格以后第一面能放门的后墙（不落在绕行教室、门洞和障碍上）
      const back = new Set(this.backWallCells(this.room).map((b) => `${b.x},${b.y}`));
      const W = this.room.map[0].length;
      let tx = Math.min(this.playerTile().x + 7, W - 3);
      let ty = -1;
      for (; tx < W - 2; tx++) {
        const row = this.room.map.findIndex((r, y) => back.has(`${tx},${y}`) && r[tx] === '#' && back.has(`${tx - 1},${y}`) && back.has(`${tx + 1},${y}`));
        if (row >= 0) {
          ty = row;
          break;
        }
      }
      if (ty < 0) ty = 0;
      const c = this.tileCenter(tx, ty);
      this.examDoorX = c.x;
      this.examDoorY = c.y;
      this.drawDoor({ id: 'class_door', color: 0, tex: 'class_door' }, c.x, c.y + TILE / 2, undefined, 0, true);
      this.extraLights.push({ x: c.x, y: c.y + TILE, radius: TILE * 2.2, intensity: 0.9, squash: 0.7 });
      this.clearSwarm();
      this.placeTrash(tx - 2, ty + 3);
    }
    // 要真的走到门前（门口一格以内）才进去，不是横着越过那条线就算
    if (this.examDoorX !== null && Math.abs(this.pos.x - this.examDoorX) < TILE * 0.9 && this.pos.y - this.examDoorY < TILE * 1.6) {
      this.chase = 'done';
      this.redEdge?.setAlpha(0);
      this.player.setVisible(false);
      startAct(this, 5);
    }
  }

  /** 每个怪物走到第几个障碍的第几个绕行点 */
  private gateProg = new Map<Actor, { gate: number; wp: number }>();

  /**
   * 追逐走廊的绕行（L2）：怪物还没过某个障碍、而玩家已经到了障碍那边时，
   * 先依次走这个障碍的绕行点（缺口、教室的门洞），走完再直接追人。没有要绕的就返回 null。
   */
  private gateWaypoint(a: Actor): { x: number; y: number } | null {
    const gates = this.room.chaseGates;
    if (!gates?.length) return null;
    const toWorld = (p: { x: number; y: number }) => ({ x: this.originX + (p.x + 0.5) * TILE, y: this.originY + (p.y + 0.5) * TILE + 8 });
    let prog = this.gateProg.get(a);
    const gi = gates.findIndex((g) => a.x < this.originX + (g.endX + 0.5) * TILE);
    if (gi < 0) return null;
    const g = gates[gi];
    if (this.pos.x < this.originX + g.startX * TILE) return null; // 玩家还在障碍这一边：直接追
    if (!prog || prog.gate !== gi) {
      prog = { gate: gi, wp: 0 };
      this.gateProg.set(a, prog);
    }
    while (prog.wp < g.wps.length) {
      const w = toWorld(g.wps[prog.wp]);
      if (Phaser.Math.Distance.Between(a.x, a.y, w.x, w.y) > 14) return w;
      prog.wp++;
    }
    // 绕行点走完了：把它推过障碍的终点，接着追人
    return null;
  }

  /** 四周目：被飞散的乐谱割伤 -5，乐谱被弹开。4 秒内被割 3 次 → 被追上 */
  private scoreCut(a: Actor): void {
    GameState.deductSanity(SANITY_COST.scoreCut, 'score-cut');
    this.cameras.main.flash(90, 120, 0, 0);
    Audio.play('paper', { rate: 1.6 });
    // 往后弹开；弹进墙或障碍里就少弹一点
    const from = a.x;
    a.x -= 170;
    for (let back = 170; back > 0 && this.blockedBox(a.x, a.y, a.w, a.h); back -= 20) a.x = from - back + 20;
    if (this.blockedBox(a.x, a.y, a.w, a.h)) a.x = from;
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
  private placeTrash(tx: number, ty = 3): void {
    // 找一块空地（不放在障碍上）
    for (let dx = 0; dx < 6 && this.charAt(tx, ty) !== '.'; dx++) tx--;
    const c = this.tileCenter(tx, ty);
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
    if (godMode()) return; // 开发者模式：无敌
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
    this.registry.set('retryFrom', 'chase2');
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
