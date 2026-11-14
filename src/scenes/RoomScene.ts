import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MOVE, TILE } from '../core/constants';
import { GameState } from '../core/GameState';
import { hintLevel, MATERIALS, sanityTier } from '../core/progress';
import { tLines, tStory, tUi } from '../core/text';
import type { MaterialDef } from '../core/types';
import { makeFigure, PALETTE } from '../systems/figures';
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
  /** 这一帧玩家是否在移动 */
  protected moving = false;
  protected allowRun = true;
  protected stamina: number = MOVE.staminaMax;
  /** 是否允许打开手机 / 背包（QTE 等时候关掉） */
  protected menusOpen = true;
  private staminaBar!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cameraFx!: (time: number) => void;
  private ghostTimer = 0;
  private transitioning = false;
  private visited = new Set<string>();

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
    this.stamina = MOVE.staminaMax;
    this.facing = 'down';

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameraFx = createCameraFx(this.cameras.main);
    this.roomLayer = this.add.container(0, 0);
    this.player = makeFigure(this, 0, 0, { ...PALETTE.mafuyu }).setDepth(100);
    const eye = this.add.triangle(0, 0, 0, 0, 8, 0, 4, 6, 0xffffff).setName('facing');
    this.player.add(eye);
    this.staminaBar = this.add.graphics().setDepth(500).setScrollFactor(0);
    this.cameras.main.setBackgroundColor('#000000');
  }

  onInteract(): void {
    if (this.locked || this.transitioning) return;
    const v = DIR_VEC[this.facing];
    const probe = { x: this.pos.x + v.x * (TILE * 0.75), y: this.pos.y - 8 + v.y * (TILE * 0.75) };
    const tile = this.worldToTile(probe.x, probe.y);
    const ch = this.charAt(tile.x, tile.y);
    const obj = this.room.objects[ch];
    if (obj) this.onObject(obj, tile);
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
  }

  /** 调查后拿到材料的通用文字 */
  protected async pickup(m: MaterialDef, intro?: string | string[]): Promise<void> {
    GameState.addMaterial(m.id);
    const lines = intro ? (Array.isArray(intro) ? [...intro] : [intro]) : [];
    lines.push(tUi('obtained').replace('{name}', m.name));
    this.refreshHints();
    await this.say(lines);
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
    const g = this.add.graphics();
    this.roomLayer.add(g);

    const letters = new Set<string>();
    def.map.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === ' ') return;
        const px = this.originX + x * TILE;
        const py = this.originY + y * TILE;
        if (ch === '#') {
          g.fillStyle(wall, 1).fillRect(px, py, TILE, TILE);
          g.fillStyle(0xffffff, 0.04).fillRect(px, py + TILE - 6, TILE, 6);
          return;
        }
        g.fillStyle(floor, 1).fillRect(px, py, TILE, TILE);
        g.lineStyle(1, 0x000000, 0.18).strokeRect(px, py, TILE, TILE);
        if (/[0-9]/.test(ch)) {
          g.fillStyle(0x000000, 0.55).fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
          return;
        }
        if (def.objects[ch]) letters.add(ch);
      });
    });

    // 同一字母可能分散在多处（例如走廊的几扇窗），按连通区域分别画成一整块
    for (const comp of this.components(def, [...letters])) {
      const obj = def.objects[comp.ch];
      if (obj.hidden) continue;
      const x = this.originX + comp.x0 * TILE + 3;
      const y = this.originY + comp.y0 * TILE + 3;
      const cw = (comp.x1 - comp.x0 + 1) * TILE - 6;
      const chh = (comp.y1 - comp.y0 + 1) * TILE - 6;
      g.fillStyle(obj.color, 1).fillRect(x, y, cw, chh);
      g.lineStyle(1, 0x000000, 0.4).strokeRect(x, y, cw, chh);
      if (obj.label && cw >= TILE * 2 - 6) {
        this.roomLayer.add(this.add.text(x + cw / 2, y + chh / 2, obj.label, textStyle(13, '#00000099')).setOrigin(0.5));
      }
    }

    this.addMaterialHints();

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
    const canMove = !this.locked && !this.transitioning && !this.ui.isBlocking();
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
        if (!this.blockedBox(this.pos.x, this.pos.y + my, BODY_W, BODY_H)) this.pos.y += my;
        this.syncPlayer();
        this.checkExit();
      }
    }

    this.stamina = Phaser.Math.Clamp(this.stamina + (running ? -MOVE.staminaDrain : MOVE.staminaRegen) * dt, 0, MOVE.staminaMax);
    this.drawStamina();
    this.updateGhost(delta);
    this.onUpdate(time, delta);
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
    const ghost = this.add.rectangle(this.player.x, this.player.y - 24, 24, 48, 0x5c4f7c, 0.35).setDepth(99);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 450, onComplete: () => ghost.destroy() });
  }
}
