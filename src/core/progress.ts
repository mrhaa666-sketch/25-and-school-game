/**
 * 周目、材料、精神值的纯逻辑。不依赖 Phaser，便于单元测试。
 * 所有修改都返回新对象，不改动传入的 state。
 */
import materialsJson from '../data/materials.json';
import { CONTACT_GARBLE_ORDER, SANITY } from './constants';
import { THEMES, type MaterialDef, type SaveData, type ThemeId } from './types';

export const MATERIALS = materialsJson as MaterialDef[];

export function materialsOfTheme(theme: ThemeId): MaterialDef[] {
  return MATERIALS.filter((m) => m.theme === theme).sort((a, b) => a.slot - b.slot);
}

export function getMaterial(id: string): MaterialDef | undefined {
  return MATERIALS.find((m) => m.id === id);
}

// ---------------------------------------------------------------- 新存档

export function createNewSave(): SaveData {
  return {
    version: 1,
    cycle: 1,
    act: 1,
    sanity: SANITY.max,
    materials: [],
    blankPaperThisCycle: false,
    cycleCount: 1,
    pendingThemes: [],
    replayCount: { 1: 0, 2: 0, 3: 0, 4: 0 },
    mirrorSeenThisCycle: false,
    phoneCallsThisCycle: 0,
  };
}

// ---------------------------------------------------------------- 周目判定

export function isFinalCycle(s: SaveData): boolean {
  return s.cycle === 'final';
}

/** 第五周目及以后、且不是终周目 */
export function isSupplementary(s: SaveData): boolean {
  return s.cycle !== 'final' && s.cycleCount > 4;
}

/** 当前周目的起始幕：只有第一周目播放第一幕 */
export function startActOf(s: SaveData): number {
  return s.cycleCount === 1 && s.cycle === 1 ? 1 : 2;
}

// ---------------------------------------------------------------- 材料进度

/** 某主题 3 份材料是否到手，按固定顺序 */
export function themeStars(materials: readonly string[], theme: ThemeId): boolean[] {
  return materialsOfTheme(theme).map((m) => materials.includes(m.id));
}

export function starString(stars: readonly boolean[]): string {
  return stars.map((x) => (x ? '⭐' : '？')).join('');
}

export function isThemeComplete(materials: readonly string[], theme: ThemeId): boolean {
  return themeStars(materials, theme).every(Boolean);
}

export function allMaterialsCollected(materials: readonly string[]): boolean {
  return THEMES.every((t) => isThemeComplete(materials, t));
}

export function incompleteThemes(materials: readonly string[]): ThemeId[] {
  return THEMES.filter((t) => !isThemeComplete(materials, t));
}

/**
 * 补充周目的提示强度：0 = 不是补充周目，1/2/3 = 同一主题第几次补（3 表示 3 次及以后）。
 */
export function hintLevel(s: SaveData): 0 | 1 | 2 | 3 {
  if (!isSupplementary(s) || s.cycle === 'final') return 0;
  const n = s.replayCount[s.cycle];
  return (n >= 3 ? 3 : n <= 0 ? 0 : n) as 0 | 1 | 2 | 3;
}

/**
 * 补充周目里需要提示的房间：当前主题还没拿到的材料所在的房间。
 * 不是补充周目（或终周目）时为空。
 */
export function hintRooms(s: SaveData): Set<string> {
  if (hintLevel(s) < 1 || s.cycle === 'final') return new Set();
  const theme = s.cycle;
  return new Set(MATERIALS.filter((m) => m.theme === theme && !s.materials.includes(m.id)).map((m) => m.room));
}

// ---------------------------------------------------------------- 精神值

export type SanityTier = 1 | 2 | 3 | 4;

export function sanityTier(value: number): SanityTier {
  if (value >= 76) return 1;
  if (value >= 51) return 2;
  if (value >= 26) return 3;
  return 4;
}

export function clampSanity(value: number): number {
  return Math.max(0, Math.min(SANITY.max, value));
}

/** 进入新的一幕。第二幕起每幕 -10，终周目不扣。 */
export function enterAct(s: SaveData, act: number): SaveData {
  const next = { ...s, act };
  if (act >= 2 && !isFinalCycle(s)) next.sanity = clampSanity(s.sanity - SANITY.perAct);
  return next;
}

// ---------------------------------------------------------------- 通讯录

/** 当前有几个名字是乱码 */
export function garbledContactCount(s: SaveData): number {
  if (s.cycle === 'final' || s.cycleCount > 4) return CONTACT_GARBLE_ORDER.length;
  return Math.min(CONTACT_GARBLE_ORDER.length, s.cycleCount - 1);
}

export function isContactGarbled(s: SaveData, contactId: string): boolean {
  const idx = (CONTACT_GARBLE_ORDER as readonly string[]).indexOf(contactId);
  return idx >= 0 && idx < garbledContactCount(s);
}

// ---------------------------------------------------------------- 第十幕 · 大门

export type GateOutcome =
  /** 进入下一个主题周目（含补充周目之间的衔接），过渡台词「还没有结束」 */
  | { kind: 'next'; theme: ThemeId }
  /** 进入终周目，过渡台词「最后一次了」 */
  | { kind: 'final' }
  /** 材料不全 → 结局 9 → 补充周目 */
  | { kind: 'ending9' };

/** 推开大门时的判定（交接文档 第十幕表格） */
export function resolveGate(s: SaveData): GateOutcome {
  if (s.cycle === 'final') throw new Error('终周目没有第十幕判定');
  // 一~三周目：无条件进入下一周目
  if (s.cycleCount <= 3) return { kind: 'next', theme: (s.cycle + 1) as ThemeId };
  // 补充周目之间：还有待补的主题就依次继续
  if (isSupplementary(s) && s.pendingThemes.length > 0) {
    return { kind: 'next', theme: s.pendingThemes[0] };
  }
  // 四周目 / 最后一个补充周目：判定 12 份材料
  return allMaterialsCollected(s.materials) ? { kind: 'final' } : { kind: 'ending9' };
}

/** 重置「本周目」相关的状态 */
function resetRun(s: SaveData): SaveData {
  return {
    ...s,
    sanity: SANITY.max,
    blankPaperThisCycle: false,
    mirrorSeenThisCycle: false,
    phoneCallsThisCycle: 0,
  };
}

/** 根据大门判定，生成下一周目开头的存档。ending9 时返回补充周目的开头。 */
export function applyGate(s: SaveData, outcome: GateOutcome): SaveData {
  const base = resetRun({ ...s, cycleCount: s.cycleCount + 1, act: 2 });
  switch (outcome.kind) {
    case 'next': {
      if (isSupplementary(s)) {
        const [theme, ...rest] = s.pendingThemes;
        return {
          ...base,
          cycle: theme,
          pendingThemes: rest,
          replayCount: { ...s.replayCount, [theme]: s.replayCount[theme] + 1 },
        };
      }
      return { ...base, cycle: outcome.theme };
    }
    case 'final':
      return { ...base, cycle: 'final', pendingThemes: [] };
    case 'ending9': {
      const [theme, ...rest] = incompleteThemes(s.materials);
      return {
        ...base,
        cycle: theme,
        pendingThemes: rest,
        replayCount: { ...s.replayCount, [theme]: s.replayCount[theme] + 1 },
      };
    }
  }
}

/** 死亡（结局 1~8）后回到当前周目开头。材料保留。 */
export function restartCycle(s: SaveData): SaveData {
  return resetRun({ ...s, act: startActOf(s) });
}
