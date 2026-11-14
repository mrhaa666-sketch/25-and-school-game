/**
 * 全局常量与可调数值。
 * 标注「待确认」的数值来自交接文档的建议值，作者确认后在这里改即可。
 */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE = 40; // 32 × 18 格正好铺满 1280 × 720

export const FONT_FAMILY =
  '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "WenQuanYi Zen Hei", sans-serif';

export const SANITY = {
  max: 100,
  perAct: 10, // 第二幕 ~ 第十幕，每进入一幕扣除
  pinkRoomThreshold: 25, // 待确认：进入粉色房间时 ≤ 该值 → 结局 6
} as const;

/** 精神值额外扣除（交接文档 2.1.1） */
export const SANITY_COST = {
  mirror: 5,
  phoneCall: 2,
  ropePulled: 3,
  floor3Scene: 5,
  floor3SceneLinger: 5,
  chase2Near: 1,
  examAnswer: 10,
  floor2Scene: 10,
  pipeCounting: 5,
  musicRoom: 5,
  plasterStare: 3,
  facelessPortrait: 2,
  pinkDoorVoice: 3,
  pinkDoorTry: 2,
  scoreCut: 5,
  metronomeLinger: 2,
} as const;

export const TIMERS = {
  knotKeys: 5,
  knotKeySec: 1.5, // 待确认
  climbSec: 8, // 待确认
  chase2Sec: 30, // 待确认
  examBlankPromptSec: 10,
  inviteRefuseSec: 3,
} as const;

export const MOVE = {
  walkSpeed: 150,
  runSpeed: 250,
  crawlSpeed: 55,
  staminaMax: 100, // 待确认：是否需要体力条
  staminaDrain: 30, // 每秒
  staminaRegen: 20, // 每秒
} as const;

/** 待确认：通讯录名字变乱码的顺序（建议 绘名 → 瑞希 → 奏） */
export const CONTACT_GARBLE_ORDER = ['ena', 'mizuki', 'kanade'] as const;

export const STORAGE_KEYS = {
  save: '25-and-school/save',
  meta: '25-and-school/meta',
} as const;
