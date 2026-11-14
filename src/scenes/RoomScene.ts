import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MOVE, SANITY_COST, TILE } from '../core/constants';
import { GameState } from '../core/GameState';
import { hintLevel, hintRooms, MATERIALS, sanityTier } from '../core/progress';
import { tHas, tLines, tStory, tUi } from '../core/text';
import type { MaterialDef } from '../core/types';
import { makeFigure, PALETTE } from '../systems/figures';
import { MafuyuSprite, PLAYER_HEIGHT } from '../systems/playerSprite';
import { cropImage, fitImage, MAFUYU_STAND_REF, PORTRAIT_CROP, poseImage, tex } from '../systems/sprites';
import { textStyle } from '../systems/style';
import { createCameraFx } from '../systems/VisualFilter';
import { SCENE } from './flow';
import { ROOMS, type RoomDef, type RoomObject } from './rooms';
import type { PlayTarget, UIScene } from './UIScene';

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** 玩家的碰撞盒（脚下一块），比格子小一点，方便过门 */
const BODY_W = 24;
const BODY_H = 20;

/** 会移动的东西（怪物、群体中的个体）。坐标是脚下中心 */
export interface Actor {
  obj: Phaser.GameObjects.Container;
  x: number;
  y: number;
  speed: number;
  /** 碰撞盒大小；穿墙的怪物设为 0 */
  w: number;
  h: number;
}

/**
 * 俯视角房间场景的基类：画格子、移动与碰撞、调查、出口切换、镜头、精神值滤镜。
 * 每一幕继承它，只写剧情相关的部分。
 */
export abstract class RoomScene extends Phaser.Scene implements PlayTarget {
  protected ui!: UIScene;
  protected room!: RoomDef;
  protected roomLayer!: Phaser.GameObjects.Container;
  protected player!: Phaser.GameObjects.Container;
  protected facing: Dir = 'down';
  /** 玩家脚下中心点（世界坐标） */
  protected pos = new Phaser.Math.Vector2();
  protected originX = 0;
  protected originY = 0;
  /** 演出中锁住移动 */
  protected locked = false;
  /** 真冬的行走图（素材齐全时）。演出中换成其他姿势时设为 undefined */
  protected mafuyu?: MafuyuSprite;
  /** 这一帧玩家是否在移动 */
  protected moving = false;
  protected allowRun = true;
  /** 演出中被脚本带着走（播放走路动画） */
  private autoWalking = false;
  protected stamina: number = MOVE.staminaMax;
  /** 是否允许打开手机 / 背包（QTE 等时候关掉） */
  protected menusOpen = true;
  private staminaBar!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cameraFx!: (time: number) => void;
  private ghostTimer = 0;
  private transitioning = false;
  private visited = new Set<string>();
  private lightTimers: Phaser.Time.TimerEvent[] = [];
  /** 不在 roomLayer 里、换房间时要销毁的东西（贴图和遮罩） */
  private roomExtras: Phaser.GameObjects.GameObject[] = [];
  /** 物件字母 → 画出来的图（演出里可以换图、隐藏） */
  protected objectImages = new Map<string, Phaser.GameObjects.Image[]>();
  /** 补充周目第 3 次提示：已经「看过一眼」的楼层 */
  private lookedFloors = new Set<number>();
  /** 停下来看的剩余时间（毫秒），期间不能移动 */
  private lookMs = 0;
  /** 各周目一次性扣除的记录（人像、粉色门……），一幕内有效 */
  private cycleTouched = new Set<string>();
  private voiceTimer = 0;
  private beatAcc = 0;
  private beatShade?: Phaser.GameObjects.Rectangle;
  private lingerFloor1 = 0;

  protected abstract onObject(obj: RoomObject, tile: { x: number; y: number }): void;
  protected onEnterRoom(_roomId: string, _firstTime: boolean): void {}
  protected onUpdate(_time: number, _dt: number): void {}
  /** 踩到出口时调用。返回 true 表示由子类处理（锁着、进入下一幕……），基类不再切换房间 */
  protected onExit(_ch: string): boolean {
    return false;
  }

  create(): void {
    this.ui = this.scene.get(SCENE.ui) as UIScene;
    this.ui.setTarget(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.ui?.scene.isActive()) this.ui.setTarget(null);
    });
    this.locked = false;
    this.transitioning = false;
    this.visited = new Set();
    this.lookedFloors = new Set();
    this.lookMs = 0;
    this.cycleTouched = new Set();
    this.voiceTimer = 0;
    this.beatAcc = 0;
    this.lingerFloor1 = 0;
    this.lightTimers = [];
    this.roomExtras = [];
    this.stamina = MOVE.staminaMax;
    this.facing = 'down';

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameraFx = createCameraFx(this.cameras.main);
    this.roomLayer = this.add.container(0, 0);
    // 有素材就用真冬的行走图，没有就用色块 + 朝向小三角
    if (MafuyuSprite.available(this)) {
      this.mafuyu = new MafuyuSprite(this);
      this.player = this.add.container(0, 0, [this.mafuyu.image]).setDepth(100);
    } else {
      this.mafuyu = undefined;
      this.player = makeFigure(this, 0, 0, { ...PALETTE.mafuyu }).setDepth(100);
      const eye = this.add.triangle(0, 0, 0, 0, 8, 0, 4, 6, 0xffffff).setName('facing');
      this.player.add(eye);
    }
    this.staminaBar = this.add.graphics().setDepth(500).setScrollFactor(0);
    // 四周目节拍器：随节拍整体压暗一下
    this.beatShade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(450).setAlpha(0);
    this.cameras.main.setBackgroundColor('#000000');
  }

  onInteract(): void {
    if (this.locked || this.transitioning) return;
    const v = DIR_VEC[this.facing];
    const probe = { x: this.pos.x + v.x * (TILE * 0.75), y: this.pos.y - 8 + v.y * (TILE * 0.75) };
    const tile = this.worldToTile(probe.x, probe.y);
    const ch = this.charAt(tile.x, tile.y);
    const obj = this.room.objects[ch];
    if (!obj) return;
    if (this.onCycleObject(obj, tile)) return;
    this.onObject(obj, tile);
  }

  // ------------------------------------------------------------ 各周目的环境（交接文档 4.1 / 2.1.1）

  /** 物件在当前周目的样子：素材名、'portrait'（二周目的人像），或 null（画色块） */
  private cycleLook(obj: RoomObject): string | 'portrait' | null {
    const c = GameState.save.cycle;
    if (c === 2 && obj.id === 'corridor_window') return 'portrait'; // 墙上挂满没画完的人像
    if (c === 3 && (obj.id === 'class_door' || obj.id === 'burst_door')) return 'pink_door'; // 所有教室门变成粉色
    return obj.tex ?? null;
  }

  /** 各周目通用的调查。返回 true 表示已处理 */
  private onCycleObject(obj: RoomObject, tile: { x: number; y: number }): boolean {
    const c = GameState.save.cycle;
    const key = `${this.room.id}:${tile.x}:${tile.y}`;
    if (c === 2 && obj.id === 'corridor_window') {
      // 调查墙上被涂掉脸的人像：每幅 -2
      if (!this.cycleTouched.has(key)) {
        this.cycleTouched.add(key);
        GameState.deductSanity(SANITY_COST.facelessPortrait, 'portrait');
      }
      this.ui.say(this.text('cycle.portrait'));
      return true;
    }
    if (c === 3 && obj.id === 'class_door') {
      // 尝试打开锁着的粉色门：-2
      GameState.deductSanity(SANITY_COST.pinkDoorTry, 'pink-door');
      this.ui.say(this.text('cycle.pink_door_locked'));
      return true;
    }
    return false;
  }

  /** 每帧：三周目门后的说话声、四周目的节拍器 */
  private updateCycleAmbience(time: number, delta: number): void {
    const c = GameState.save.cycle;
    if (c === 3) this.updatePinkDoorVoices(delta);
    if (c === 4) this.updateMetronome(time, delta);
  }

  /** 三周目：门后有听不清的说话声，靠近就停。贴近时说话声停下的瞬间 -3（每扇门一次） */
  private updatePinkDoorVoices(delta: number): void {
    this.voiceTimer -= delta;
    for (const [ch, imgs] of this.objectImages) {
      if (this.room.objects[ch]?.id !== 'class_door') continue;
      for (const img of imgs) {
        const key = `${this.room.id}:${Math.round(img.x)}`;
        const d = Phaser.Math.Distance.Between(img.x, img.y, this.pos.x, this.pos.y);
        if (d < 70) {
          if (!this.cycleTouched.has(key)) {
            this.cycleTouched.add(key);
            this.cameras.main.shake(80, 0.002);
            GameState.deductSanity(SANITY_COST.pinkDoorVoice, 'pink-door-voice');
          }
        } else if (d < 260 && this.voiceTimer <= 0 && !this.cycleTouched.has(key)) {
          const t = this.add
            .text(img.x + Phaser.Math.Between(-14, 14), img.y - 46, Phaser.Utils.Array.GetRandom(['……', '…………', '（……）']), textStyle(12, '#8a7a80'))
            .setOrigin(0.5)
            .setDepth(130)
            .setAlpha(0);
          this.tweens.chain({ targets: t, tweens: [{ alpha: 0.8, duration: 500 }, { alpha: 0, duration: 900, delay: 500 }], onComplete: () => t.destroy() });
        }
      }
    }
    if (this.voiceTimer <= 0) this.voiceTimer = Phaser.Math.Between(900, 1700);
  }

  /** 四周目：全程节拍器，越往下层越快；走廊灯随节拍明灭。在一楼停留每 5 秒 -2 */
  private updateMetronome(_time: number, delta: number): void {
    const bpm = { 4: 60, 3: 80, 2: 104, 1: 136 }[this.room.floor ?? 0] ?? 90;
    this.beatAcc += delta;
    const beatMs = 60000 / bpm;
    if (this.beatAcc >= beatMs) {
      this.beatAcc -= beatMs;
      this.beatShade?.setAlpha(0.22);
      this.tweens.add({ targets: this.beatShade, alpha: 0, duration: beatMs * 0.6 });
      const tick = this.add.text(GAME_WIDTH - 40, 60, '◆', textStyle(12, '#4a4a52')).setScrollFactor(0).setDepth(460);
      this.tweens.add({ targets: tick, alpha: 0, duration: beatMs * 0.8, onComplete: () => tick.destroy() });
    }
    if (this.room.floor === 1 && !this.locked) {
      this.lingerFloor1 += delta;
      if (this.lingerFloor1 >= 5000) {
        this.lingerFloor1 -= 5000;
        GameState.deductSanity(SANITY_COST.metronomeLinger, 'metronome');
      }
    }
  }

  allowMenus(): boolean {
    return !this.transitioning && this.menusOpen;
  }

  // ------------------------------------------------------------ 演出工具

  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  protected say(lines: string | string[]): Promise<void> {
    return this.ui.sayAsync(lines);
  }

  /** 当前周目的剧情文本 */
  protected text(key: string): string[] {
    return tLines(key, GameState.save.cycle);
  }

  protected textOne(key: string): string {
    const v = tStory(key, GameState.save.cycle);
    return Array.isArray(v) ? v.join('') : v;
  }

  /** 锁住玩家执行一段演出 */
  protected async cutscene(run: () => Promise<void>): Promise<void> {
    this.locked = true;
    try {
      await run();
    } finally {
      if (this.sys.isActive() || this.sys.isPaused()) this.locked = false;
    }
  }

  protected tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  /** 让玩家自己走到某点（演出用） */
  protected async walkPlayerTo(x: number, y: number, speed = 90): Promise<void> {
    const dist = Phaser.Math.Distance.Between(this.pos.x, this.pos.y, x, y);
    if (Math.abs(x - this.pos.x) >= Math.abs(y - this.pos.y)) this.facing = x < this.pos.x ? 'left' : 'right';
    else this.facing = y < this.pos.y ? 'up' : 'down';
    const target = { x: this.pos.x, y: this.pos.y };
    this.autoWalking = true;
    await this.tween({
      targets: target,
      x,
      y,
      duration: (dist / speed) * 1000,
      onUpdate: () => {
        this.pos.set(target.x, target.y);
        this.syncPlayer();
      },
    });
    this.autoWalking = false;
  }

  /**
   * 把玩家换成某个姿势的图（爬行、坐下……）。素材缺失时用 fallback 画的色块。
   * 换了之后不再播放行走动画。
   */
  protected setPlayerPose(key: string, fallback: () => Phaser.GameObjects.GameObject): void {
    this.player.removeAll(true);
    this.mafuyu = undefined;
    this.player.add(poseImage(this, key, PLAYER_HEIGHT, MAFUYU_STAND_REF) ?? fallback());
  }

  /** 调查后拿到材料的通用文字 */
  protected async pickup(m: MaterialDef, intro?: string | string[]): Promise<void> {
    GameState.addMaterial(m.id);
    const lines = intro ? (Array.isArray(intro) ? [...intro] : [intro]) : [];
    lines.push(tUi('obtained').replace('{name}', m.name));
    lines.push(...this.materialComment(m.id));
    this.refreshHints();
    await this.say(lines);
  }

  /** 拿到材料时真冬的一句话（text: materials.<id>），没有就不说 */
  protected materialComment(id: string): string[] {
    const key = `materials.${id}`;
    return tHas(key, GameState.save.cycle) ? this.text(key) : [];
  }

  // ------------------------------------------------------------ 房间

  protected loadRoom(roomOrId: string | RoomDef, arriveAt?: string, at?: { x: number; y: number }): void {
    const def = typeof roomOrId === 'string' ? ROOMS[roomOrId] : roomOrId;
    if (!def) throw new Error(`没有这个房间：${String(roomOrId)}`);
    this.room = def;
    this.roomLayer.removeAll(true);

    const w = Math.max(...def.map.map((r) => r.length));
    const h = def.map.length;
    const worldW = w * TILE;
    const worldH = h * TILE;
    this.originX = worldW > GAME_WIDTH ? 0 : Math.floor((GAME_WIDTH - worldW) / 2);
    this.originY = worldH > GAME_HEIGHT ? 0 : Math.floor((GAME_HEIGHT - worldH) / 2);

    const env = GameState.cycleDef.environment;
    const floor = Phaser.Display.Color.HexStringToColor(def.floorColor ?? env.floorColor).color;
    const wall = Phaser.Display.Color.HexStringToColor(def.wallColor ?? env.wallColor).color;
    this.roomExtras.forEach((o) => o.destroy());
    this.roomExtras = [];
    this.objectImages = new Map();
    const floorKey = tex('tile', def.floorTex ?? this.cycleFloorTex());
    const wallKey = tex('tile', def.wallTex ?? this.cycleWallTex());
    const texturedFloor = this.textures.exists(floorKey);
    const texturedWall = this.textures.exists(wallKey);
    const floorMask = this.make.graphics({}, false);
    const wallMask = this.make.graphics({}, false);
    const g = this.add.graphics();
    this.roomLayer.add(g);

    const letters = new Set<string>();
    def.map.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === ' ') return;
        const px = this.originX + x * TILE;
        const py = this.originY + y * TILE;
        if (ch === '#') {
          if (texturedWall) wallMask.fillRect(px, py, TILE, TILE);
          else g.fillStyle(wall, 1).fillRect(px, py, TILE, TILE);
          g.fillStyle(0x000000, 0.35).fillRect(px, py + TILE - 5, TILE, 5); // 墙根的阴影
          return;
        }
        if (texturedFloor) floorMask.fillRect(px, py, TILE, TILE);
        else {
          g.fillStyle(floor, 1).fillRect(px, py, TILE, TILE);
          g.lineStyle(1, 0x000000, 0.18).strokeRect(px, py, TILE, TILE);
        }
        if (/[0-9]/.test(ch)) {
          g.fillStyle(0x000000, 0.55).fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
          return;
        }
        if (def.objects[ch]) letters.add(ch);
      });
    });

    // 地板 / 墙面贴图：整片平铺，再用遮罩只露出对应的格子
    const tiled = (key: string, mask: Phaser.GameObjects.Graphics, scale: number, tint: number, depth: number) => {
      const ts = this.add.tileSprite(this.originX, this.originY, worldW, worldH, key).setOrigin(0).setDepth(depth);
      ts.setTileScale(scale).setTint(tint).setMask(mask.createGeometryMask());
      this.roomExtras.push(ts, mask);
    };
    if (texturedFloor) tiled(floorKey, floorMask, (TILE * 4) / 512, 0xb0b0b0, -20);
    else floorMask.destroy();
    if (texturedWall) tiled(wallKey, wallMask, (TILE * 2) / 512, 0x707070, -19);
    else wallMask.destroy();

    // 物件：有图用图，没图画色块。同一字母可能分散在多处（例如走廊的几扇窗），按连通区域分别画
    for (const comp of this.components(def, [...letters])) {
      const obj = def.objects[comp.ch];
      if (obj.hidden) continue;
      const x = this.originX + comp.x0 * TILE;
      const y = this.originY + comp.y0 * TILE;
      const cw = (comp.x1 - comp.x0 + 1) * TILE;
      const chh = (comp.y1 - comp.y0 + 1) * TILE;
      const look = this.cycleLook(obj);
      const img = look === 'portrait'
        ? cropImage(this, tex('tile', 'wall_school_ena'), PORTRAIT_CROP, { x: x + 4, y: y - TILE * 0.9, w: cw - 8, h: chh + TILE * 0.9 })
        : look
        ? fitImage(
            this,
            tex('obj', look),
            obj.wall
              ? this.isSolid(this.charAt(comp.x0, comp.y0 - 1)) || comp.y0 === 0
                ? { x, y: y - TILE * 1.2, w: cw, h: chh + TILE * 1.2 } // 上墙 / 侧墙：向上多占一点
                : { x, y, w: cw, h: chh } // 下墙：上方是地板，不往上画
              : { x: x - cw * 0.08, y: y - chh * 0.35, w: cw * 1.16, h: chh * 1.35 + 4 },
          )
        : null;
      if (img) {
        img.setTint(0xc8c8c8);
        this.roomLayer.add(img);
        const list = this.objectImages.get(comp.ch) ?? [];
        list.push(img);
        this.objectImages.set(comp.ch, list);
        continue;
      }
      g.fillStyle(obj.color, 1).fillRect(x + 3, y + 3, cw - 6, chh - 6);
      g.lineStyle(1, 0x000000, 0.4).strokeRect(x + 3, y + 3, cw - 6, chh - 6);
      if (obj.label && cw >= TILE * 2) {
        this.roomLayer.add(this.add.text(x + cw / 2, y + chh / 2, obj.label, textStyle(13, '#00000099')).setOrigin(0.5));
      }
    }

    this.addMaterialHints();
    this.addDoorLights();

    // 镜头：房间比屏幕大时跟随玩家
    const cam = this.cameras.main;
    if (worldW > GAME_WIDTH || worldH > GAME_HEIGHT) {
      cam.setBounds(0, 0, Math.max(worldW, GAME_WIDTH), Math.max(worldH, GAME_HEIGHT));
      cam.startFollow(this.player, true, 0.12, 0.12);
    } else {
      cam.stopFollow();
      cam.removeBounds();
      cam.setScroll(0, 0);
    }

    // 放置玩家
    const spawn = at ?? (arriveAt ? this.arrivalTile(arriveAt) : (def.spawn ?? { x: 1, y: 1 }));
    this.placePlayer(spawn.x, spawn.y);
    this.children.bringToTop(this.player);

    const first = !this.visited.has(def.id);
    this.visited.add(def.id);
    this.onEnterRoom(def.id, first);
    this.maybeLookToward();
  }

  // ------------------------------------------------------------ 补充周目的环境提示

  /**
   * 门口的灯。平时偶尔闪一下；补充周目里，没拿到的材料所在房间的门口闪得更频繁。
   */
  private addDoorLights(): void {
    this.lightTimers.forEach((t) => t.remove());
    this.lightTimers = [];
    const doors = this.room.doors ?? {};
    const hinted = hintRooms(GameState.save);
    const flick = (light: Phaser.GameObjects.Rectangle) => {
      light.setAlpha(0.15);
      this.time.delayedCall(Phaser.Math.Between(40, 110), () => light.active && light.setAlpha(0.7));
    };
    for (const [ch, dest] of Object.entries(doors)) {
      const t = this.findTile(ch);
      if (!t) continue;
      const c = this.tileCenter(t.x, t.y);
      // 门在上墙时灯画在门上方，其余画在门旁边
      const light = this.add.rectangle(c.x, c.y - TILE / 2 + 3, 18, 4, 0xe8e0c0, 0.7).setDepth(4);
      this.roomLayer.add(light);
      const fast = hinted.has(dest);
      const schedule = () => {
        const ev = this.time.delayedCall(fast ? Phaser.Math.Between(250, 1100) : Phaser.Math.Between(5000, 12000), () => {
          if (!light.active) return;
          flick(light);
          if (fast && Math.random() < 0.5) this.time.delayedCall(160, () => light.active && flick(light));
          schedule();
        });
        this.lightTimers.push(ev);
      };
      schedule();
    }
  }

  /**
   * 补充周目第 3 次起：第一次走到材料所在楼层时，停下来看向材料的方向一秒。
   * 材料在这个房间里就看材料，否则看通往材料房间的门。
   */
  private maybeLookToward(): void {
    const floor = this.room.floor;
    if (floor === undefined || hintLevel(GameState.save) < 3 || this.lookedFloors.has(floor)) return;
    let target: { x: number; y: number } | undefined;
    const here = this.materialsHere()[0];
    if (here) {
      const entry = Object.entries(this.room.objects).find(([, o]) => o.spot === here.spot);
      if (entry) target = this.objectCenter(entry[0]);
    }
    if (!target) {
      const hinted = hintRooms(GameState.save);
      const door = Object.entries(this.room.doors ?? {}).find(([, dest]) => hinted.has(dest));
      if (door) target = this.objectCenter(door[0]);
    }
    if (!target) return;
    this.lookedFloors.add(floor);
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    this.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    this.syncPlayer();
    this.lookMs = 1000;
  }

  /** 当前周目的地板 / 墙面贴图 */
  private cycleFloorTex(): string {
    const c = GameState.save.cycle;
    return { 1: 'floor_school', 2: 'floor_school_ena', 3: 'floor_school_mizuki', 4: 'floor_school_kanade', final: 'floor_final' }[c];
  }

  private cycleWallTex(): string {
    const c = GameState.save.cycle;
    return c === 2 ? 'wall_school_ena' : c === 3 ? 'wall_school_mizuki' : 'wall_school';
  }

  protected placePlayer(tx: number, ty: number): void {
    const c = this.tileCenter(tx, ty);
    this.pos.set(c.x, c.y + 8);
    this.syncPlayer();
  }

  /** 找出每个物件字母的连通区域（四邻接），返回各自的包围盒 */
  private components(def: RoomDef, letters: string[]) {
    const seen = new Set<string>();
    const out: { ch: string; x0: number; y0: number; x1: number; y1: number }[] = [];
    def.map.forEach((row, sy) =>
      [...row].forEach((ch, sx) => {
        if (!letters.includes(ch) || seen.has(`${sx},${sy}`)) return;
        const c = { ch, x0: sx, y0: sy, x1: sx, y1: sy };
        const stack = [[sx, sy]];
        seen.add(`${sx},${sy}`);
        while (stack.length) {
          const [x, y] = stack.pop()!;
          c.x0 = Math.min(c.x0, x);
          c.y0 = Math.min(c.y0, y);
          c.x1 = Math.max(c.x1, x);
          c.y1 = Math.max(c.y1, y);
          for (const d of Object.values(DIR_VEC)) {
            const nx = x + d.x;
            const ny = y + d.y;
            if (def.map[ny]?.[nx] === ch && !seen.has(`${nx},${ny}`)) {
              seen.add(`${nx},${ny}`);
              stack.push([nx, ny]);
            }
          }
        }
        out.push(c);
      }),
    );
    return out;
  }

  /** 物件字母第一次出现的格子 */
  protected findTile(ch: string): { x: number; y: number } | undefined {
    for (let y = 0; y < this.room.map.length; y++) {
      const x = this.room.map[y].indexOf(ch);
      if (x >= 0) return { x, y };
    }
    return undefined;
  }

  /** 物件字母所占区域的中心（世界坐标） */
  protected objectCenter(ch: string): { x: number; y: number } {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    this.room.map.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c !== ch) return;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }),
    );
    return { x: this.originX + ((x0 + x1 + 1) / 2) * TILE, y: this.originY + ((y0 + y1 + 1) / 2) * TILE };
  }

  /** 从某个出口进入时，出现在出口旁边可走的格子上 */
  private arrivalTile(exitChar: string): { x: number; y: number } {
    const t = this.findTile(exitChar);
    if (t) {
      for (const d of Object.values(DIR_VEC)) {
        if (this.charAt(t.x + d.x, t.y + d.y) === '.') return { x: t.x + d.x, y: t.y + d.y };
      }
    }
    return this.room.spawn ?? { x: 1, y: 1 };
  }

  protected changeRoom(roomId: string, arriveAt?: string): void {
    this.transitioning = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.loadRoom(roomId, arriveAt);
      this.cameras.main.fadeIn(250, 0, 0, 0);
      this.transitioning = false;
    });
  }

  /** 补充周目的提示：没拿到的材料附近有微弱光点 */
  private addMaterialHints(): void {
    if (hintLevel(GameState.save) < 1) return;
    for (const m of this.materialsHere()) {
      const entry = Object.entries(this.room.objects).find(([, o]) => o.spot === m.spot);
      if (!entry) continue;
      const c = this.objectCenter(entry[0]);
      const dot = this.add.circle(c.x, c.y, 3, 0xfff6d0, 0.8);
      dot.setName('hint');
      this.roomLayer.add(dot);
      this.tweens.add({ targets: dot, alpha: 0.1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private refreshHints(): void {
    this.roomLayer.list.filter((o) => o.name === 'hint').forEach((o) => o.destroy());
    this.addMaterialHints();
  }

  // ------------------------------------------------------------ 材料

  /** 当前周目、当前房间里还没拿到的材料 */
  protected materialsHere(): MaterialDef[] {
    const s = GameState.save;
    if (s.cycle === 'final') return [];
    return MATERIALS.filter((m) => m.theme === s.cycle && m.room === this.room.id && !s.materials.includes(m.id));
  }

  protected materialAtSpot(spot: string | undefined): MaterialDef | undefined {
    if (!spot) return undefined;
    return this.materialsHere().find((m) => m.spot === spot);
  }

  // ------------------------------------------------------------ 格子

  protected charAt(x: number, y: number): string {
    return this.room.map[y]?.[x] ?? ' ';
  }

  protected worldToTile(wx: number, wy: number): { x: number; y: number } {
    return { x: Math.floor((wx - this.originX) / TILE), y: Math.floor((wy - this.originY) / TILE) };
  }

  protected tileCenter(tx: number, ty: number): { x: number; y: number } {
    return { x: this.originX + (tx + 0.5) * TILE, y: this.originY + (ty + 0.5) * TILE };
  }

  /** 玩家当前所在格子 */
  protected playerTile(): { x: number; y: number } {
    return this.worldToTile(this.pos.x, this.pos.y - BODY_H / 2);
  }

  protected isSolid(ch: string): boolean {
    if (ch === ' ' || ch === '#') return true;
    if (ch === '.' || /[0-9]/.test(ch)) return false;
    const obj = this.room.objects[ch];
    return obj ? obj.solid !== false : true;
  }

  protected blockedBox(cx: number, cy: number, w: number, h: number): boolean {
    if (w <= 0) return false;
    const x0 = cx - w / 2;
    const x1 = cx + w / 2 - 1;
    const y0 = cy - h;
    const y1 = cy - 1;
    for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const t = this.worldToTile(px, py);
      if (this.isSolid(this.charAt(t.x, t.y))) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ 怪物

  protected addActor(obj: Phaser.GameObjects.Container, x: number, y: number, speed: number, w = 0, h = 0): Actor {
    obj.setPosition(x, y).setDepth(110);
    return { obj, x, y, speed, w, h };
  }

  /** 朝目标点移动，有碰撞盒时沿墙滑动 */
  protected moveActor(a: Actor, tx: number, ty: number, dt: number, speed = a.speed): void {
    const dx = tx - a.x;
    const dy = ty - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const step = Math.min(len, speed * dt);
    const mx = (dx / len) * step;
    const my = (dy / len) * step;
    if (!this.blockedBox(a.x + mx, a.y, a.w, a.h)) a.x += mx;
    if (!this.blockedBox(a.x, a.y + my, a.w, a.h)) a.y += my;
    a.obj.setPosition(Math.round(a.x), Math.round(a.y));
  }

  protected distToPlayer(a: { x: number; y: number }): number {
    return Phaser.Math.Distance.Between(a.x, a.y, this.pos.x, this.pos.y);
  }

  // ------------------------------------------------------------ 玩家

  protected syncPlayer(): void {
    this.player.setPosition(Math.round(this.pos.x), Math.round(this.pos.y));
    const eye = this.player.getByName('facing') as Phaser.GameObjects.Triangle | null;
    if (!eye) return;
    const v = DIR_VEC[this.facing];
    eye
      .setPosition(v.x * 16 - 4, -14 + v.y * 18)
      .setAngle(this.facing === 'up' ? 180 : this.facing === 'left' ? 90 : this.facing === 'right' ? -90 : 0);
  }

  update(time: number, rawDelta: number): void {
    this.cameraFx(time);
    // 帧率很低时截断，玩家和怪物用同一个 delta，保证追逐的相对速度不变
    const delta = Math.min(rawDelta, 50);
    const dt = delta / 1000;
    if (this.lookMs > 0 && !this.ui.isBlocking()) this.lookMs -= delta;
    const canMove = !this.locked && !this.transitioning && !this.ui.isBlocking() && this.lookMs <= 0;
    let running = false;
    this.moving = false;

    if (canMove) {
      const k = this.keys;
      let dx = 0;
      let dy = 0;
      if (k.LEFT.isDown || k.A.isDown) dx -= 1;
      if (k.RIGHT.isDown || k.D.isDown) dx += 1;
      if (k.UP.isDown || k.W.isDown) dy -= 1;
      if (k.DOWN.isDown || k.S.isDown) dy += 1;
      if (dx || dy) {
        this.moving = true;
        if (Math.abs(dx) >= Math.abs(dy) && dx) this.facing = dx < 0 ? 'left' : 'right';
        else if (dy) this.facing = dy < 0 ? 'up' : 'down';
        running = this.allowRun && k.SHIFT.isDown && this.stamina > 0;
        const speed = this.moveSpeed(running);
        const len = Math.hypot(dx, dy);
        const mx = (dx / len) * speed * dt;
        const my = (dy / len) * speed * dt;
        if (!this.blockedBox(this.pos.x + mx, this.pos.y, BODY_W, BODY_H)) this.pos.x += mx;
        else if (!dy) this.cornerAssist('y', Math.sign(dx), speed * dt);
        if (!this.blockedBox(this.pos.x, this.pos.y + my, BODY_W, BODY_H)) this.pos.y += my;
        else if (!dx) this.cornerAssist('x', Math.sign(dy), speed * dt);
        this.syncPlayer();
        this.checkExit();
      }
    }

    this.stamina = Phaser.Math.Clamp(this.stamina + (running ? -MOVE.staminaDrain : MOVE.staminaRegen) * dt, 0, MOVE.staminaMax);
    this.drawStamina();
    this.mafuyu?.update(this.facing, this.moving || this.autoWalking, delta);
    this.updateGhost(delta);
    this.updateCycleAmbience(time, delta);
    this.onUpdate(time, delta);
  }

  /**
   * 转角辅助：朝某方向走被挡住，但所在格子的前方是通的（只是没对齐格子），
   * 就沿另一条轴把玩家往格子中线推。窄管道、门口转弯时不会卡住。
   */
  private cornerAssist(axis: 'x' | 'y', dir: number, step: number): void {
    const t = this.playerTile();
    const ahead = axis === 'y' ? this.charAt(t.x + dir, t.y) : this.charAt(t.x, t.y + dir);
    if (this.isSolid(ahead)) return;
    const c = this.tileCenter(t.x, t.y);
    if (axis === 'y') {
      const target = c.y + BODY_H / 2; // 碰撞盒在格子里居中时的脚下位置
      const d = Phaser.Math.Clamp(target - this.pos.y, -step, step);
      if (d && !this.blockedBox(this.pos.x, this.pos.y + d, BODY_W, BODY_H)) this.pos.y += d;
    } else {
      const d = Phaser.Math.Clamp(c.x - this.pos.x, -step, step);
      if (d && !this.blockedBox(this.pos.x + d, this.pos.y, BODY_W, BODY_H)) this.pos.x += d;
    }
  }

  protected moveSpeed(running: boolean): number {
    return running ? MOVE.runSpeed : MOVE.walkSpeed;
  }

  private checkExit(): void {
    const t = this.playerTile();
    const ch = this.charAt(t.x, t.y);
    if (!/[0-9]/.test(ch) || this.transitioning) return;
    if (this.onExit(ch)) return;
    const exit = this.room.exits[ch];
    if (exit) this.changeRoom(exit.to, exit.arriveAt);
  }

  /** 把玩家推回出口外一格（锁着的门） */
  protected bounceBack(): void {
    const v = DIR_VEC[this.facing];
    this.pos.x -= v.x * 14;
    this.pos.y -= v.y * 14;
    this.syncPlayer();
  }

  private drawStamina(): void {
    this.staminaBar.clear();
    if (this.stamina >= MOVE.staminaMax || GameState.isFinal) return;
    this.staminaBar.fillStyle(0x000000, 0.5).fillRect(28, 50, 120, 4);
    this.staminaBar.fillStyle(0x8a8a8a, 0.9).fillRect(28, 50, (120 * this.stamina) / MOVE.staminaMax, 4);
  }

  /** 精神值档位 3 起，移动时留下残影 */
  private updateGhost(delta: number): void {
    if (GameState.isFinal || !this.moving || sanityTier(GameState.save.sanity) < 3) return;
    this.ghostTimer -= delta;
    if (this.ghostTimer > 0) return;
    this.ghostTimer = sanityTier(GameState.save.sanity) === 4 ? 70 : 130;
    const img = this.mafuyu?.image;
    const ghost = img
      ? this.add.image(this.player.x, this.player.y, img.texture.key).setOrigin(img.originX, img.originY).setScale(img.scaleX).setAlpha(0.35).setTint(0x8a7aa8).setDepth(99)
      : this.add.rectangle(this.player.x, this.player.y - 24, 24, 48, 0x5c4f7c, 0.35).setDepth(99);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 450, onComplete: () => ghost.destroy() });
  }
}
