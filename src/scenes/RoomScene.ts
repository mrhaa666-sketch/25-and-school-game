import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MOVE, TILE } from '../core/constants';
import { GameState } from '../core/GameState';
import { hintLevel, MATERIALS, sanityTier } from '../core/progress';
import type { MaterialDef } from '../core/types';
import { createCameraFx } from '../systems/VisualFilter';
import { textStyle } from '../systems/style';
import { SCENE } from './flow';
import { ROOMS, type RoomDef, type RoomObject } from './rooms';
import type { PlayTarget, UIScene } from './UIScene';

type Dir = 'up' | 'down' | 'left' | 'right';
const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** 玩家的碰撞盒（脚下一块），比格子小一点，方便过门 */
const BODY_W = 24;
const BODY_H = 20;

/**
 * 俯视角房间场景的基类：画格子、移动与碰撞、调查、出口切换、精神值滤镜。
 * 每一幕继承它，只写剧情相关的部分（onObject / onEnterRoom / onUpdate）。
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
  protected stamina: number = MOVE.staminaMax;
  private staminaBar!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cameraFx!: (time: number) => void;
  private ghostTimer = 0;
  private transitioning = false;
  private visited = new Set<string>();

  protected abstract onObject(obj: RoomObject, tile: { x: number; y: number }): void;
  protected onEnterRoom(_roomId: string, _firstTime: boolean): void {}
  protected onUpdate(_time: number, _dt: number): void {}

  create(): void {
    this.ui = this.scene.get(SCENE.ui) as UIScene;
    this.ui.setTarget(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.ui?.scene.isActive()) this.ui.setTarget(null);
    });

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameraFx = createCameraFx(this.cameras.main);
    this.roomLayer = this.add.container(0, 0);
    this.player = this.buildPlayer();
    this.staminaBar = this.add.graphics().setDepth(500);
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
    return !this.transitioning;
  }

  // ------------------------------------------------------------ 房间

  protected loadRoom(roomId: string, arriveAt?: string): void {
    const def = ROOMS[roomId];
    if (!def) throw new Error(`没有这个房间：${roomId}`);
    this.room = def;
    this.roomLayer.removeAll(true);

    const w = Math.max(...def.map.map((r) => r.length));
    const h = def.map.length;
    this.originX = Math.floor((GAME_WIDTH - w * TILE) / 2);
    this.originY = Math.floor((GAME_HEIGHT - h * TILE) / 2);

    const env = GameState.cycleDef.environment;
    const floor = Phaser.Display.Color.HexStringToColor(env.floorColor).color;
    const wall = Phaser.Display.Color.HexStringToColor(env.wallColor).color;
    const g = this.add.graphics();
    this.roomLayer.add(g);

    // 物件按字母合并成一个矩形
    const bounds: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
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
        if (def.objects[ch]) {
          const b = (bounds[ch] ??= { x0: x, y0: y, x1: x, y1: y });
          b.x0 = Math.min(b.x0, x);
          b.y0 = Math.min(b.y0, y);
          b.x1 = Math.max(b.x1, x);
          b.y1 = Math.max(b.y1, y);
        }
      });
    });
    // 同一字母可能分散在多处（例如走廊的几扇窗），按连通区域分别画成一整块
    for (const comp of this.components(def, Object.keys(bounds))) {
      const obj = def.objects[comp.ch];
      const x = this.originX + comp.x0 * TILE + 3;
      const y = this.originY + comp.y0 * TILE + 3;
      const w = (comp.x1 - comp.x0 + 1) * TILE - 6;
      const h = (comp.y1 - comp.y0 + 1) * TILE - 6;
      g.fillStyle(obj.color, 1).fillRect(x, y, w, h);
      g.lineStyle(1, 0x000000, 0.4).strokeRect(x, y, w, h);
      if (obj.label && w >= TILE * 2 - 6) {
        this.roomLayer.add(this.add.text(x + w / 2, y + h / 2, obj.label, textStyle(13, '#00000099')).setOrigin(0.5));
      }
    }

    this.addMaterialHints();

    // 放置玩家
    const spawn = arriveAt ? this.arrivalTile(arriveAt) : (def.spawn ?? { x: 1, y: 1 });
    this.pos.set(this.originX + (spawn.x + 0.5) * TILE, this.originY + (spawn.y + 0.5) * TILE + 8);
    this.syncPlayer();
    this.children.bringToTop(this.player);

    const first = !this.visited.has(roomId);
    this.visited.add(roomId);
    this.onEnterRoom(roomId, first);
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

  /** 从某个出口进入时，出现在出口旁边可走的格子上 */
  private arrivalTile(exitChar: string): { x: number; y: number } {
    for (let y = 0; y < this.room.map.length; y++) {
      const x = this.room.map[y].indexOf(exitChar);
      if (x < 0) continue;
      for (const d of Object.values(DIR_VEC)) {
        if (this.charAt(x + d.x, y + d.y) === '.') return { x: x + d.x, y: y + d.y };
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
    const s = GameState.save;
    if (hintLevel(s) < 1) return;
    for (const m of this.materialsHere()) {
      const tile = this.findSpotTile(m.spot);
      if (!tile) continue;
      const dot = this.add.circle(this.originX + (tile.x + 0.5) * TILE, this.originY + (tile.y + 0.5) * TILE, 3, 0xfff6d0, 0.8);
      this.roomLayer.add(dot);
      this.tweens.add({ targets: dot, alpha: 0.1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
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

  private findSpotTile(spot: string): { x: number; y: number } | undefined {
    const entry = Object.entries(this.room.objects).find(([, o]) => o.spot === spot);
    if (!entry) return undefined;
    for (let y = 0; y < this.room.map.length; y++) {
      const x = this.room.map[y].indexOf(entry[0]);
      if (x >= 0) return { x, y };
    }
    return undefined;
  }

  // ------------------------------------------------------------ 格子

  protected charAt(x: number, y: number): string {
    return this.room.map[y]?.[x] ?? ' ';
  }

  protected worldToTile(wx: number, wy: number): { x: number; y: number } {
    return { x: Math.floor((wx - this.originX) / TILE), y: Math.floor((wy - this.originY) / TILE) };
  }

  private isSolid(ch: string): boolean {
    if (ch === ' ' || ch === '#') return true;
    if (ch === '.' || /[0-9]/.test(ch)) return false;
    const obj = this.room.objects[ch];
    return obj ? obj.solid !== false : true;
  }

  private blocked(cx: number, cy: number): boolean {
    const x0 = cx - BODY_W / 2;
    const x1 = cx + BODY_W / 2 - 1;
    const y0 = cy - BODY_H;
    const y1 = cy - 1;
    for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const t = this.worldToTile(px, py);
      if (this.isSolid(this.charAt(t.x, t.y))) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ 玩家

  private buildPlayer(): Phaser.GameObjects.Container {
    // 占位：真冬的色块。之后换成行走图
    const body = this.add.rectangle(0, -14, 24, 28, 0x5c4f7c);
    const head = this.add.circle(0, -34, 10, 0xd9cfe8);
    const hair = this.add.rectangle(0, -40, 22, 8, 0x6b5a96);
    const eye = this.add.triangle(0, 0, 0, 0, 8, 0, 4, 6, 0xffffff).setName('facing');
    return this.add.container(0, 0, [body, head, hair, eye]).setDepth(100);
  }

  protected syncPlayer(): void {
    this.player.setPosition(Math.round(this.pos.x), Math.round(this.pos.y));
    const eye = this.player.getByName('facing') as Phaser.GameObjects.Triangle;
    const v = DIR_VEC[this.facing];
    eye.setPosition(v.x * 16 - 4, -14 + v.y * 18).setAngle(this.facing === 'up' ? 180 : this.facing === 'left' ? 90 : this.facing === 'right' ? -90 : 0);
  }

  update(time: number, delta: number): void {
    this.cameraFx(time);
    const dt = delta / 1000;
    const canMove = !this.locked && !this.transitioning && !this.ui.isBlocking();
    let moving = false;
    let running = false;

    if (canMove) {
      const k = this.keys;
      let dx = 0;
      let dy = 0;
      if (k.LEFT.isDown || k.A.isDown) dx -= 1;
      if (k.RIGHT.isDown || k.D.isDown) dx += 1;
      if (k.UP.isDown || k.W.isDown) dy -= 1;
      if (k.DOWN.isDown || k.S.isDown) dy += 1;
      if (dx || dy) {
        moving = true;
        if (Math.abs(dx) >= Math.abs(dy) && dx) this.facing = dx < 0 ? 'left' : 'right';
        else if (dy) this.facing = dy < 0 ? 'up' : 'down';
        running = k.SHIFT.isDown && this.stamina > 0;
        const speed = this.moveSpeed(running);
        const len = Math.hypot(dx, dy);
        const mx = (dx / len) * speed * dt;
        const my = (dy / len) * speed * dt;
        if (!this.blocked(this.pos.x + mx, this.pos.y)) this.pos.x += mx;
        if (!this.blocked(this.pos.x, this.pos.y + my)) this.pos.y += my;
        this.syncPlayer();
        this.checkExit();
      }
    }

    this.stamina = Phaser.Math.Clamp(
      this.stamina + (running ? -MOVE.staminaDrain : MOVE.staminaRegen) * dt,
      0,
      MOVE.staminaMax,
    );
    this.drawStamina();
    this.updateGhost(delta, moving);
    this.onUpdate(time, delta);
  }

  protected moveSpeed(running: boolean): number {
    return running ? MOVE.runSpeed : MOVE.walkSpeed;
  }

  private checkExit(): void {
    const t = this.worldToTile(this.pos.x, this.pos.y - BODY_H / 2);
    const ch = this.charAt(t.x, t.y);
    const exit = this.room.exits[ch];
    if (exit && !this.transitioning) this.changeRoom(exit.to, exit.arriveAt);
  }

  private drawStamina(): void {
    this.staminaBar.clear();
    if (this.stamina >= MOVE.staminaMax || GameState.isFinal) return;
    this.staminaBar.fillStyle(0x000000, 0.5).fillRect(28, 50, 120, 4);
    this.staminaBar.fillStyle(0x8a8a8a, 0.9).fillRect(28, 50, (120 * this.stamina) / MOVE.staminaMax, 4);
  }

  /** 精神值档位 3 起，移动时留下残影 */
  private updateGhost(delta: number, moving: boolean): void {
    if (GameState.isFinal || !moving || sanityTier(GameState.save.sanity) < 3) return;
    this.ghostTimer -= delta;
    if (this.ghostTimer > 0) return;
    this.ghostTimer = sanityTier(GameState.save.sanity) === 4 ? 70 : 130;
    const ghost = this.add.rectangle(this.player.x, this.player.y - 24, 24, 48, 0x5c4f7c, 0.35).setDepth(99);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 450, onComplete: () => ghost.destroy() });
  }
}
