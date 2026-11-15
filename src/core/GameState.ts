/**
 * 运行时的全局状态：当前存档 + 跨存档数据 + 事件总线。
 * 场景和 UI 只通过这里读写进度，保证存档、HUD、滤镜看到的是同一份数据。
 */
import Phaser from 'phaser';
import cycle1 from '../data/cycles/1.json';
import cycle2 from '../data/cycles/2.json';
import cycle3 from '../data/cycles/3.json';
import cycle4 from '../data/cycles/4.json';
import endingsJson from '../data/endings.json';
import { STORAGE_KEYS } from './constants';
import * as P from './progress';
import { getStorage } from './storage';
import type { CycleDef, EndingDef, MetaData, SaveData, ThemeId } from './types';

export const CYCLES: Record<ThemeId, CycleDef> = {
  1: cycle1 as CycleDef,
  2: cycle2 as CycleDef,
  3: cycle3 as CycleDef,
  4: cycle4 as CycleDef,
};

export const ENDINGS = endingsJson as EndingDef[];

export interface SanityChange {
  value: number;
  delta: number;
  reason?: string;
}

/** 事件名 */
export const EV = {
  sanity: 'sanity-changed',
  material: 'material-added',
  state: 'state-replaced',
  ending: 'ending-unlocked',
  checkpoint: 'checkpoint-saved',
} as const;

function defaultMeta(): MetaData {
  return { version: 1, endingsUnlocked: [], trueEndingCleared: false };
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

class GameStateImpl {
  readonly events = new Phaser.Events.EventEmitter();
  private _save: SaveData = P.createNewSave();
  private _meta: MetaData = defaultMeta();

  constructor() {
    this._meta = { ...defaultMeta(), ...(parse<MetaData>(getStorage().read(STORAGE_KEYS.meta)) ?? {}) };
  }

  get save(): Readonly<SaveData> {
    return this._save;
  }

  get meta(): Readonly<MetaData> {
    return this._meta;
  }

  /** 当前周目的配置。终周目没有主题，沿用一周目的场景布局。 */
  get cycleDef(): CycleDef {
    return CYCLES[this._save.cycle === 'final' ? 1 : this._save.cycle];
  }

  get isFinal(): boolean {
    return P.isFinalCycle(this._save);
  }

  // ------------------------------------------------------------ 存读档

  hasSave(): boolean {
    return getStorage().read(STORAGE_KEYS.save) !== null;
  }

  peekSave(): SaveData | null {
    return parse<SaveData>(getStorage().read(STORAGE_KEYS.save));
  }

  newGame(): void {
    this.replace(P.createNewSave());
    this.persist();
  }

  loadGame(): boolean {
    const data = this.peekSave();
    if (!data) return false;
    this.replace({ ...P.createNewSave(), ...data });
    return true;
  }

  /** 真结局之后：删除存档（跨存档数据保留） */
  clearSave(): void {
    getStorage().remove(STORAGE_KEYS.save);
    this.replace(P.createNewSave());
  }

  /**
   * 存档点：每一幕开始时记下当时的存档。死亡结局之后从这里重新开始，
   * 拿到的材料不会丢（材料跨死亡保留）。
   */
  /** 最近一次存档的时间（界面据此显示「已存档」） */
  lastCheckpointAt = 0;

  checkpoint(): void {
    getStorage().write(STORAGE_KEYS.checkpoint, JSON.stringify(this._save));
    this.lastCheckpointAt = Date.now();
    this.events.emit(EV.checkpoint);
  }

  /** 回到最近的存档点（同一个周目里）。没有可用的存档点返回 false */
  restoreCheckpoint(): boolean {
    const raw = getStorage().read(STORAGE_KEYS.checkpoint);
    if (!raw) return false;
    try {
      const cp = JSON.parse(raw) as SaveData;
      if (cp.cycle !== this._save.cycle || cp.cycleCount !== this._save.cycleCount) return false;
      const materials = [...new Set([...cp.materials, ...this._save.materials])];
      this.replace({ ...cp, materials });
      this.persist();
      return true;
    } catch {
      return false;
    }
  }

  persist(): void {
    const storage = getStorage();
    storage.write(STORAGE_KEYS.save, JSON.stringify(this._save));
    storage.write(STORAGE_KEYS.meta, JSON.stringify(this._meta));
  }

  /** 整体替换存档（周目切换、死亡重来）。 */
  replace(next: SaveData): void {
    this._save = next;
    this.events.emit(EV.state, this._save);
  }

  // ------------------------------------------------------------ 进度操作

  enterAct(act: number): void {
    const before = this._save.sanity;
    this._save = P.enterAct(this._save, act);
    const delta = this._save.sanity - before;
    if (delta !== 0) this.events.emit(EV.sanity, { value: this._save.sanity, delta, reason: 'act' } satisfies SanityChange);
    this.persist();
  }

  /** 扣除精神值。终周目不生效。 */
  deductSanity(amount: number, reason?: string): void {
    if (this.isFinal || amount <= 0) return;
    const before = this._save.sanity;
    const value = P.clampSanity(before - amount);
    this._save = { ...this._save, sanity: value };
    this.events.emit(EV.sanity, { value, delta: value - before, reason } satisfies SanityChange);
    this.persist();
  }

  /** 仅供调试面板使用：直接设置精神值 */
  debugSetSanity(value: number): void {
    const before = this._save.sanity;
    this._save = { ...this._save, sanity: P.clampSanity(value) };
    this.events.emit(EV.sanity, { value: this._save.sanity, delta: this._save.sanity - before, reason: 'debug' } satisfies SanityChange);
  }

  hasMaterial(id: string): boolean {
    return this._save.materials.includes(id);
  }

  addMaterial(id: string): void {
    if (this.hasMaterial(id)) return;
    this._save = { ...this._save, materials: [...this._save.materials, id] };
    this.events.emit(EV.material, id);
    this.persist(); // 材料跨死亡保留，拿到就立刻写盘
  }

  patch(partial: Partial<SaveData>): void {
    this._save = { ...this._save, ...partial };
  }

  unlockEnding(id: number): void {
    if (!this._meta.endingsUnlocked.includes(id)) {
      this._meta = {
        ...this._meta,
        endingsUnlocked: [...this._meta.endingsUnlocked, id].sort((a, b) => a - b),
      };
      this.events.emit(EV.ending, id);
    }
    if (id === 10) this._meta = { ...this._meta, trueEndingCleared: true };
    this.persist();
  }
}

export const GameState = new GameStateImpl();
