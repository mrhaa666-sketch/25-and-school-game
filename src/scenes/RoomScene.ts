import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MOVE, SANITY_COST, TILE } from '../core/constants';
import { GameState } from '../core/GameState';
import { hintLevel, hintRooms, MATERIALS, sanityTier } from '../core/progress';
import { tHas, tLines, tStory, tUi } from '../core/text';
import type { MaterialDef } from '../core/types';
import { makeFigure, PALETTE } from '../systems/figures';
import { Audio, type SoundKey } from '../systems/audio';
import { MafuyuSprite, PLAYER_HEIGHT } from '../systems/playerSprite';
import { CG_MOMENTS, fitImage, MAFUYU_STAND_REF, poseImage, tex } from '../systems/sprites';
import { textStyle } from '../systems/style';
import { createCameraFx } from '../systems/VisualFilter';
import { Darkness, type LightSource } from '../systems/Darkness';
import { SCENE } from './flow';
import { cycleLayout, ROOMS, type RoomDecor, type RoomDef, type RoomObject } from './rooms';
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
/** 后墙立面的高度（格） */
const FACADE_ROWS = 3;
/** 嵌在后墙上的门洞 / 门的高度：约 2.4 格 */
const DOOR_H = Math.round(TILE * 2.4);
const DOOR_W = Math.round(TILE * 1.5);
/** 贴图的基础色调：前四个周目压暗；终周目明显更亮（N9） */
const shade = (night: number, day: number) => (GameState.isFinal ? day : night);

/** 终周目（N9）：倒下的柜子、堆起来的桌椅都不在了，走廊是整齐的 */
function tidyForFinal(def: RoomDef): RoomDef {
  const gone = Object.keys(def.objects).filter((k) => ['locker_fallen', 'desk_pile'].includes(def.objects[k].id));
  if (!gone.length) return def;
  const re = new RegExp(`[${gone.join('')}]`, 'g');
  return { ...def, map: def.map.map((r) => r.replace(re, '.')) };
}

/** 窗外远景的视差系数 */
const WINDOW_PARALLAX = 0.85;
/** 前景层的视差系数 */
const FG_PARALLAX = 1.15;

/** 房间里的一盏固定光源，带上运行时的状态（闪烁相位、日光灯的灯管、追逐时熄灭） */
type RoomLightState = LightSource & {
  flicker?: boolean;
  phase?: number;
  lamp?: boolean;
  broken?: boolean;
  out?: boolean;
  fixture?: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
};

/** 门的种类：决定画多宽、没图时用什么颜色 */
type DoorKind = 'class' | 'iron' | 'gate';
const DOOR_KIND = (o: RoomObject): DoorKind | null => {
  const s = `${o.id} ${o.tex ?? ''}`;
  if (/class_door|burst_door|pink_door/.test(s)) return 'class';
  if (/iron_door/.test(s)) return 'iron';
  if (/school_gate/.test(s)) return 'gate';
  return null;
};
const DOOR_SIZE: Record<DoorKind, { w: number; h: number }> = {
  class: { w: DOOR_W, h: DOOR_H },
  iron: { w: TILE * 2, h: DOOR_H },
  gate: { w: TILE * 4, h: Math.round(TILE * 2.6) },
};

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
  /** 黑暗层（R4）和这个房间的固定光源 */
  protected darkness?: Darkness;
  private roomLights: RoomLightState[] = [];
  private leakLights: LightSource[] = [];
  private doorGlows: { rect: Phaser.GameObjects.Rectangle; x: number; y: number }[] = [];
  /** 演出临时加的光（子类可以往里放，自己负责移除） */
  protected extraLights: LightSource[] = [];
  /** 前景层（N4）：画在角色上方、带视差的东西；fade 是被角色挡住时的淡出系数 */
  private foreground: { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics; base: number; w: number; h: number; fade: number; lamp?: boolean }[] = [];
  /** 镜子倒影（N6） */
  private mirrorFx?: { img: Phaser.GameObjects.Image; glass: Phaser.Geom.Rectangle; history: { t: number; x: number; y: number; f: ReturnType<MafuyuSprite['mirrorFrame']> }[] };
  /** 窗外远景（N2）：每扇窗一块，按镜头位置做视差 */
  private windowViews: { ts: Phaser.GameObjects.TileSprite; x: number; scale: number }[] = [];
  /** 光里的灰尘（N5） */
  private dust?: Phaser.GameObjects.Graphics;
  private motes: { x: number; y: number; vx: number; vy: number; life: number; age: number; light: RoomLightState }[] = [];
  /** 场上的怪物（N7：在黑暗里保留一个看得见的轮廓） */
  private actors = new Set<Actor>();
  /** 按脚底 y 排序的东西（物件、玩家、怪物、成员演出图）。y 就是脚底 */
  private sorted = new Set<Phaser.GameObjects.GameObject & { y: number; setDepth(d: number): unknown }>();
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
  private stepAcc = 0;

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
    this.sorted = new Set();
    this.addShadow(this.player);
    this.ySort(this.player);
    if (this.mafuyu) this.applyPlayerLook(this.mafuyu.image);
    this.staminaBar = this.add.graphics().setDepth(500).setScrollFactor(0);
    // 四周目节拍器：随节拍整体压暗一下
    this.beatShade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(450).setAlpha(0);
    this.cameras.main.setBackgroundColor('#000000');
    this.setupHudCamera();
    // 黑暗层画在角色和物件上面（100~101），演出特效（110 以上）下面
    this.darkness = new Darkness(this, 105);
    this.roomLights = [];
    this.doorGlows = [];
    this.extraLights = [];
    this.actors = new Set();
    this.foreground = [];
    this.motes = [];
    // 灰尘画在黑暗层下面：只在被照亮的地方看得见
    this.dust = this.add.graphics().setDepth(103);
    this.beatShade.setVisible(false); // 节拍改为调制黑暗层的亮度
    this.registry.set('roomLit', !GameState.isFinal);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.set('roomLit', false);
      this.darkness?.destroy();
      this.darkness = undefined;
    });
    const lit = () => this.updateDarkness();
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, lit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.PRE_RENDER, lit));
    Audio.loop('amb', this.ambience(), 1600);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Audio.loop('whisper', null, 300));
  }

  /** 这一幕的环境音。子类可以改 */
  protected ambience(): SoundKey | null {
    return GameState.isFinal ? 'amb_quiet' : 'amb_hum';
  }

  onInteract(): void {
    if (this.locked || this.transitioning) return;
    const v = DIR_VEC[this.facing];
    const probe = { x: this.pos.x + v.x * (TILE * 0.75), y: this.pos.y - 8 + v.y * (TILE * 0.75) };
    const tile = this.worldToTile(probe.x, probe.y);
    const ch = this.charAt(tile.x, tile.y);
    // L3：一句话的调查点。文字还没写的时候没有反应
    const ex = this.examineAt(ch, tile);
    if (ex) {
      if (tHas(ex.key, GameState.save.cycle)) this.ui.say(this.text(ex.key));
      return;
    }
    const obj = this.room.objects[ch];
    if (!obj) return;
    if (this.onCycleObject(obj, tile)) return;
    this.onObject(obj, tile);
  }

  /** 这一格有没有一句话的调查点（按物件字母或格坐标，带周目条件） */
  private examineAt(ch: string, tile: { x: number; y: number }) {
    const cyc = GameState.save.cycle;
    return (this.room.examine ?? []).find(
      (e) => (!e.cycle || e.cycle.includes(cyc)) && (e.ch ? e.ch === ch : e.x === tile.x && e.y === tile.y),
    );
  }

  // ------------------------------------------------------------ 各周目的环境（交接文档 4.1 / 2.1.1）

  /** 物件在当前周目的样子：素材名、'portrait'（二周目的人像），或 null（画色块） */
  private cycleLook(obj: RoomObject): string | 'portrait' | null {
    const c = GameState.save.cycle;
    if (c === 2 && obj.id === 'corridor_window') return 'portrait'; // 墙上挂满没画完的人像
    if (c === 3 && (obj.id === 'class_door' || obj.id === 'burst_door')) return 'pink_door'; // 所有教室门变成粉色
    if (obj.look && this.textures.exists(tex('obj', obj.look))) return obj.look; // 新外观到了就用新的
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
    // 还没「停下」的门附近，听得到说话声
    let near = false;
    for (const [ch, imgs] of this.objectImages) {
      if (this.room.objects[ch]?.id !== 'class_door') continue;
      for (const img of imgs) {
        if (this.cycleTouched.has(`${this.room.id}:${Math.round(img.x)}`)) continue;
        if (Phaser.Math.Distance.Between(img.x, img.y, this.pos.x, this.pos.y) < 260) near = true;
      }
    }
    Audio.loop('whisper', near ? 'whisper' : null, near ? 800 : 150);
  }

  /** 四周目：全程节拍器，越往下层越快；走廊灯随节拍明灭。在一楼停留每 5 秒 -2 */
  private updateMetronome(_time: number, delta: number): void {
    const bpm = { 4: 60, 3: 80, 2: 104, 1: 136 }[this.room.floor ?? 0] ?? 90;
    this.beatAcc += delta;
    const beatMs = 60000 / bpm;
    if (this.beatAcc >= beatMs) {
      this.beatAcc -= beatMs;
      this.beatShade?.setAlpha(0.22);
      Audio.play('metronome', { rate: 0.9 + bpm / 600 });
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

  protected async say(lines: string | string[]): Promise<void> {
    // 刚取出的台词登记了 CG：说这几句的时候铺上 CG，说完淡出
    const cg = this.pendingCG;
    this.pendingCG = undefined;
    const shown = cg ? this.ui.showCG(tex('cg', cg)) : false;
    await this.ui.sayAsync(lines);
    if (shown) await this.ui.hideCG();
  }

  /** text() 取出的台词如果登记了 CG（CG_MOMENTS），下一次 say() 时显示 */
  private pendingCG?: string;

  /** 当前周目的剧情文本 */
  protected text(key: string): string[] {
    this.pendingCG = CG_MOMENTS[key];
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
    const body = poseImage(this, key, PLAYER_HEIGHT, MAFUYU_STAND_REF);
    this.addShadow(this.player, key === 'mafuyu_crawl' || key === 'mafuyu_fallen' ? 52 : 30);
    this.player.add(body ?? fallback());
    if (body) this.applyPlayerLook(body);
  }

  /**
   * 课桌变体：用房间 id 和格坐标做种子，同一张课桌每次进房间都是同一个样子。
   * 大约七成是普通课桌，其余三种各一成。
   */
  private deskVariant(roomId: string, x: number, y: number): 'tilted' | 'fallen' | 'carved' | null {
    let h = 2166136261;
    for (const c of `${roomId}:${x}:${y}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const r = ((h >>> 0) % 1000) / 1000;
    return r < 0.7 ? null : r < 0.8 ? 'tilted' : r < 0.9 ? 'fallen' : 'carved';
  }

  // ------------------------------------------------------------ 镜子倒影（N6）

  /** 墙上的镜子（物件 id mirror）：镜面里画玩家的倒影。只是画面，不触发任何东西 */
  private setupMirror(def: RoomDef): void {
    const ch = Object.keys(def.objects).find((k) => def.objects[k].id === 'mirror');
    const mimg = ch ? this.objectImages.get(ch)?.[0] : undefined;
    if (!mimg || !this.mafuyu) return;
    const b = mimg.getBounds();
    // 镜面：去掉镜框的一圈
    const glass = new Phaser.Geom.Rectangle(b.x + b.width * 0.16, b.y + b.height * 0.12, b.width * 0.68, b.height * 0.74);
    const img = this.add.image(0, 0, mimg.texture.key).setVisible(false).setTint(0x7a7a86).setAlpha(0.8);
    img.preFX?.addColorMatrix().saturate(-0.5);
    const mask = this.make.graphics({}, false);
    mask.fillRect(glass.x, glass.y, glass.width, glass.height);
    img.setMask(mask.createGeometryMask());
    this.roomLayer.add(img);
    this.roomExtras.push(mask);
    this.mirrorFx = { img, glass, history: [] };
  }

  private updateMirror(): void {
    const m = this.mirrorFx;
    if (!m || !this.mafuyu) return;
    const now = this.time.now;
    m.history.push({ t: now, x: this.pos.x, y: this.pos.y, f: this.mafuyu.mirrorFrame() });
    while (m.history.length > 2 && m.history[1].t < now - 600) m.history.shift();
    // 精神值第三、四档：倒影比本人慢 0.4 秒。终周目不延迟
    const tier = sanityTier(GameState.save.sanity);
    const lag = !GameState.isFinal && tier >= 3 ? 400 : 0;
    const s = lag ? (m.history.find((h) => h.t >= now - lag) ?? m.history[m.history.length - 1]) : m.history[m.history.length - 1];
    const floorY = m.glass.bottom + TILE * 1.2;
    const dist = s.y - floorY; // 离镜子所在的墙有多远
    const near = Math.abs(s.x - m.glass.centerX) < TILE * 2.5 && dist > -TILE && dist < TILE * 3.5;
    m.img.setVisible(near && this.player.visible);
    if (!near) return;
    // 越近，倒影越大、越靠下
    const k = Phaser.Math.Clamp(1 - dist / (TILE * 4), 0.35, 1);
    m.img
      .setTexture(s.f.key)
      .setOrigin(s.f.originX, s.f.originY)
      .setScale(s.f.scale * (0.45 + 0.25 * k))
      .setPosition(s.x, m.glass.bottom + 2 - (1 - k) * m.glass.height * 0.25);
  }

  // ------------------------------------------------------------ 窗外远景（N2）

  /** 远景贴图：night_view / dawn_view（2048×1024，左右无缝）；没到时用代码画的占位 */
  protected backdropKey(): string {
    const dawn = GameState.isFinal;
    const key = tex('backdrop', dawn ? 'dawn_view' : 'night_view');
    if (this.textures.exists(key)) return key;
    const fb = dawn ? 'backdrop-fallback-dawn' : 'backdrop-fallback-night';
    if (!this.textures.exists(fb)) {
      const w = 1024;
      const h = 512;
      const t = this.textures.createCanvas(fb, w, h);
      if (t) {
        const ctx = t.getContext();
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        if (dawn) {
          sky.addColorStop(0, '#5a6a80');
          sky.addColorStop(0.55, '#b8b4ae');
          sky.addColorStop(1, '#d8cfc0');
        } else {
          sky.addColorStop(0, '#05070c');
          sky.addColorStop(0.6, '#141a26');
          sky.addColorStop(1, '#1c2230');
        }
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);
        if (!dawn) {
          ctx.fillStyle = 'rgba(200,205,215,0.5)';
          for (let i = 0; i < 40; i++) ctx.fillRect((i * 263) % w, (i * 97) % (h * 0.45), 1.5, 1.5);
        }
        // 远处的屋顶和楼：下半部分的一排剪影（左右接得上）
        ctx.fillStyle = dawn ? '#3a3a40' : '#07080b';
        let x = 0;
        let i = 0;
        while (x < w) {
          const bw = 40 + ((i * 37) % 70);
          const bh = h * (0.12 + ((i * 53) % 30) / 100);
          ctx.fillRect(x, h - bh - h * 0.25, Math.min(bw, w - x), bh + h * 0.25);
          x += bw;
          i++;
        }
        t.refresh();
      }
    }
    return fb;
  }

  /**
   * 一扇窗的远景：一块和玻璃一样大的平铺图，每帧按镜头位置移动纹理，
   * 看起来远景比场景移动得慢（视差 0.85），横向循环。
   * 纵向位置跟楼层走：四楼看到的天空多，一楼看到的屋顶多。
   */
  private addWindowView(glass: Phaser.Geom.Rectangle, def: RoomDef): void {
    const key = this.backdropKey();
    const src = this.textures.get(key).getSourceImage();
    // 远景按 6 格高缩放
    const scale = (TILE * 6) / src.height;
    const r = new Phaser.Geom.Rectangle(glass.x + glass.width * 0.1, glass.y + glass.height * 0.1, glass.width * 0.8, glass.height * 0.8);
    const ts = this.add.tileSprite(r.x, r.y, r.width, r.height, key).setOrigin(0).setTileScale(scale).setTint(0xa0a0a0);
    const storey = def.floor ?? 4;
    const v = { 4: 0.1, 3: 0.25, 2: 0.4, 1: 0.55 }[storey] ?? 0.1;
    ts.tilePositionY = (src.height * v);
    this.roomLayer.add(ts);
    this.windowViews.push({ ts, x: r.x, scale });
  }

  private updateWindowViews(): void {
    if (!this.windowViews.length) return;
    const sx = this.cameras.main.scrollX;
    for (const w of this.windowViews) {
      // 远景上对应窗左边缘的位置：窗的世界坐标减去镜头移动的 15%
      w.ts.tilePositionX = (w.x - (1 - WINDOW_PARALLAX) * sx) / w.scale;
    }
  }

  // ------------------------------------------------------------ 装饰

  /** 装饰层：不参与碰撞，画在地板 / 立面上、物件下面。缺图时画色块 */
  private drawDecor(def: RoomDef): void {
    const cyc = GameState.save.cycle;
    for (const d of def.decor ?? []) {
      if (d.cycle && !d.cycle.includes(cyc)) continue;
      if (GameState.isFinal && !d.cycle) continue; // 终周目：地面贴花、主题装饰都不显示（N9）
      const cx = this.originX + d.x * TILE;
      const cy = this.originY + d.y * TILE;
      const w = (d.scale ?? 1) * TILE;
      const key = d.tex.startsWith('decal:') ? tex('decal', d.tex.slice(6)) : tex('obj', d.tex);
      let o: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
      if (this.textures.exists(key)) {
        // 地面贴花压暗、半透明一点，免得在暗处变成一块亮斑
        const decal = d.tex.startsWith('decal:');
        const img = this.add
          .image(cx, cy, key)
          .setAngle(d.angle ?? 0)
          .setAlpha((d.alpha ?? 1) * (decal ? 0.7 : 1))
          .setTint(decal ? shade(0x8a8a8a, 0xc0c0c0) : shade(0xc8c8c8, 0xf0f0f0));
        img.setScale(w / img.width);
        o = img;
      } else o = this.drawDecorBlock(d, cx, cy, w);
      if (d.fg) {
        this.roomExtras.push(o);
        this.addForeground(o, d.alpha ?? 0.6, w, w * 2);
      } else this.roomLayer.add(o);
    }
  }

  /** 装饰的色块占位：按名字大致画个形状 */
  private drawDecorBlock(d: RoomDecor, cx: number, cy: number, w: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics({ x: cx, y: cy });
    g.setAngle(d.angle ?? 0).setAlpha(d.alpha ?? 1);
    const name = d.tex.replace(/^decal:/, '');
    if (/rope/.test(name)) {
      // 垂下的绳子：从画面上方一直垂到这里，末端一个绳圈
      g.lineStyle(3, 0x8a7e66, 1).lineBetween(0, -TILE * 6, 0, 0);
      g.strokeCircle(0, w * 0.35, w * 0.35);
    } else if (/ribbon_04/.test(name)) {
      // 拉直横跨的缎带：一条略微下垂的线
      g.lineStyle(3, 0xc87a9a, 0.85);
      g.beginPath();
      g.moveTo(-w / 2, 0);
      for (let i = 1; i <= 10; i++) g.lineTo(-w / 2 + (w * i) / 10, Math.sin((Math.PI * i) / 10) * w * 0.06);
      g.strokePath();
    } else if (/ribbon/.test(name)) {
      // 缎带：一个蝴蝶结加两条带子
      const r = w / 2;
      g.fillStyle(0xc87a9a, 0.9);
      g.fillTriangle(0, 0, -r, -r * 0.55, -r, r * 0.55);
      g.fillTriangle(0, 0, r, -r * 0.55, r, r * 0.55);
      g.fillStyle(0xa85a7a, 1).fillCircle(0, 0, r * 0.18);
      g.lineStyle(2, 0xc87a9a, 0.85).lineBetween(0, 0, -r * 0.35, r * 1.1).lineBetween(0, 0, r * 0.3, r * 1.2);
    } else if (/stain|footprint/.test(name)) {
      g.fillStyle(0x0a0908, 0.35).fillEllipse(0, 0, w, w * 0.55);
    } else if (/crack|glass/.test(name)) {
      g.lineStyle(1, 0x0a0a0a, 0.6).lineBetween(-w / 2, 0, -w / 6, -w / 8).lineBetween(-w / 6, -w / 8, w / 6, w / 10).lineBetween(w / 6, w / 10, w / 2, -w / 12);
    } else if (/paper|test|score|chalk/.test(name)) {
      g.fillStyle(0x8a857a, 0.3).fillRect(-w * 0.35, -w * 0.25, w * 0.7, w * 0.5);
    } else {
      g.fillStyle(0x3a3530, 0.8).fillRect(-w / 2, -w / 2, w, w);
    }
    return g;
  }

  /** 绘名周目画像的色块占位：画框、深色画布、一张没画完的脸。6 种略有不同 */
  private drawPortraitBlock(g: Phaser.GameObjects.Graphics, box: { x: number; y: number; w: number; h: number }, n: number): void {
    const frame = [0x3a2e24, 0x2e2a26, 0x44382a, 0x302822, 0x3c3430, 0x2a2420][n - 1];
    const w = Math.min(box.w, box.h * 0.75);
    const h = Math.min(box.h, w / 0.75);
    const x = box.x + (box.w - w) / 2;
    const y = box.y + box.h - h;
    g.fillStyle(frame, 1).fillRect(x, y, w, h);
    g.fillStyle(0x1a1c1e, 1).fillRect(x + 3, y + 3, w - 6, h - 6);
    const fx = x + w / 2 + ((n % 3) - 1) * w * 0.08;
    const fy = y + h * (0.38 + (n % 2) * 0.06);
    g.fillStyle(0x8a8478, 0.8).fillEllipse(fx, fy, w * 0.38, h * 0.36);
    // 脸被涂掉了
    g.lineStyle(3, 0x1a1c1e, 0.9).lineBetween(fx - w * 0.2, fy - h * 0.1, fx + w * 0.2, fy + h * 0.08);
    g.lineBetween(fx - w * 0.18, fy + h * 0.06, fx + w * 0.16, fy - h * 0.12);
  }

  // ------------------------------------------------------------ 门和出口

  /** 新画的门是竖长图（512×768，大门 1024×768）；旧的 512×512 斜视角图不用，改画色块 */
  private isNewArt(key: string): boolean {
    if (!this.textures.exists(key)) return false;
    const src = this.textures.get(key).getSourceImage();
    return src.width !== src.height;
  }

  /** 这扇门通往的房间里还有没拿到的材料（当前周目） */
  private roomHasMaterials(roomId: string | undefined): boolean {
    const s = GameState.save;
    if (!roomId || s.cycle === 'final') return false;
    return MATERIALS.some((m) => m.theme === s.cycle && m.room === roomId && !s.materials.includes(m.id));
  }

  /**
   * 后墙上的一扇门：水平居中于 cx，底边对齐地面线 floorY。
   * 只是画得比出口格宽，判定和碰撞仍是原来的格子。
   * 外观：关着 / 门缝漏光（通往还有材料的房间）/ 半开（open）。
   */
  protected drawDoor(obj: RoomObject, cx: number, floorY: number, dest?: string, minW = 0, open = false): Phaser.GameObjects.Image | null {
    const kind = DOOR_KIND(obj) ?? 'class';
    const size = DOOR_SIZE[kind];
    const w = Math.max(size.w, minW);
    const h = size.h;
    const x = cx - w / 2;
    const y = floorY - h;
    const pink = this.cycleLook(obj) === 'pink_door';
    const leak = !open && kind === 'class' && !pink && this.roomHasMaterials(dest);
    const base = kind === 'iron' ? 'iron_door' : kind === 'gate' ? 'school_gate' : pink ? 'pink_door' : 'class_door';
    const variant = open ? `${base}_open` : leak ? `${base}_leak` : base;
    const key = [variant, base].map((n) => tex('obj', n)).find((k) => this.isNewArt(k));
    if (leak) {
      // 门缝漏出的光，照在门下的地面上
      this.leakLights.push({ tex: 'light_door_leak', x: cx, y: floorY + TILE * 0.4, radius: w * 0.7, intensity: 0.55, squash: 0.5 });
    }
    if (key) {
      const img = this.add.image(cx, floorY, key).setOrigin(0.5, 1).setDisplaySize(w, h).setTint(shade(0xc8c8c8, 0xf0f0f0));
      this.roomLayer.add(img);
      return img;
    }
    // 没有新图：色块门（门框、门板、门上的小窗、把手）
    const g = this.add.graphics();
    this.roomLayer.add(g);
    const panel = kind === 'iron' ? 0x34373a : kind === 'gate' ? 0x2a2c2e : pink ? 0x7a4458 : 0x43362a;
    g.fillStyle(0x15130f, 1).fillRect(x - 3, y - 3, w + 6, h + 3);
    if (open) {
      g.fillStyle(0x050505, 1).fillRect(x, y, w, h);
      g.fillStyle(panel, 1).fillRect(x, y, w * 0.45, h);
    } else g.fillStyle(panel, 1).fillRect(x, y, w, h);
    if (kind === 'gate') {
      g.lineStyle(2, 0x151617, 1);
      for (let bx = x + 8; bx < x + w - 4; bx += 10) g.lineBetween(bx, y + 4, bx, y + h);
      g.lineBetween(x, y + h * 0.3, x + w, y + h * 0.3);
    } else if (kind === 'iron') {
      g.lineStyle(2, 0x22252a, 1).strokeRect(x + 5, y + 6, w - 10, h - 12);
      g.lineBetween(cx, y + 6, cx, y + h - 6);
    } else if (!open) {
      g.fillStyle(0x0e1216, 1).fillRect(x + w * 0.22, y + h * 0.12, w * 0.56, h * 0.24);
      g.fillStyle(0x8a8070, 1).fillRect(x + w - 10, y + h * 0.55, 5, 3);
    }
    if (leak) {
      g.fillStyle(0xe8d8a0, 0.85).fillRect(x + 2, floorY - 2, w - 4, 2);
      g.fillStyle(0xe8d8a0, 0.5).fillRect(x + w - 2, y + 4, 2, h - 6);
    }
    return null;
  }

  /** 下边 / 侧边的出口：门槛。贴图按朝下的出口来画，其余方向旋转 */
  private drawThreshold(def: RoomDef, tx: number, ty: number, px: number, py: number): void {
    const out = (x: number, y: number) => (def.map[y]?.[x] ?? ' ') === ' ';
    const dir = out(tx, ty + 1) ? 'down' : out(tx, ty - 1) ? 'up' : out(tx - 1, ty) ? 'left' : 'right';
    const angle = { down: 0, up: 180, left: 90, right: -90 }[dir];
    const key = tex('obj', 'exit_threshold');
    if (this.textures.exists(key)) {
      const img = this.add.image(px + TILE / 2, py + TILE / 2, key).setDisplaySize(TILE * 1.5, TILE).setAngle(angle).setTint(shade(0xc8c8c8, 0xf0f0f0));
      this.roomLayer.add(img);
      return;
    }
    // 色块门槛：格子本身是暗的，靠房间里那一侧一道浅色的边，两边是门框
    const g = this.add.graphics();
    this.roomLayer.add(g);
    g.fillStyle(0x0b0a0d, 1).fillRect(px, py, TILE, TILE);
    g.fillStyle(0x4a463f, 1);
    if (dir === 'down') g.fillRect(px - 6, py, TILE + 12, 4);
    if (dir === 'up') g.fillRect(px - 6, py + TILE - 4, TILE + 12, 4);
    if (dir === 'left') g.fillRect(px + TILE - 4, py - 6, 4, TILE + 12);
    if (dir === 'right') g.fillRect(px, py - 6, 4, TILE + 12);
    g.fillStyle(0x2a2622, 1);
    if (dir === 'down' || dir === 'up') {
      g.fillRect(px - 6, py, 6, TILE);
      g.fillRect(px + TILE, py, 6, TILE);
    } else {
      g.fillRect(px, py - 6, TILE, 6);
      g.fillRect(px, py + TILE, TILE, 6);
    }
  }

  // ------------------------------------------------------------ 黑暗和光

  /** 房间数据里的光源，加上窗户自动生成的窗光 */
  private buildRoomLights(def: RoomDef, isBack: Set<string>): RoomLightState[] {
    const out: RoomLightState[] = [];
    const cyc = GameState.save.cycle;
    for (const l of def.lights ?? []) {
      if (l.cycle && !l.cycle.includes(cyc)) continue;
      if (l.kind === 'lamp') {
        out.push(this.makeLamp(l.x, l.y, l.state ?? 'on'));
        continue;
      }
      out.push({
        tex: l.tex,
        x: this.originX + l.x * TILE,
        y: this.originY + l.y * TILE,
        radius: (l.scale ?? 1.5) * TILE,
        intensity: l.intensity ?? 0.6,
        flicker: l.flicker,
      });
    }
    const windows = Object.keys(def.objects).filter((ch) => /window/.test(def.objects[ch].id) || def.objects[ch].tex === 'window_night');
    for (const comp of this.components(def, windows)) {
      if (this.cycleLook(def.objects[comp.ch]) === 'portrait') continue; // 绘名周目换成画像的窗：没有窗光
      const cx = this.originX + ((comp.x0 + comp.x1 + 1) / 2) * TILE;
      const cw = (comp.x1 - comp.x0 + 1) * TILE;
      if (isBack.has(`${comp.x0},${comp.y1}`)) {
        // 窗本身：窗外比屋里亮一点，远景看得见
        out.push({ x: cx, y: this.originY + (comp.y1 + 1 - FACADE_ROWS * 0.62) * TILE, radius: cw * 0.55 + 8, intensity: 0.5, squash: 1 });
        // 后墙上的窗：光落在窗下的地面
        out.push({ tex: 'light_window', x: cx, y: this.originY + (comp.y1 + 1.8) * TILE, radius: cw * 0.5 + TILE * 1.1, intensity: 0.8, squash: 0.6 });
      } else {
        // 侧墙上的窗：光往房间里面斜着落
        const inward = this.isSolid(this.charAt(comp.x0 - 1, comp.y0)) ? 1 : -1;
        const cy = this.originY + ((comp.y0 + comp.y1 + 1) / 2) * TILE;
        const h = (comp.y1 - comp.y0 + 1) * TILE;
        out.push({ tex: 'light_window', x: cx + inward * TILE * 1.6, y: cy + TILE * 0.3, radius: h * 0.5 + TILE, intensity: 0.75, squash: 0.75 });
      }
    }
    return out;
  }

  /**
   * 日光灯：地上一块灯光（light_lamp），头顶一根灯管（lamp_tube，没有图时画色块）。
   * 终周目灯全关：只画灭着的灯管。
   */
  private makeLamp(tx: number, ty: number, state: 'on' | 'flicker' | 'broken'): RoomLightState {
    const x = this.originX + tx * TILE;
    const y = this.originY + ty * TILE;
    const off = state === 'broken' || GameState.isFinal;
    // 灯管挂在头顶：画在光斑上方，盖在角色上面（N4 的前景层会接管它）
    const fy = y - TILE * 1.7;
    const key = tex('obj', 'lamp_tube');
    let fixture: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
    if (this.textures.exists(key)) {
      fixture = this.add.image(x, fy, key).setDisplaySize(TILE * 1.6, TILE * 0.4).setTint(off ? 0x555555 : 0xffffff);
    } else {
      const g = this.add.graphics({ x, y: fy });
      g.fillStyle(0x1c1c20, 1).fillRect(-TILE * 0.8, -5, TILE * 1.6, 10);
      g.fillStyle(off ? 0x46464c : 0xe6ebee, 1).fillRect(-TILE * 0.72, -2, TILE * 1.44, 4);
      fixture = g;
    }
    this.roomExtras.push(fixture);
    this.addForeground(fixture, 0.7, TILE * 1.6, TILE * 0.5, true);
    return {
      tex: 'light_lamp',
      x,
      y,
      radius: TILE * 2.3,
      intensity: off ? 0 : 0.7,
      squash: 0.65,
      flicker: state === 'flicker',
      phase: tx * 1.7 + ty,
      lamp: true,
      broken: off,
      fixture,
    };
  }

  /** 追逐时，追逐者身后的日光灯一盏盏熄灭（只是画面效果，不碰追逐的任何数值） */
  private chaseLampsOut(): void {
    for (const a of this.actors) {
      if (!a.obj.active || !a.obj.visible) continue;
      const vx = a.obj.x - this.pos.x;
      const vy = a.obj.y - this.pos.y;
      const len = Math.hypot(vx, vy);
      if (len < 1) continue;
      for (const l of this.roomLights) {
        if (!l.lamp || l.out || l.broken) continue;
        // 灯在追逐者身后（从玩家看过去，比追逐者更远）至少一格
        const along = ((l.x - a.obj.x) * vx + (l.y - a.obj.y) * vy) / len;
        if (along > TILE) {
          l.out = true;
          // 熄灭前闪两下
          l.flicker = true;
          this.time.delayedCall(260, () => (l.flicker = false, l.intensity = 0));
        }
      }
    }
  }

  // ------------------------------------------------------------ 前景层（N4）

  /**
   * 前景物：视差系数 1.15（比场景移动得快一点），透明度 0.5～0.7。
   * 数量限制（走廊三到五处、小房间最多一处）只算绳子、缎带这类；日光灯管不算在内。
   * 灯管画在黑暗层上面（自己会亮），其余画在黑暗层下面。
   * 位置预先补偿视差，让镜头对准它时它正好在原位。
   */
  private addForeground(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics, base: number, w: number, h: number, lamp = false): void {
    const k = FG_PARALLAX - 1;
    obj.setScrollFactor(FG_PARALLAX);
    obj.setPosition(obj.x + k * (obj.x - GAME_WIDTH / 2), obj.y + k * (obj.y - GAME_HEIGHT / 2));
    obj.setDepth(lamp ? 106 : 104).setAlpha(base);
    this.foreground.push({ obj, base: Math.min(0.7, Math.max(0.5, base)), w, h, fade: 1, lamp });
  }

  /** 玩家或怪物走到前景物下面时，前景物淡出到 0.2 以下，保证看得清角色 */
  private updateForeground(): void {
    if (!this.foreground.length) return;
    const cam = this.cameras.main;
    const k = FG_PARALLAX - 1;
    const bodies = [this.player, ...[...this.actors].map((a) => a.obj)].filter((o) => o.active && o.visible).map((o) => o.getBounds());
    for (const f of this.foreground) {
      // 前景物看起来在世界里的位置（扣掉视差）
      const ax = f.obj.x - k * cam.scrollX;
      const ay = f.obj.y - k * cam.scrollY;
      const rect = new Phaser.Geom.Rectangle(ax - f.w / 2 - 6, ay - f.h / 2 - 6, f.w + 12, f.h + 12);
      const covered = bodies.some((b) => Phaser.Geom.Intersects.RectangleToRectangle(rect, b));
      const target = covered ? 0.25 : 1;
      f.fade += (target - f.fade) * 0.15;
      if (!f.lamp) f.obj.setAlpha(f.base * f.fade);
    }
  }

  /**
   * 窗光和灯光里缓慢飘动的尘粒，光外没有。同屏总数有上限，优先保证帧率。终周目没有。
   */
  private updateDust(delta: number): void {
    const g = this.dust;
    if (!g) return;
    g.clear();
    if (GameState.isFinal) return;
    const sources = this.roomLights.filter((l) => (l.lamp || l.tex === 'light_window') && l.intensity > 0 && !l.out);
    if (!sources.length) return;
    const view = this.cameras.main.worldView;
    const visible = sources.filter((l) => view.contains(l.x, l.y) || Phaser.Geom.Rectangle.Overlaps(view, new Phaser.Geom.Rectangle(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2)));
    // 补充新的尘粒：每个光源最多 8 粒，总数最多 48
    const perLight = 8;
    const cap = 48;
    for (const l of visible) {
      if (this.motes.length >= cap) break;
      const n = this.motes.filter((m) => m.light === l).length;
      if (n < perLight && Math.random() < 0.08) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * l.radius * 0.8;
        this.motes.push({
          x: l.x + Math.cos(a) * r,
          y: l.y + Math.sin(a) * r * (l.squash ?? 1) - TILE * Math.random() * 1.5,
          vx: Phaser.Math.FloatBetween(-6, 6),
          vy: Phaser.Math.FloatBetween(2, 9),
          life: Phaser.Math.Between(3000, 6500),
          age: 0,
          light: l,
        });
      }
    }
    const dt = delta / 1000;
    this.motes = this.motes.filter((m) => {
      m.age += delta;
      if (m.age >= m.life || !visible.includes(m.light)) return false;
      m.x += m.vx * dt + Math.sin((m.age + m.x) * 0.002) * 3 * dt;
      m.y += m.vy * dt;
      // 淡入、淡出
      const t = m.age / m.life;
      const a = Math.min(1, t * 4, (1 - t) * 4) * 0.55;
      g.fillStyle(0xe8e4d8, a).fillCircle(m.x, m.y, 1);
      return true;
    });
  }

  /**
   * 终周目没有黑暗层，窗光改成叠加上去的晨光（light_window_dawn），更亮、范围更大。
   */
  private addDawnLight(): void {
    const key = this.textures.exists('light:light_window_dawn') ? 'light:light_window_dawn' : 'light-soft';
    if (key === 'light-soft' && !this.textures.exists(key)) return;
    for (const l of this.roomLights) {
      if (l.tex !== 'light_window') continue;
      const r = l.radius * 1.5;
      const img = this.add
        .image(l.x, l.y, key)
        .setDisplaySize(r * 2, r * 2 * (l.squash ?? 1))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xfff0d8)
        .setAlpha(0.4);
      this.roomLayer.add(img);
    }
  }

  private updateDarkness(): void {
    this.updateForeground();
    this.updateWindowViews();
    this.updateMirror();
    this.updateDust(this.game.loop.delta);
    if (!this.darkness) return;
    this.darkness.beat = this.beatShade ? this.beatShade.alpha / 0.22 : 0;
    // L4：奏周目的走廊，灯只在拍子上亮（追逐中不这样，免得追逐变难）
    const beatLamps = GameState.save.cycle === 4 && this.room.id.includes('corridor') && !this.isChasing();
    this.darkness.beatMode = beatLamps ? 'lamps' : 'dim';
    const t = this.time.now;
    const lights: LightSource[] = [];
    this.chaseLampsOut();
    for (const l of this.roomLights) {
      // 闪烁的灯：偶尔暗一下，各盏灯错开
      const ph = l.phase ?? 0;
      const k = l.flicker && Math.sin(t * 0.013 + ph) + Math.sin(t * 0.0071 + ph * 2.3) > 1.55 ? 0.15 : 1;
      const lit = l.intensity * k * (beatLamps && l.lamp ? Math.max(0.03, this.darkness.beat) : 1);
      if (l.fixture) {
        const fg = this.foreground.find((f) => f.obj === l.fixture);
        const glow = l.broken ? 0.5 : 0.3 + 0.4 * (lit / 0.7) * (1 - this.darkness.beat * 0.6);
        l.fixture.setAlpha(glow * (fg?.fade ?? 1));
      }
      if (lit > 0) lights.push({ tex: l.tex, x: l.x, y: l.y, radius: l.radius, intensity: lit, squash: l.squash });
    }
    for (const d of this.doorGlows) {
      if (!d.rect.active) continue;
      lights.push({ tex: 'light_door_leak', x: d.x, y: d.y, radius: TILE * 1.1, intensity: d.rect.alpha * 0.75, squash: 0.6 });
    }
    lights.push(...this.extraLights);
    // N7：怪物画在黑暗层下面，进到光里才看得清；光圈外给它一点微弱的光，
    // 保证始终能看出轮廓、判断位置和距离，不让追逐变难
    for (const a of this.actors) {
      if (!a.obj.active) {
        this.actors.delete(a);
        continue;
      }
      if (!a.obj.visible || a.obj.alpha < 0.05) continue;
      const b = a.obj.getBounds();
      lights.push({ x: b.centerX, y: b.centerY, radius: Math.max(b.width, b.height) * 0.75 + 10, intensity: 0.5 * a.obj.alpha });
    }
    this.darkness.update(this.player.visible ? { x: this.player.x, y: this.player.y } : null, lights);
  }

  // ------------------------------------------------------------ 遮挡和影子

  /** 加进遮挡排序：深度 = 100 + 脚底 y / 10000，每帧更新 */
  protected ySort<T extends Phaser.GameObjects.GameObject & { y: number; setDepth(d: number): unknown }>(o: T): T {
    this.sorted.add(o);
    o.setDepth(100 + o.y / 10000);
    return o;
  }

  /** 这个房间里、立在地上的东西：参与遮挡排序，换房间时一起清掉 */
  protected addRoomSorted<T extends Phaser.GameObjects.GameObject & { y: number; setDepth(d: number): unknown }>(o: T): T {
    this.roomExtras.push(o);
    return this.ySort(o);
  }

  private updateSort(): void {
    for (const o of this.sorted) {
      if (!o.active) this.sorted.delete(o);
      else o.setDepth(100 + o.y / 10000);
    }
  }

  /** 角色脚下的半透明椭圆阴影（放在容器最底层） */
  protected addShadow(c: Phaser.GameObjects.Container, w = 30): void {
    c.addAt(this.add.ellipse(0, -1, w, Math.round(w * 0.3), 0x000000, 0.35), 0);
  }

  /** 玩家贴图：乘上减弱的周目环境光，略微降饱和，让她不浮在场景上面。终周目不处理 */
  private applyPlayerLook(img: Phaser.GameObjects.Image): void {
    if (GameState.isFinal) return;
    const c = Phaser.Display.Color.HexStringToColor(GameState.cycleDef.environment.lightTint);
    const mix = (v: number) => Math.round(255 - (255 - v) * 0.5);
    img.setTint(Phaser.Display.Color.GetColor(mix(c.red), mix(c.green), mix(c.blue)));
    img.preFX?.addColorMatrix().saturate(-0.15);
  }

  /** 调查后拿到材料的通用文字 */
  protected async pickup(m: MaterialDef, intro?: string | string[]): Promise<void> {
    GameState.addMaterial(m.id);
    const lines = intro ? (Array.isArray(intro) ? [...intro] : [intro]) : [];
    lines.push(tUi('obtained').replace('{name}', m.name));
    lines.push(...this.materialComment(m.id));
    Audio.play('paper');
    this.refreshHints();
    await this.say(lines);
  }

  /** 拿到材料时真冬的一句话（text: materials.<id>），没有就不说 */
  protected materialComment(id: string): string[] {
    const key = `materials.${id}`;
    return tHas(key, GameState.save.cycle) ? this.text(key) : [];
  }

  // ------------------------------------------------------------ 镜头

  /**
   * 房间矮的时候放大镜头，让房间高度至少占屏幕的 70%（上限 2 倍，取 0.25 的倍数）。
   * 放大后比屏幕大的方向跟随玩家；房间整个放得下就居中不动。
   */
  protected frameRoom(worldW: number, worldH: number, top = this.originY): void {
    const cam = this.cameras.main;
    const minH = GAME_HEIGHT * 0.7;
    const zoom = worldH >= minH ? 1 : Math.min(2, Math.ceil(minH / worldH / 0.25) * 0.25);
    cam.setZoom(zoom);
    const cx = this.originX + worldW / 2;
    const cy = top + worldH / 2;
    const viewW = GAME_WIDTH / zoom;
    const viewH = GAME_HEIGHT / zoom;
    if (worldW > viewW || worldH > viewH) {
      // 边界至少和视野一样大，并以房间为中心，这样放不满的那个方向保持居中
      const bw = Math.max(worldW, viewW);
      const bh = Math.max(worldH, viewH);
      cam.setBounds(cx - bw / 2, cy - bh / 2, bw, bh);
      cam.startFollow(this.player, true, 0.12, 0.12);
    } else {
      cam.stopFollow();
      cam.removeBounds();
      cam.centerOn(cx, cy);
    }
  }

  /**
   * 屏幕固定的东西（scrollFactor 为 0：体力条、节拍标记、特写图、噪点）交给不缩放的 HUD 镜头画，
   * 主镜头只画房间。这样镜头放大时它们的位置和大小不变。
   */
  private setupHudCamera(): void {
    const main = this.cameras.main;
    const hud = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // 淡入淡出两个镜头一起做
    for (const m of ['fadeIn', 'fadeOut', 'fade'] as const) {
      const orig = main[m].bind(main) as (...a: unknown[]) => Phaser.Cameras.Scene2D.Camera;
      const mirror = hud[m].bind(hud) as (...a: unknown[]) => Phaser.Cameras.Scene2D.Camera;
      (main as unknown as Record<string, unknown>)[m] = (...a: unknown[]) => {
        // 回调只留给主镜头，避免触发两次
        mirror(...a.slice(0, 4));
        return orig(...a);
      };
    }
    const assign = () => {
      for (const o of this.children.list) {
        const sf = (o as unknown as { scrollFactorX?: number }).scrollFactorX;
        o.cameraFilter = sf === 0 ? main.id : hud.id;
      }
    };
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, assign);
    const sort = () => this.updateSort();
    this.events.on(Phaser.Scenes.Events.PRE_RENDER, sort);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.PRE_RENDER, sort));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.PRE_RENDER, assign));
  }

  // ------------------------------------------------------------ 房间

  protected loadRoom(roomOrId: string | RoomDef, arriveAt?: string, at?: { x: number; y: number }): void {
    let def = typeof roomOrId === 'string' ? ROOMS[roomOrId] : roomOrId;
    if (!def) throw new Error(`没有这个房间：${String(roomOrId)}`);
    if (GameState.isFinal) def = tidyForFinal(def);
    def = cycleLayout(def, GameState.save.cycle);
    this.room = def;
    this.roomLayer.removeAll(true);

    const w = Math.max(...def.map.map((r) => r.length));
    const h = def.map.length;
    const worldW = w * TILE;
    const worldH = h * TILE;
    // 后墙的立面向上多占 2 格，地图顶上要给它留出空间；居中和镜头都把这部分算进去
    const back = this.backWallCells(def);
    const minBackY = back.length ? Math.min(...back.map((c) => c.y)) : FACADE_ROWS;
    const extra = Math.max(0, FACADE_ROWS - 1 - minBackY) * TILE;
    const totalH = worldH + extra;
    this.originX = worldW > GAME_WIDTH ? 0 : Math.floor((GAME_WIDTH - worldW) / 2);
    this.originY = (totalH > GAME_HEIGHT ? 0 : Math.floor((GAME_HEIGHT - totalH) / 2)) + extra;

    const env = GameState.cycleDef.environment;
    const floor = Phaser.Display.Color.HexStringToColor(def.floorColor ?? env.floorColor).color;
    const wall = Phaser.Display.Color.HexStringToColor(def.wallColor ?? env.wallColor).color;
    this.roomExtras.forEach((o) => o.destroy());
    this.roomExtras = [];
    this.foreground = [];
    this.motes = [];
    this.windowViews = [];
    this.mirrorFx = undefined;
    this.objectImages = new Map();
    const floorKey = this.floorTexFor(def);
    const texturedFloor = this.textures.exists(floorKey);
    const isBack = new Set(back.map((c) => `${c.x},${c.y}`));
    // 立面：新的 wall_face_*（512×768 = 2 格宽 3 格高）；没有就先用旧墙贴图顶替
    const faceKey = def.wallTex ? tex('tile', def.wallTex) : this.facadeTex();
    const texturedFace = this.textures.exists(faceKey);
    const topKey = def.wallTex ? tex('tile', def.wallTex) : tex('tile', 'wall_top');
    const texturedTop = this.textures.exists(topKey);
    const floorMask = this.make.graphics({}, false);
    const topMask = this.make.graphics({}, false);
    const faceMask = this.make.graphics({}, false);
    const g = this.add.graphics();
    this.roomLayer.add(g);
    // 墙顶没有贴图时用的颜色：接近黑的深灰，靠地板一侧描一道边
    const topColor = shade(0x1b1a1f, 0x45444a);
    const walkableAt = (x: number, y: number) => {
      const ch = def.map[y]?.[x] ?? ' ';
      return ch !== ' ' && ch !== '#' && !def.objects[ch]?.wall && !isBack.has(`${x},${y}`);
    };
    const drawTop = (x: number, y: number, px: number, py: number) => {
      // 紧挨着后墙的墙顶（房间的上角）跟着立面一起向上延伸，不留缺口
      if (isBack.has(`${x - 1},${y}`) || isBack.has(`${x + 1},${y}`)) {
        const up = (FACADE_ROWS - 1) * TILE;
        if (texturedTop) topMask.fillRect(px, py - up, TILE, up);
        else g.fillStyle(topColor, 1).fillRect(px, py - up, TILE, up);
      }
      if (texturedTop) return void topMask.fillRect(px, py, TILE, TILE);
      g.fillStyle(topColor, 1).fillRect(px, py, TILE, TILE);
      g.fillStyle(0x34323a, 1);
      if (walkableAt(x, y + 1)) g.fillRect(px, py + TILE - 2, TILE, 2);
      if (walkableAt(x, y - 1)) g.fillRect(px, py, TILE, 2);
      if (walkableAt(x - 1, y)) g.fillRect(px, py, 2, TILE);
      if (walkableAt(x + 1, y)) g.fillRect(px + TILE - 2, py, 2, TILE);
    };

    const letters = new Set<string>();
    const exitCells: { ch: string; x: number; y: number; back: boolean }[] = [];
    this.leakLights = [];
    def.map.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === ' ') return;
        const px = this.originX + x * TILE;
        const py = this.originY + y * TILE;
        const backWall = isBack.has(`${x},${y}`);
        if (backWall) {
          // 朝向玩家的后墙：从这一格的下沿向上 3 格
          if (texturedFace) faceMask.fillRect(px, py + TILE - FACADE_ROWS * TILE, TILE, FACADE_ROWS * TILE);
          else g.fillStyle(wall, 1).fillRect(px, py + TILE - FACADE_ROWS * TILE, TILE, FACADE_ROWS * TILE);
        }
        if (ch === '#') {
          if (!backWall) drawTop(x, y, px, py);
          return;
        }
        // 侧墙 / 下墙上的贴墙物件（窗、侧门）：底下是墙顶，不是地板
        if (!backWall && def.objects[ch]?.wall) {
          drawTop(x, y, px, py);
          letters.add(ch);
          return;
        }
        if (!backWall) {
          if (texturedFloor) floorMask.fillRect(px, py, TILE, TILE);
          else {
            g.fillStyle(floor, 1).fillRect(px, py, TILE, TILE);
            g.lineStyle(1, 0x000000, 0.18).strokeRect(px, py, TILE, TILE);
          }
        }
        if (/[0-9]/.test(ch)) {
          exitCells.push({ ch, x, y, back: backWall });
          return;
        }
        if (def.objects[ch]) letters.add(ch);
      });
    });
    // 后墙脚下的一道阴影
    for (const c of back) {
      const px = this.originX + c.x * TILE;
      const py = this.originY + (c.y + 1) * TILE;
      g.fillStyle(0x000000, 0.35).fillRect(px, py, TILE, 4);
      g.fillStyle(0x000000, 0.18).fillRect(px, py + 4, TILE, 6);
    }

    // 贴图：整片平铺，再用遮罩只露出对应的格子
    const tiled = (
      key: string,
      mask: Phaser.GameObjects.Graphics,
      area: { x: number; y: number; w: number; h: number },
      scaleX: number,
      scaleY: number,
      tint: number,
      depth: number,
    ) => {
      const ts = this.add.tileSprite(area.x, area.y, area.w, area.h, key).setOrigin(0).setDepth(depth);
      ts.setTileScale(scaleX, scaleY).setTint(tint).setMask(mask.createGeometryMask());
      this.roomExtras.push(ts, mask);
      return ts;
    };
    const roomArea = { x: this.originX, y: this.originY, w: worldW, h: worldH };
    if (texturedFloor) tiled(floorKey, floorMask, roomArea, (TILE * 4) / 512, (TILE * 4) / 512, this.floorTint(def), -20);
    else floorMask.destroy();
    if (texturedTop && !def.wallTex) {
      const src = this.textures.get(topKey).getSourceImage();
      const up = (FACADE_ROWS - 1) * TILE;
      tiled(topKey, topMask, { ...roomArea, y: roomArea.y - up, h: roomArea.h + up }, TILE / src.width, TILE / src.height, shade(0x909090, 0xbcbcbc), -19);
    } else if (texturedTop) tiled(topKey, topMask, roomArea, (TILE * 2) / 512, (TILE * 2) / 512, shade(0x707070, 0xa8a8a8), -19);
    else topMask.destroy();
    if (texturedFace && back.length) {
      // 每一排后墙一条：横向按 2 格一个周期平铺（和格子对齐），纵向正好 3 格不重复
      const src = this.textures.get(faceKey).getSourceImage();
      const sx = (TILE * 2) / src.width;
      const sy = (TILE * FACADE_ROWS) / src.height;
      for (const y of new Set(back.map((c) => c.y))) {
        const top = this.originY + (y + 1 - FACADE_ROWS) * TILE;
        const rowMask = this.make.graphics({}, false);
        for (const c of back) if (c.y === y) rowMask.fillRect(this.originX + c.x * TILE, top, TILE, FACADE_ROWS * TILE);
        tiled(faceKey, rowMask, { x: this.originX, y: top, w: worldW, h: FACADE_ROWS * TILE }, sx, sy, shade(0x808080, 0xb8b8b8), -18);
      }
    }
    faceMask.destroy();

    this.drawDecor(def);

    // 物件：有图用图，没图画色块。同一字母可能分散在多处（例如走廊的几扇窗），按连通区域分别画
    let portraitIndex = 0;
    for (const comp of this.components(def, [...letters])) {
      const obj = def.objects[comp.ch];
      if (obj.hidden) continue;
      const x = this.originX + comp.x0 * TILE;
      const y = this.originY + comp.y0 * TILE;
      const cw = (comp.x1 - comp.x0 + 1) * TILE;
      const chh = (comp.y1 - comp.y0 + 1) * TILE;
      if (obj.wall && isBack.has(`${comp.x0},${comp.y1}`) && DOOR_KIND(obj)) {
        const img = this.drawDoor(obj, x + cw / 2, y + chh, def.doors?.[comp.ch], cw);
        if (img) {
          const list = this.objectImages.get(comp.ch) ?? [];
          list.push(img);
          this.objectImages.set(comp.ch, list);
        }
        continue;
      }
      let look = this.cycleLook(obj);
      // N1：普通课桌按房间和位置固定地选一种样子（考场的桌子、带材料的桌子、终周目都不变）
      let deskFx: 'tilted' | 'fallen' | null = null;
      if (obj.id === 'desk' && look === 'school_desk' && !obj.spot && !GameState.isFinal) {
        const v = this.deskVariant(def.id, comp.x0, comp.y0);
        if (v) {
          const key = tex('obj', `school_desk_${v}`);
          if (this.textures.exists(key)) look = `school_desk_${v}`;
          else if (v !== 'carved') deskFx = v; // 新图没到：先把普通课桌歪一下 / 放倒，代替变体
        }
      }
      if (look === 'portrait') {
        // 绘名周目：走廊的窗换成画像。按顺序轮换 6 张，同一条走廊里不会连续重复
        const n = (portraitIndex++ % 6) + 1;
        const box = isBack.has(`${comp.x0},${comp.y1}`) ? this.onFacadeBox(obj, x, y + chh, cw) : { x: x + 4, y: y - TILE * 0.9, w: cw - 8, h: chh + TILE * 0.9 };
        const pimg = fitImage(this, tex('obj', `ena_portrait_0${n}`), box);
        if (pimg) {
          pimg.setTint(shade(0xc8c8c8, 0xf0f0f0));
          this.roomLayer.add(pimg);
          const list = this.objectImages.get(comp.ch) ?? [];
          list.push(pimg);
          this.objectImages.set(comp.ch, list);
        } else this.drawPortraitBlock(g, box, n);
        continue;
      }
      const img = look
        ? fitImage(
            this,
            tex('obj', look),
            obj.wall && isBack.has(`${comp.x0},${comp.y1}`)
              ? this.onFacadeBox(obj, x, y + chh, cw)
              : obj.wall
              ? this.isSolid(this.charAt(comp.x0, comp.y0 - 1)) || comp.y0 === 0
                ? { x, y: y - TILE * 1.2, w: cw, h: chh + TILE * 1.2 } // 上墙 / 侧墙：向上多占一点
                : { x, y, w: cw, h: chh } // 下墙：上方是地板，不往上画
              : { x: x - cw * 0.08, y: y - chh * 0.35, w: cw * 1.16, h: chh * 1.35 + 4 },
          )
        : null;
      if (img) {
        img.setTint(shade(0xc8c8c8, 0xf0f0f0));
        // N2：后墙上的窗，玻璃后面是远景（画在窗的图下面，从透明的玻璃透出来）
        if (look === 'window_night' && isBack.has(`${comp.x0},${comp.y1}`)) this.addWindowView(img.getBounds(), def);
        if (deskFx === 'tilted') img.setAngle(9);
        if (deskFx === 'fallen') img.setAngle(-80).setTint(0xa8a8a8);
        if (obj.fit) {
          img.setScale(img.scaleX * (obj.fit.scale ?? 1));
          img.setPosition(img.x + (obj.fit.dx ?? 0) * TILE, img.y + (obj.fit.dy ?? 0) * TILE);
        }
        if (obj.wall) this.roomLayer.add(img);
        else {
          // 立在地上的物件：和角色一起按脚底的 y 排序，脚下一块椭圆阴影
          this.roomExtras.push(img);
          this.ySort(img);
          const sh = this.add.ellipse(x + cw / 2, y + chh, cw * 0.85, Math.min(14, chh * 0.4), 0x000000, 0.3);
          this.roomLayer.add(sh);
        }
        const list = this.objectImages.get(comp.ch) ?? [];
        list.push(img);
        this.objectImages.set(comp.ch, list);
        continue;
      }
      // 没有图：画色块。后墙上的物件画在立面上（和有图时同一个位置）
      const r = obj.wall && isBack.has(`${comp.x0},${comp.y1}`)
        ? this.onFacadeBox(obj, x, y + chh, cw)
        : obj.id === 'pillar'
        ? { x: x + 4, y: y - TILE * 1.6, w: cw - 8, h: chh + TILE * 1.6 } // 柱子：立起来
        : { x, y, w: cw, h: chh };
      g.fillStyle(obj.color, 1).fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      g.lineStyle(1, 0x000000, 0.4).strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      if (obj.label && cw >= TILE * 2) {
        this.roomLayer.add(this.add.text(x + cw / 2, y + chh / 2, obj.label, textStyle(13, '#00000099')).setOrigin(0.5));
      }
    }

    // 出口：后墙上的画成完整的门，下边和侧边的画成门槛
    for (const e of exitCells) {
      const px = this.originX + e.x * TILE;
      const py = this.originY + e.y * TILE;
      if (e.back) this.drawDoor({ id: 'class_door', color: 0, tex: 'class_door' }, px + TILE / 2, py + TILE, def.doors?.[e.ch]);
      else this.drawThreshold(def, e.x, e.y, px, py);
    }

    this.setupMirror(def);
    this.addMaterialHints();
    this.addDoorLights();
    this.roomLights = [...this.buildRoomLights(def, isBack), ...this.leakLights];
    if (GameState.isFinal) this.addDawnLight();

    this.frameRoom(worldW, totalH, this.originY - extra);

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
    this.doorGlows = [];
    if (GameState.isFinal) return; // 终周目：灯是关着的
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
      // 门在后墙时灯画在门框上方，其余画在这一格的上沿
      const onBack = this.backWallCells(this.room).some((b) => b.x === t.x && b.y === t.y);
      const ly = onBack ? c.y + TILE / 2 - DOOR_H - 5 : c.y - TILE / 2 + 3;
      const light = this.add.rectangle(c.x, ly, 18, 4, 0xe8e0c0, 0.7).setDepth(4);
      this.roomLayer.add(light);
      // 门灯真的照亮门前的一小块地面（后墙的门照在门下，侧面的门照在这一格）
      this.doorGlows.push({ rect: light, x: c.x, y: onBack ? c.y + TILE * 0.8 : c.y });
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
  /** 地板按楼层选材质；房间自己指定了的不变。周目的差别交给 floorTint */
  private floorTexFor(def: RoomDef): string {
    if (def.floorTex) return tex('tile', def.floorTex);
    const byStorey: Record<number, string> = { 4: 'floor_school', 3: 'floor_f3', 2: 'floor_f2', 1: 'floor_f1' };
    const key = tex('tile', byStorey[def.floor ?? 4] ?? 'floor_school');
    return this.textures.exists(key) ? key : tex('tile', 'floor_school');
  }

  /** 地板的色调：基础灰度乘上周目的环境光颜色。终周目不加色调 */
  private floorTint(def: RoomDef): number {
    if (GameState.isFinal) return 0xdcdcdc; // 终周目：不加周目色调，整体更亮
    if (def.floorTex) return 0xb0b0b0;
    const c = Phaser.Display.Color.HexStringToColor(GameState.cycleDef.environment.lightTint);
    const k = 0xb0 / 255;
    return Phaser.Display.Color.GetColor(Math.round(c.red * k), Math.round(c.green * k), Math.round(c.blue * k));
  }

  /** 各周目的墙立面；新图没到时退回旧的墙贴图 */
  private facadeTex(): string {
    const c = GameState.save.cycle;
    const name = { 1: 'school', 2: 'ena', 3: 'mizuki', 4: 'kanade', final: 'school' }[c] ?? 'school';
    const key = tex('tile', `wall_face_${name}`);
    if (this.textures.exists(key)) return key;
    return tex('tile', c === 2 ? 'wall_school_ena' : c === 3 ? 'wall_school_mizuki' : 'wall_school');
  }

  /**
   * 朝向玩家的后墙：本身是墙（# / 贴墙物件 / 墙上的出口），而正下方是可以走的格子。
   */
  protected backWallCells(def: RoomDef): { x: number; y: number }[] {
    const at = (x: number, y: number) => def.map[y]?.[x] ?? ' ';
    const wallish = (x: number, y: number): boolean => {
      const ch = at(x, y);
      if (ch === '#') return true;
      if (def.objects[ch]?.wall) return true;
      // 出口数字：上面是墙或地图外时，算嵌在墙里
      if (/[0-9]/.test(ch)) return y === 0 || at(x, y - 1) === ' ' || wallish(x, y - 1);
      return false;
    };
    const walkable = (x: number, y: number) => {
      const ch = at(x, y);
      return ch !== ' ' && !wallish(x, y);
    };
    const out: { x: number; y: number }[] = [];
    // 上方也是可走的格子时（两块区域之间的隔墙）不算后墙，画成矮的墙顶，免得立面盖住上面的地板
    def.map.forEach((row, y) => [...row].forEach((_, x) => wallish(x, y) && walkable(x, y + 1) && !walkable(x, y - 1) && out.push({ x, y })));
    return out;
  }

  /**
   * 后墙上的物件画在立面上：门、楼梯口、大门从地面立起（约 2.4 格高）；
   * 黑板、窗、镜子、钟挂在中上部，下沿离地约 1 格。floorY 是这面墙的地面线。
   */
  private onFacadeBox(obj: RoomObject, x: number, floorY: number, w: number) {
    const standing = /door|gate|stairs|pipe|vent/.test(`${obj.id} ${obj.tex ?? ''}`);
    if (standing) {
      // 门至少 1.5 格宽，居中于物件
      const dw = Math.max(w, DOOR_W);
      return { x: x + w / 2 - dw / 2, y: floorY - DOOR_H, w: dw, h: DOOR_H };
    }
    const top = floorY - FACADE_ROWS * TILE + 8;
    return { x, y: top, w, h: floorY - TILE - top };
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
    Audio.play('door_open');
    const from = this.room?.floor;
    const to = ROOMS[roomId]?.floor;
    const stairs = from !== undefined && to !== undefined && from !== to && this.allowStairwell();
    if (stairs) this.backdropKey(); // 远景的占位图要先生成好
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, async () => {
      // N8：换楼层时，淡出和淡入之间插一段楼梯间
      if (stairs) await this.ui.playStairwell(from!, to!, GameState.isFinal);
      if (!this.sys.isActive()) return;
      this.loadRoom(roomId, arriveAt);
      this.cameras.main.fadeIn(250, 0, 0, 0);
      this.transitioning = false;
    });
  }

  /**
   * 换楼层时能不能插楼梯间过场（N8）。追逐、限时、剧情演出进行中的换层不插。
   * 子类有追逐 / 限时的话覆盖它。
   */
  protected allowStairwell(): boolean {
    return !this.isChasing();
  }

  /** 正在追逐（子类有追逐的覆盖它） */
  protected isChasing(): boolean {
    return false;
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
    obj.setPosition(x, y);
    this.addShadow(obj, Math.max(30, w || 30));
    this.ySort(obj);
    const actor = { obj, x, y, speed, w, h };
    this.actors.add(actor);
    return actor;
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
    this.footsteps(delta, running);
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

  /** 脚步声：走、跑、爬的间隔不同，每一步音高略有变化 */
  private footsteps(delta: number, running: boolean): void {
    if (!(this.moving || this.autoWalking)) {
      this.stepAcc = 0;
      return;
    }
    const crawl = this.moveSpeed(false) < 80;
    const interval = crawl ? 620 : running ? 300 : 430;
    this.stepAcc += delta;
    if (this.stepAcc < interval) return;
    this.stepAcc -= interval;
    Audio.play(crawl ? 'crawl' : running ? 'step_run' : 'step_walk', { rate: Phaser.Math.FloatBetween(0.9, 1.1) });
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
