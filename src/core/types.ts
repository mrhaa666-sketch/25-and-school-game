export type ThemeId = 1 | 2 | 3 | 4;
export type CycleId = ThemeId | 'final';

export const THEMES: readonly ThemeId[] = [1, 2, 3, 4];

/** 一局游戏的进度（交接文档 2.6）。 */
export interface SaveData {
  version: 1;
  /** 当前主题 1~4，终周目为 'final' */
  cycle: CycleId;
  act: number;
  sanity: number;
  materials: string[];
  /** 本周目是否交过白卷（影响屏幕文字） */
  blankPaperThisCycle: boolean;
  /** 显示用的周目计数（第几周目）。1~4 是常规周目，≥5 是补充周目 */
  cycleCount: number;
  /** 当前补充周目之后还要补的主题，按顺序进行 */
  pendingThemes: ThemeId[];
  /** 各主题被补充的次数（决定提示强度） */
  replayCount: Record<ThemeId, number>;
  mirrorSeenThisCycle: boolean;
  /** 本周目打过几次电话（第一次不扣精神值） */
  phoneCallsThisCycle: number;
}

/**
 * 跨存档保留的数据。结局图鉴放在这里，这样「新游戏」不会清空已解锁的结局。
 */
export interface MetaData {
  version: 1;
  endingsUnlocked: number[];
  trueEndingCleared: boolean;
}

export interface MaterialDef {
  id: string;
  theme: ThemeId;
  slot: 0 | 1 | 2;
  name: string;
  room: string;
  spot: string;
  locationHint: string;
  /** 补充周目不在背包里显示地点文字（「白卷」只靠考场的挂钟提示） */
  noTextHint?: boolean;
  desc: string;
}

export interface MonsterDef {
  id: string;
  name: string;
  color: string;
  ai: string;
}

export interface CycleDef {
  theme: ThemeId;
  key: string;
  themeName: string;
  startRoom: string;
  playOpening: boolean;
  environment: { desc: string; floorColor: string; wallColor: string; lightTint: string };
  monsterA: MonsterDef;
  monsterB: MonsterDef;
  scenes: { floor3: string; floor2: string; musicRoom: string };
  exam: { question: string; options: string[] };
  limitedRooms: string[];
}

export interface EndingDef {
  id: number;
  type: string;
  act: number;
  title: string;
  summary: string;
}
