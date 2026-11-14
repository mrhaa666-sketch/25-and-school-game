/**
 * 房间定义（代码内定义格子，交接文档 1 节的方案二）。
 *
 * 地图字符：
 *   ' ' 虚空（不可走，不绘制）
 *   '#' 墙
 *   '.' 地板
 *   '0'~'9' 出口：踩上去切换房间（见 exits），或交给场景的 onExit 处理
 *   其他字母：物件。同一个字母、相连的格子组成一个物件（见 objects）
 */
export interface RoomObject {
  /** 物件 id，场景脚本用它决定调查结果 */
  id: string;
  /** 占位色块颜色 */
  color: number;
  /** 是否挡路（默认挡） */
  solid?: boolean;
  /** 材料位置名。materials.json 里 room + spot 相同的材料会放在这里 */
  spot?: string;
  label?: string;
  /** 不画色块（由场景自己画，例如成员场景、门） */
  hidden?: boolean;
  /** 素材图（assets/sprites/objects/ 下的文件名）。没有图时画色块 */
  tex?: string;
  /** 挂在墙上 / 嵌在墙里的东西：宽度对齐物件，允许向上超出这一格（黑板、窗、门） */
  wall?: boolean;
  /** 想换成的新外观（贴图名）：有这张图就用它，没有就继续用 tex */
  look?: string;
  /** 个别物件的绘制微调（R7）：缩放倍数，x / y 偏移（格）。只影响画面，不影响碰撞 */
  fit?: { scale?: number; dx?: number; dy?: number };
}

export interface RoomExit {
  to: string;
  /** 进入目标房间时出现在哪个出口旁边 */
  arriveAt: string;
}

/** 房间里的固定光源（格坐标，可带小数） */
export interface RoomLight {
  /** sprites/lights/ 下的光效贴图名；不写用通用柔光 */
  tex?: string;
  x: number;
  y: number;
  /** 半径（格），默认 1.5 */
  scale?: number;
  /** 亮度 0~1，默认 0.6 */
  intensity?: number;
  /** 是否闪烁 */
  flicker?: boolean;
  /** 'lamp'：日光灯（N3）。地上一块灯光，头顶一根灯管 */
  kind?: 'lamp';
  /** 日光灯的状态：常亮 / 闪烁 / 坏掉 */
  state?: 'on' | 'flicker' | 'broken';
  /** 只在这些周目出现 */
  cycle?: (1 | 2 | 3 | 4 | 'final')[];
}

/** 装饰：不参与碰撞。地面贴花、墙面装饰、周目主题装饰 */
export interface RoomDecor {
  /** 贴图名（带前缀 'decal:' 时从 sprites/decals/ 找，否则从 sprites/objects/ 找） */
  tex: string;
  /** 格坐标，可带小数；贴墙的装饰 y 可以是负数（画在立面上） */
  x: number;
  y: number;
  /** 宽度（格），默认 1 */
  scale?: number;
  /** 旋转角度 */
  angle?: number;
  /** 透明度，默认 1 */
  alpha?: number;
  /** 只在这些周目出现 */
  cycle?: (1 | 2 | 3 | 4 | 'final')[];
  /** 贴在墙上（立面上） */
  wall?: boolean;
  /** 前景层（N4）：画在角色上方，带视差，角色走到下面时淡出 */
  fg?: boolean;
}

/**
 * 只有一句话的调查点（L3）：不扣精神、不给材料、不影响任何判定。
 * 文字在文本表 examine.<房间>.<名字> 里，还没写的时候调查了没有反应。
 */
export interface RoomExamine {
  /** 对应的物件字母；不写就用格坐标 */
  ch?: string;
  x?: number;
  y?: number;
  /** 文本键（examine.<房间>.<名字>） */
  key: string;
  cycle?: (1 | 2 | 3 | 4 | 'final')[];
}

/** 追逐走廊里的一个障碍：怪物在 startX～endX 之间先依次走绕行点（格坐标） */
export interface ChaseGate {
  startX: number;
  endX: number;
  wps: { x: number; y: number }[];
}

export interface RoomDef {
  id: string;
  map: string[];
  objects: Record<string, RoomObject>;
  exits: Record<string, RoomExit>;
  /** 玩家初始位置（格子坐标） */
  spawn?: { x: number; y: number };
  floorColor?: string;
  wallColor?: string;
  /** 地板 / 墙面贴图（assets/tiles/ 下的文件名）。不写就按周目选 */
  floorTex?: string;
  wallTex?: string;
  /** 终周目的变体房间：原本是哪个房间（材料位置、门的去向按原房间算） */
  alias?: string;
  /** 所在楼层（补充周目第 3 次提示：走到材料所在楼层时停下来看一眼） */
  floor?: number;
  /**
   * 门（出口数字或门物件的字母）通往哪个房间。用于补充周目的提示：
   * 材料所在房间的门口，灯闪得更频繁。
   */
  doors?: Record<string, string>;
  /** 固定光源。窗户类物件会自动在地上生成一块窗光，不用写在这里 */
  lights?: RoomLight[];
  /** 装饰列表（R6） */
  decor?: RoomDecor[];
  /** 一句话的调查点（L3） */
  examine?: RoomExamine[];
  /** 追逐走廊的障碍和绕行点（L2） */
  chaseGates?: ChaseGate[];
}

/** 走廊里的东西（L1）：只挡路，调查不到 */
const CORRIDOR_STUFF: Record<string, RoomObject> = {
  k: { id: 'sink_row', color: 0x5a5e60, tex: 'sink_row' },
  p: { id: 'pillar', color: 0x34322f, tex: 'pillar' },
  x: { id: 'desk_pile', color: 0x3e352c, tex: 'desk_pile' },
  l: { id: 'locker_fallen', color: 0x464a4e, tex: 'locker_fallen' },
  b: { id: 'bulletin_board', color: 0x4a4236, tex: 'bulletin_board', wall: true },
  f: { id: 'fire_box', color: 0x5a2a26, tex: 'fire_box', wall: true },
};

/** 教室门牌：挂在后墙上每扇门的右上方 */
const classSigns = (cols: number[]): RoomDecor[] => cols.map((c) => ({ tex: 'class_sign', x: c + 1.55, y: -0.95, scale: 0.7, wall: true, cycle: [1, 2, 3, 4, 'final'] }));

const DESK = { id: 'desk', color: 0x4a4038, label: '桌', tex: 'school_desk' };
const CLASS_DOOR = { id: 'class_door', color: 0x2c2620, label: '门', tex: 'class_door', wall: true };

/** 日光灯的状态，按顺序轮着来，常亮的多一些 */
const LAMP_STATES = ['on', 'flicker', 'on', 'broken', 'on', 'on', 'flicker'] as const;

/** 一排日光灯：y 行，从 x0 到 x1 每 step 格一盏。seed 让各个房间的状态排列不同 */
function lampRow(y: number, x0: number, x1: number, step: number, seed = 0): RoomLight[] {
  const out: RoomLight[] = [];
  let i = seed;
  for (let x = x0; x <= x1; x += step) out.push({ kind: 'lamp', x, y, state: LAMP_STATES[i++ % LAMP_STATES.length] });
  return out;
}

// ---------------------------------------------------------------- 程序生成的房间

/**
 * 三楼的追逐走廊（追逐战 2，L2）。
 *
 * 追逐战 2 是「坚持 30 秒」：时间到了前方才出现考场的门，所以长度只要保证 30 秒跑不到头。
 * 240 格（原来 300 格的 80%）；一直全速跑 30 秒也只有约 190 格。
 *
 * 走廊 5 格宽，分成 6 段，段与段之间轮流是：
 * - 桌椅堆：挡住 3 排，从 2 排宽的缺口绕过去
 * - 倒下的柜子：走廊整个堵死，从上方一间半开着的教室穿过去（同一张地图，不换房间）
 * - 窄口：两边墙往里收，只剩 2 格宽
 * 每个障碍记一组绕行点（chaseGates），怪物先走绕行点再追人。
 *
 * 行：0~4 是走廊上方（大部分是空的，只有绕行的教室），5 是走廊的上墙，6~10 走廊，11 下墙。
 */
function buildLongCorridor(): RoomDef {
  const W = 240;
  const H = 12;
  const TOP = 5; // 走廊上墙
  const BOT = 11; // 走廊下墙
  const g: string[][] = Array.from({ length: H }, () => Array(W).fill(' '));
  const set = (x: number, y: number, ch: string) => (g[y][x] = ch);
  for (let x = 0; x < W; x++) {
    set(x, TOP, '#');
    set(x, BOT, '#');
    for (let y = TOP + 1; y < BOT; y++) set(x, y, x === 0 || x === W - 1 ? '#' : '.');
  }
  const gates: ChaseGate[] = [];
  const kinds = ['pile', 'locker', 'narrow', 'pile', 'locker'] as const;
  const gateXs = [40, 78, 116, 154, 192];
  const doorFree = new Set<number>(); // 上墙上不能放教室门的列（绕行教室的门洞附近）
  kinds.forEach((kind, n) => {
    const gx = gateXs[n];
    if (kind === 'pile') {
      // 桌椅堆：轮流挡上面 3 排 / 下面 3 排
      const upper = n % 2 === 0;
      const rows = upper ? [6, 7, 8] : [8, 9, 10];
      const gap = upper ? 9.5 : 6.5; // 绕行点的行（换算成世界坐标时脚底再往下半格）
      for (const y of rows) for (const x of [gx, gx + 1]) set(x, y, 'x');
      gates.push({ startX: gx - 1, endX: gx + 3, wps: [{ x: gx - 1, y: gap }, { x: gx + 3, y: gap }] });
    } else if (kind === 'narrow') {
      // 窄口：上下各收进来，只剩中间 2 排
      for (let x = gx; x < gx + 4; x++) for (const y of [6, 7, 10]) set(x, y, '#');
      gates.push({ startX: gx - 1, endX: gx + 5, wps: [{ x: gx - 1, y: 8.5 }, { x: gx + 5, y: 8.5 }] });
    } else {
      // 倒下的柜子把走廊堵死；上方一间教室，两个门洞
      for (const y of [6, 7, 8, 9, 10]) for (const x of [gx, gx + 1]) set(x, y, 'l');
      const x0 = gx - 6;
      const x1 = gx + 7;
      for (let x = x0; x <= x1; x++) {
        set(x, 0, '#');
        for (let y = 1; y < TOP; y++) set(x, y, x === x0 || x === x1 ? '#' : '.');
      }
      // 教室里的课桌（留出中间一排走道）
      for (let x = x0 + 2; x <= x1 - 2; x += 2) set(x, 2, 'd');
      // 门洞：上墙开两格宽
      for (const x of [gx - 4, gx - 3, gx + 4, gx + 5]) set(x, TOP, '.');
      for (let x = x0 - 1; x <= x1 + 1; x++) doorFree.add(x);
      gates.push({
        startX: gx - 5,
        endX: gx + 6,
        wps: [{ x: gx - 3, y: 7 }, { x: gx - 3, y: 3.5 }, { x: gx + 5, y: 3.5 }, { x: gx + 5, y: 7 }],
      });
    }
    for (let x = gx - 2; x <= gx + 5; x++) doorFree.add(x);
  });
  // 上墙上的教室门：每 9 格一扇，避开障碍和绕行教室
  for (let x = 14; x < W - 4; x += 9) if (!doorFree.has(x)) set(x, TOP, 'c');
  set(6, TOP, '1'); // 从三楼教室出来的门
  set(3, BOT, 'B'); // 对面那扇门
  set(4, BOT, 'B');
  return {
    id: 'corridor3_long',
    floor: 3,
    map: g.map((r) => r.join('')),
    lights: lampRow(TOP + 3.5, 4, W - 4, 6, 1),
    objects: {
      c: CLASS_DOOR,
      B: { id: 'burst_door', color: 0x3a2a24, label: '门', tex: 'class_door', wall: true },
      x: CORRIDOR_STUFF.x,
      l: CORRIDOR_STUFF.l,
      d: DESK,
    },
    exits: {},
    chaseGates: gates,
  };
}

/** 管道：中途分成上下两条，上面没有声音，下面有人在数数 */
function buildPipe(): RoomDef {
  const W = 34;
  const H = 11;
  const grid: string[][] = Array.from({ length: H }, () => Array(W).fill(' '));
  const carve = (x: number, y: number, ch = '.') => (grid[y][x] = ch);
  for (let x = 1; x <= 20; x++) carve(x, 5); // 主管道
  for (let y = 2; y <= 8; y++) carve(20, y); // 岔口
  for (let x = 20; x <= 31; x++) carve(x, 2); // 上：没有声音
  for (let x = 20; x <= 31; x++) carve(x, 8); // 下：数数声
  carve(32, 2, '1');
  carve(32, 8, '2');
  // 包一圈墙
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== ' ') continue;
      const near = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => /[.12]/.test(grid[y + dy]?.[x + dx] ?? '')));
      if (near) grid[y][x] = '#';
    }
  return {
    id: 'pipe',
    map: grid.map((r) => r.join('')),
    objects: {},
    exits: {},
    spawn: { x: 1, y: 5 },
    floorColor: '#1a1a1c',
    wallColor: '#0b0b0c',
    floorTex: 'floor_pipe',
    wallTex: 'floor_pipe',
  };
}

export const ROOMS: Record<string, RoomDef> = {
  // ------------------------------------------------------------ 第一幕
  school_gate: {
    id: 'school_gate',
    map: [
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '################################',
    ],
    objects: {},
    exits: {},
    spawn: { x: 3, y: 3 },
  },

  // ------------------------------------------------------------ 第二幕
  infirmary: {
    id: 'infirmary',
    floor: 4,
    doors: { '1': 'corridor4' },
    decor: [
      { tex: 'decal:decal_stain_01', x: 12.5, y: 6.6, scale: 1.6, alpha: 0.8 },
      { tex: 'decal:decal_stain_03', x: 4.2, y: 7.4, scale: 1.1, alpha: 0.7 },
      { tex: 'decal:decal_glass_01', x: 15.3, y: 2.6, scale: 0.9 },
    ],
    examine: [
      { ch: 'i', key: 'examine.infirmary.iv_stand' },
      { x: 12, y: 6, key: 'examine.infirmary.stain' },
      { x: 15, y: 2, key: 'examine.infirmary.glass' },
    ],
    map: [
      '##########M#######',
      '#BB.i........KKK.#',
      '#BB..............#',
      '#................#',
      '#bb.....DD.......#',
      '#bb.....DD.......#',
      '#................#',
      '#................#',
      '########1#########',
    ],
    objects: {
      i: { id: 'iv_stand', color: 0x6a6e72, tex: 'iv_stand' },
      B: { id: 'bed', color: 0xb8b4aa, spot: 'bedhead', label: '病床', tex: 'bed' },
      b: { id: 'bed2', color: 0xa8a49a, label: '病床', tex: 'bed', look: 'curtain_bed' },
      M: { id: 'mirror', color: 0x6f7c86, label: '镜子', tex: 'mirror', wall: true },
      K: { id: 'cabinet', color: 0x58625a, spot: 'cabinet', label: '药柜', tex: 'medicine_cabinet' },
      D: { id: 'desk', color: 0x5a4a3a, label: '办公桌', tex: 'office_desk' },
    },
    exits: { '1': { to: 'corridor4', arriveAt: '1' } },
    spawn: { x: 3, y: 2 },
  },

  corridor4: {
    id: 'corridor4',
    floor: 4,
    doors: { '1': 'infirmary', '2': 'classroom4', '3': 'art_prep4', '4': 'locked_class4', '5': 'music_prep4' },
    lights: lampRow(3.5, 3, 27, 6, 0),
    map: [
      '##2#W##3#b#1##4#W#f#5###W#####SS',
      '#.............................SS',
      '#.............................SS',
      '#.............................SS',
      '#............xx................#',
      '#........p...xx.......ll...p...#',
      '####kkk#########################',
    ],
    objects: {
      ...CORRIDOR_STUFF,
      W: { id: 'corridor_window', color: 0x1e2a36, label: '窗', tex: 'window_night', wall: true },
      S: { id: 'stairs', color: 0x3a3a3a, label: '楼梯口', tex: 'stairs' },
    },
    decor: [
      ...classSigns([2, 7, 11, 14, 20]),
      // 瑞希周目：走廊里散落的缎带（取代画在墙和地板贴图里的）
      { tex: 'mizuki_ribbon_01', x: 6.2, y: -0.6, scale: 0.8, wall: true, cycle: [3] },
      { tex: 'mizuki_ribbon_02', x: 9.5, y: 2.6, scale: 0.7, angle: 20, cycle: [3] },
      { tex: 'mizuki_ribbon_03', x: 18.3, y: -0.4, scale: 0.8, wall: true, cycle: [3] },
      { tex: 'mizuki_ribbon_04', x: 22.6, y: 3.3, scale: 0.7, angle: -35, cycle: [3] },
      { tex: 'mizuki_ribbon_02', x: 27.4, y: 1.8, scale: 0.6, angle: 70, cycle: [3] },
      // 前景：从天花板垂下来的一根绳子；瑞希周目多一条垂下的缎带
      { tex: 'rope_hanging', x: 11.5, y: 1.2, scale: 0.5, fg: true, cycle: [1, 2, 3, 4] },
      { tex: 'mizuki_ribbon_01', x: 17.5, y: 0.8, scale: 0.7, angle: 90, fg: true, cycle: [3] },
    ],
    // 3/4/5 是只在对应周目能进的房间，由第二幕的场景判断能不能进
    exits: {
      '1': { to: 'infirmary', arriveAt: '1' },
      '3': { to: 'art_prep4', arriveAt: '1' },
      '4': { to: 'locked_class4', arriveAt: '1' },
      '5': { to: 'music_prep4', arriveAt: '1' },
    },
  },

  // ------------------------------------------------------------ 四楼的限定房间（M4）
  art_prep4: {
    id: 'art_prep4',
    floor: 4,
    doors: { '1': 'corridor4' },
    decor: [
      { tex: 'decal:decal_paper_01', x: 3.4, y: 2.5, scale: 0.8, angle: 15 },
      { tex: 'decal:decal_paper_02', x: 8.6, y: 4.4, scale: 0.7, angle: -30 },
      { tex: 'decal:decal_stain_02', x: 9.8, y: 3.4, scale: 1.0, alpha: 0.7 },
      { tex: 'ena_canvas_pile', x: 2.4, y: 3.9, scale: 1.4, cycle: [2] },
    ],
    examine: [
      { ch: 'P', key: 'examine.art_prep4.plaster_shelf' },
      { ch: 'S', key: 'examine.art_prep4.paint_sink' },
      { x: 3, y: 2, key: 'examine.art_prep4.paper' },
      { x: 2, y: 3, key: 'examine.art_prep4.canvas_pile', cycle: [2] },
    ],
    map: [
      '############',
      '#ee..ee..ee#',
      '#P.........#',
      '#....tt...S#',
      '#..........#',
      '#####1######',
    ],
    objects: {
      S: { id: 'paint_sink', color: 0x5a5e60, tex: 'paint_sink' },
      P: { id: 'plaster_shelf', color: 0x8a867e, tex: 'plaster_shelf' },
      e: { id: 'easel', color: 0x4a4440, tex: 'easel_portraits' },
      t: { id: 'prep_desk', color: 0x5a4a3a, spot: 'desk', tex: 'office_desk' },
    },
    exits: { '1': { to: 'corridor4', arriveAt: '3' } },
  },

  locked_class4: {
    id: 'locked_class4',
    floor: 4,
    doors: { '1': 'corridor4' },
    decor: [
      { tex: 'mizuki_mannequin', x: 10.5, y: 1.6, scale: 1.0, cycle: [3] },
      { tex: 'mizuki_ribbon_02', x: 3.5, y: 3.3, scale: 0.6, angle: 25, cycle: [3] },
      { tex: 'mizuki_ribbon_04', x: 8.2, y: 1.4, scale: 0.6, angle: -40, cycle: [3] },
      { tex: 'decal:decal_chalk_01', x: 6, y: 1.3, scale: 2.2, alpha: 0.6 },
    ],
    examine: [
      { x: 10, y: 1, key: 'examine.locked_class4.mannequin', cycle: [3] },
      { x: 6, y: 1, key: 'examine.locked_class4.chalk' },
    ],
    map: [
      '####KKKK####',
      '#..........#',
      '#.d.d..d.d.#',
      '#....tt....#',
      '#.d.d..d.d.#',
      '#####1######',
    ],
    objects: {
      K: { id: 'blackboard', color: 0x1f2a24, tex: 'blackboard', wall: true },
      d: DESK,
      t: { id: 'prep_desk', color: 0x5a4a3a, spot: 'desk', tex: 'school_desk' },
    },
    exits: { '1': { to: 'corridor4', arriveAt: '4' } },
  },

  music_prep4: {
    id: 'music_prep4',
    floor: 4,
    doors: { '1': 'corridor4' },
    decor: [
      { tex: 'decal:decal_score_01', x: 3.2, y: 2.6, scale: 0.8, angle: 10, cycle: [4] },
      { tex: 'decal:decal_score_02', x: 8.5, y: 4.3, scale: 0.8, angle: -25, cycle: [4] },
      { tex: 'decal:decal_score_03', x: 6.8, y: 2.3, scale: 0.7, angle: 40, cycle: [4] },
      { tex: 'kanade_cup_stack', x: 9.6, y: 4.1, scale: 0.9, cycle: [4] },
      { tex: 'decal:decal_stain_04', x: 2.6, y: 4.3, scale: 1.0, alpha: 0.6 },
    ],
    examine: [
      { ch: 'm', key: 'examine.music_prep4.music_stand' },
      { x: 9, y: 4, key: 'examine.music_prep4.cup_stack', cycle: [4] },
      { x: 3, y: 2, key: 'examine.music_prep4.score', cycle: [4] },
    ],
    map: [
      '############',
      '#ll.m..m.ll#',
      '#..........#',
      '#....tt....#',
      '#..........#',
      '#####1######',
    ],
    objects: {
      m: { id: 'music_stand', color: 0x2e2e32, tex: 'music_stand' },
      l: { id: 'shelf', color: 0x4a4440, tex: 'locker' },
      t: { id: 'prep_desk', color: 0x5a4a3a, spot: 'desk', tex: 'office_desk' },
    },
    exits: { '1': { to: 'corridor4', arriveAt: '5' } },
  },

  // ------------------------------------------------------------ 第三幕
  classroom4: {
    id: 'classroom4',
    floor: 4,
    lights: [...lampRow(4, 4, 14, 5, 3)],
    decor: [
      { tex: 'decal:decal_chalk_01', x: 10, y: 1.6, scale: 2.4, alpha: 0.6 },
      { tex: 'mafuyu_award_wall', x: 3.5, y: -0.9, scale: 2.2, wall: true, cycle: [1] },
      { tex: 'decal:decal_test_01', x: 6.4, y: 6.4, scale: 0.8, angle: 12, cycle: [1] },
      { tex: 'decal:decal_test_02', x: 11.6, y: 8.5, scale: 0.8, angle: -20, cycle: [1] },
      { tex: 'decal:decal_paper_03', x: 15.5, y: 7.6, scale: 0.7, angle: 30 },
    ],
    examine: [
      { x: 3, y: 1, key: 'examine.classroom4.award_wall', cycle: [1] },
      { x: 6, y: 6, key: 'examine.classroom4.test', cycle: [1] },
      { x: 10, y: 1, key: 'examine.classroom4.chalk' },
    ],
    map: [
      '########KKKK######',
      '#.......LL.......#',
      '#................W',
      '#.d.d.d.d.d.d....W',
      '#.............rr.W',
      '#.d.d.d.d.d.d.rr.#',
      '#................#',
      '#.d.d.d.d.d.d....#',
      '#................#',
      'D................#',
      '##################',
    ],
    objects: {
      K: { id: 'blackboard', color: 0x1f2a24, label: '黑板', tex: 'blackboard', wall: true },
      L: { id: 'lectern', color: 0x5a4a3a, spot: 'lectern_drawer', label: '讲台', tex: 'lectern' },
      W: { id: 'window', color: 0x1e2a36, label: '窗', tex: 'window_night', wall: true },
      r: { id: 'ropes', color: 0x6a604e, label: '绳子', tex: 'ropes' },
      d: DESK,
      D: { id: 'door', color: 0x2c2620, label: '门', tex: 'class_door', wall: true },
    },
    exits: {},
    spawn: { x: 1, y: 8 },
  },

  // ------------------------------------------------------------ 第四幕
  classroom3: {
    id: 'classroom3',
    floor: 3,
    doors: { '1': 'corridor3_long' },
    lights: [...lampRow(4.5, 4, 14, 5, 4)],
    decor: [
      { tex: 'decal:decal_chalk_01', x: 8, y: 1.6, scale: 2.4, alpha: 0.6 },
      { tex: 'mafuyu_award_wall', x: 13.5, y: -0.9, scale: 2.2, wall: true, cycle: [1] },
      { tex: 'decal:decal_test_01', x: 10.4, y: 6.5, scale: 0.8, angle: -15, cycle: [1] },
      { tex: 'decal:decal_footprint_01', x: 14.5, y: 4.5, scale: 1.2, alpha: 0.5 },
    ],
    examine: [
      { x: 13, y: 1, key: 'examine.classroom3.award_wall', cycle: [1] },
      { x: 10, y: 6, key: 'examine.classroom3.test', cycle: [1] },
      { x: 14, y: 4, key: 'examine.classroom3.footprint' },
    ],
    map: [
      '######KKKK########',
      '#.......LL.......#',
      'W................#',
      'W..d.d.....d.d...#',
      'W.......EE.......#',
      '#..d.d.....d.d...#',
      '#................#',
      '#..d.d.d.d.d.d...#',
      '#..............oo#',
      '##############1###',
    ],
    objects: {
      o: { id: 'locker3', color: 0x4a4e52, spot: 'locker', tex: 'locker' },
      K: { id: 'blackboard', color: 0x1f2a24, label: '黑板', tex: 'blackboard', wall: true },
      L: { id: 'lectern', color: 0x5a4a3a, label: '讲台', tex: 'lectern' },
      W: { id: 'window', color: 0x1e2a36, spot: 'window', label: '窗', tex: 'window_night', wall: true },
      E: { id: 'member_scene', color: 0x000000, hidden: true },
      d: DESK,
    },
    exits: {},
    spawn: { x: 1, y: 3 },
  },

  corridor3_long: buildLongCorridor(),

  // ------------------------------------------------------------ 第五幕
  exam_room: {
    id: 'exam_room',
    floor: 3,
    doors: { '1': 'stairs2' },
    lights: [...lampRow(4.5, 3, 13, 5, 5)],
    decor: [
      { tex: 'decal:decal_chalk_01', x: 8, y: 1.5, scale: 2.6, alpha: 0.6 },
      { tex: 'mafuyu_award_wall', x: 2.6, y: -0.9, scale: 2.0, wall: true, cycle: [1] },
      { tex: 'decal:decal_test_02', x: 14.2, y: 6.4, scale: 0.8, angle: 25, cycle: [1] },
      { tex: 'decal:decal_paper_01', x: 3.5, y: 8.4, scale: 0.7, angle: -10 },
    ],
    examine: [
      { x: 2, y: 1, key: 'examine.exam_room.award_wall', cycle: [1] },
      { x: 14, y: 6, key: 'examine.exam_room.test', cycle: [1] },
      { x: 3, y: 8, key: 'examine.exam_room.paper' },
    ],
    map: [
      '#####KKKKKK##C##',
      '#.......T......#',
      '#..............#',
      '#.d.d.d.d.d.d..#',
      '#..............#',
      '#.d.d.d.X.d.d..#',
      '#..............#',
      '#.d.d.d.d.d.d..#',
      '#..............#',
      '########1#######',
    ],
    objects: {
      K: { id: 'blackboard', color: 0x1f2a24, label: '黑板', tex: 'blackboard', wall: true },
      C: { id: 'clock', color: 0x7a7468, tex: 'wall_clock', wall: true },
      T: { id: 'lectern', color: 0x5a4a3a, tex: 'lectern' },
      d: { id: 'exam_desk', color: 0x4a4038, tex: 'school_desk_paper' },
      X: { id: 'own_desk', color: 0x4a4038, tex: 'school_desk_paper' },
    },
    exits: {},
    spawn: { x: 8, y: 8 },
  },

  // ------------------------------------------------------------ 第六幕
  stairs2: {
    id: 'stairs2',
    floor: 2,
    doors: { '1': 'corridor2' },
    decor: [
      { tex: 'decal:decal_crack_01', x: 6, y: 2.4, scale: 2.2 },
      { tex: 'decal:decal_crack_02', x: 2.4, y: 1.4, scale: 1.4, angle: 60 },
    ],
    examine: [{ x: 6, y: 2, key: 'examine.stairs2.crack' }],
    map: [
      '####II####',
      '#........#',
      '#........#',
      '#..f.....#',
      '#........1',
      '##########',
    ],
    objects: {
      I: { id: 'iron_door', color: 0x4a4e52, label: '铁门', tex: 'iron_door', wall: true },
      f: { id: 'steps', color: 0x34322e, spot: 'floor', hidden: true, solid: false },
    },
    exits: { '1': { to: 'corridor2', arriveAt: '1' } },
    spawn: { x: 4, y: 1 },
  },

  corridor2: {
    id: 'corridor2',
    floor: 2,
    doors: { '1': 'stairs2', T: 'pink_room2', P: 'pink_room2' },
    decor: [
      ...classSigns([5, 12, 19, 27]),
      { tex: 'mizuki_ribbon_03', x: 3.4, y: -0.5, scale: 0.8, wall: true, cycle: [3] },
      { tex: 'mizuki_ribbon_01', x: 8.6, y: 2.4, scale: 0.7, angle: -15, cycle: [3] },
      { tex: 'mizuki_ribbon_04', x: 15.2, y: -0.6, scale: 0.8, wall: true, cycle: [3] },
      { tex: 'mizuki_ribbon_02', x: 21.5, y: 3.2, scale: 0.7, angle: 40, cycle: [3] },
      { tex: 'mizuki_ribbon_03', x: 25.8, y: 1.5, scale: 0.6, angle: -60, cycle: [3] },
      { tex: 'rope_hanging', x: 16.5, y: 1.2, scale: 0.5, fg: true, cycle: [1, 2, 3, 4] },
      { tex: 'mizuki_ribbon_04', x: 9.5, y: 0.8, scale: 0.7, angle: 90, fg: true, cycle: [3] },
    ],
    lights: lampRow(3.5, 3, 29, 6, 2),
    map: [
      '#####c###b##c###f##c#######c####',
      '#..............................#',
      '1..............................T',
      '#.............................n#',
      '#......................xx......#',
      '#..p....ll......p......xx......#',
      '############kkk#################',
    ],
    objects: {
      ...CORRIDOR_STUFF,
      c: CLASS_DOOR,
      n: { id: 'corridor_end', color: 0x2a2a2a, spot: 'corridor_end', hidden: true, solid: false },
      T: { id: 'stairs_down', color: 0x3a3a3a, tex: 'stairs', wall: true },
    },
    exits: { '1': { to: 'stairs2', arriveAt: '1' } },
  },

  pink_room2: {
    id: 'pink_room2',
    floor: 2,
    map: [
      '############',
      '#.tt.......#',
      '#......RR..#',
      '#..........O',
      '#..........#',
      '#####1######',
    ],
    objects: {
      t: { id: 'table', color: 0x6a5048, spot: 'table', label: '桌子', tex: 'office_desk' },
      R: { id: 'member_scene', color: 0x000000, hidden: true },
      O: { id: 'pipe', color: 0x2a2a2e, label: '', tex: 'pipe_entrance', wall: true },
    },
    exits: {},
    floorColor: '#3a2a32',
    wallColor: '#2a1820',
    floorTex: 'floor_pink_room',
  },

  // ------------------------------------------------------------ 第七幕
  pipe: buildPipe(),

  // ------------------------------------------------------------ 第八、九幕
  music_room: {
    id: 'music_room',
    floor: 1,
    // 钢琴上方一块灯光
    lights: [...lampRow(4.5, 5, 13, 8, 1), { x: 7, y: 2.6, scale: 2.6, intensity: 0.55 }],
    decor: [
      { tex: 'decal:decal_score_04', x: 4.5, y: 4.5, scale: 0.8, angle: -30 },
      { tex: 'decal:decal_score_01', x: 12.3, y: 6.4, scale: 0.7, angle: 15 },
    ],
    examine: [
      { ch: 'M', key: 'examine.music_room.metronome' },
      { ch: 'm', key: 'examine.music_room.music_stand' },
      { x: 4, y: 4, key: 'examine.music_room.score' },
    ],
    map: [
      '##################',
      '#....PPPP..M.....#',
      '#....PPPPk.......#',
      '#............m.m.#',
      '#................#',
      '#..s.s.s.s.s.....#',
      '#................#',
      'v................#',
      '##################',
    ],
    objects: {
      M: { id: 'metronome', color: 0x3a3028, tex: 'metronome' },
      m: { id: 'music_stand', color: 0x2e2e32, tex: 'music_stand' },
      P: { id: 'piano', color: 0x101012, label: '钢琴', tex: 'grand_piano' },
      k: { id: 'kanade', color: 0x000000, hidden: true },
      s: { id: 'chair', color: 0x3a3430, tex: 'chair' },
      v: { id: 'vent', color: 0x2a2a2e, tex: 'pipe_entrance', wall: true },
    },
    exits: {},
    spawn: { x: 1, y: 6 },
  },

  // ------------------------------------------------------------ 第十幕
  lobby: {
    id: 'lobby',
    floor: 1,
    decor: [
      { tex: 'shoes_pair', x: 9.4, y: 5.4, scale: 0.7 },
      { tex: 'decal:decal_footprint_01', x: 8, y: 4.4, scale: 1.1, alpha: 0.55 },
      { tex: 'decal:decal_footprint_01', x: 8.3, y: 2.6, scale: 1.1, alpha: 0.45, angle: 8 },
    ],
    // 大门外透进来的光
    lights: [{ x: 8, y: 5.8, scale: 2.8, intensity: 0.45 }],
    examine: [
      { ch: 'T', key: 'examine.lobby.trophy_case' },
      { x: 9, y: 5, key: 'examine.lobby.shoes' },
      { x: 8, y: 4, key: 'examine.lobby.footprint' },
    ],
    map: [
      '########1#######',
      '#....TT........#',
      '#.kk........kk.#',
      '#..............#',
      '#.kk........kk.#',
      '#..............#',
      '######GGGG######',
    ],
    objects: {
      T: { id: 'trophy_case', color: 0x4a4236, tex: 'trophy_case' },
      k: { id: 'shoe_locker', color: 0x4a4440, label: '鞋柜', tex: 'shoe_locker' },
      G: { id: 'gate', color: 0x5a5248, label: '大门', tex: 'school_gate', wall: true },
    },
    exits: {},
    spawn: { x: 8, y: 1 },
  },
};

// ---------------------------------------------------------------- 终周目（M5）
// 同样的学校，但什么都没有发生：天花板上没有绳子、对面的门没有被撞开、桌上没有试卷、粉色的门不见了。

const strip = (map: string[], from: RegExp, to = '.') => map.map((r) => r.replace(from, to));

ROOMS.classroom4_final = {
  ...ROOMS.classroom4,
  id: 'classroom4_final',
  alias: 'classroom4',
  // 绳子没有了；左墙的门可以出去
  map: strip(strip(ROOMS.classroom4.map, /r/g), /D/g, '1'),
  objects: Object.fromEntries(Object.entries(ROOMS.classroom4.objects).filter(([k]) => k !== 'r' && k !== 'D')),
  exits: { '1': { to: 'corridor4', arriveAt: '2' } },
  doors: { '1': 'corridor4' },
};

ROOMS.classroom3_final = {
  ...ROOMS.classroom3,
  id: 'classroom3_final',
  alias: 'classroom3',
  map: strip(ROOMS.classroom3.map, /E/g),
  objects: Object.fromEntries(Object.entries(ROOMS.classroom3.objects).filter(([k]) => k !== 'E')),
  exits: { '1': { to: 'corridor3_final', arriveAt: '1' } },
  doors: { '1': 'corridor3_final' },
};

ROOMS.exam_room_final = {
  ...ROOMS.exam_room,
  id: 'exam_room_final',
  alias: 'exam_room',
  // 桌上没有试卷
  objects: {
    ...ROOMS.exam_room.objects,
    d: { ...ROOMS.exam_room.objects.d, tex: 'school_desk' },
    X: { ...ROOMS.exam_room.objects.X, tex: 'school_desk' },
  },
  exits: { '1': { to: 'corridor3_final', arriveAt: '2' } },
  doors: { '1': 'corridor3_final' },
};

ROOMS.corridor3_final = {
  id: 'corridor3_final',
  alias: 'corridor3_long',
  floor: 3,
  lights: lampRow(3.5, 3, 21, 6, 2),
  map: [
    '#####1##b###2###f######SS',
    '#......................SS',
    '#......................SS',
    'U......................SS',
    '#......................##',
    '#.......p........p.....##',
    '###BB#####kkk############',
  ],
  objects: {
    p: CORRIDOR_STUFF.p,
    k: CORRIDOR_STUFF.k,
    b: CORRIDOR_STUFF.b,
    f: CORRIDOR_STUFF.f,
    S: { id: 'stairs_final', color: 0x3a3a3a, tex: 'stairs' },
    B: { id: 'quiet_door', color: 0x3a2a24, tex: 'class_door', wall: true },
    U: { id: 'stairs_up', color: 0x2a2a2a, hidden: true },
  },
  exits: {
    '1': { to: 'classroom3_final', arriveAt: '1' },
    '2': { to: 'exam_room_final', arriveAt: '1' },
  },
  doors: { '1': 'classroom3', '2': 'exam_room' },
  decor: classSigns([5, 12]),
  spawn: { x: 1, y: 2 },
};

ROOMS.lobby_final = {
  ...ROOMS.lobby,
  id: 'lobby_final',
  alias: 'lobby',
  map: ROOMS.lobby.map.map((r, y) => (y === 0 ? r.replace('1', 'm') : r)),
  objects: {
    ...ROOMS.lobby.objects,
    m: { id: 'music_door', color: 0x2c2620, tex: 'class_door', wall: true },
  },
  spawn: { x: 8, y: 1 },
};

// ---------------------------------------------------------------- 周目之间的布局差异（L4）

/**
 * 某些周目里房间的布局不一样。进房间时套用（不改原来的房间定义，出口和门的位置不变）。
 * - 绘名周目：二楼走廊被一堆画布整个堵住，从下面的一间教室绕过去
 * - 瑞希周目：四楼走廊下半边摆着人台，只能走上面那条路
 */
export function cycleLayout(def: RoomDef, cycle: 1 | 2 | 3 | 4 | 'final'): RoomDef {
  if (def.id === 'corridor2' && cycle === 2) return enaCorridor2(def);
  if (def.id === 'corridor4' && cycle === 3) return mizukiCorridor4(def);
  return def;
}

function enaCorridor2(def: RoomDef): RoomDef {
  const W = def.map[0].length;
  const g = def.map.map((r) => [...r]);
  // 画布堆：x 14~15，走廊 1~5 行整个堵死
  for (let y = 1; y <= 5; y++) for (const x of [14, 15]) g[y][x] = 'C';
  // 下面的教室：x 8~21，第 7~10 行；底墙第 6 行开两个门洞
  const x0 = 8;
  const x1 = 21;
  for (let y = 7; y <= 11; y++) g.push(Array(W).fill(' '));
  for (let x = x0; x <= x1; x++) {
    for (let y = 7; y <= 10; y++) g[y][x] = x === x0 || x === x1 ? '#' : '.';
    g[11][x] = '#';
  }
  for (let x = x0 + 2; x <= x1 - 2; x += 3) g[9][x] = 'd';
  for (const x of [10, 11, 18, 19]) g[6][x] = '.';
  // 门洞上不能有东西挡着
  for (const x of [10, 11, 18, 19]) if (g[5][x] !== '.') g[5][x] = '.';
  return {
    ...def,
    map: g.map((r) => r.join('')),
    objects: {
      ...def.objects,
      C: { id: 'ena_canvas_pile', color: 0x4a4038, tex: 'ena_canvas_pile' },
      d: DESK,
    },
  };
}

function mizukiCorridor4(def: RoomDef): RoomDef {
  const g = def.map.map((r) => [...r]);
  // 下半边（第 4、5 行）x 15~22 摆满人台
  for (let x = 15; x <= 22; x++) for (const y of [4, 5]) if (g[y][x] === '.') g[y][x] = 'Q';
  return {
    ...def,
    map: g.map((r) => r.join('')),
    objects: { ...def.objects, Q: { id: 'mizuki_mannequin', color: 0x8a6a7a, tex: 'mizuki_mannequin' } },
    decor: [
      ...(def.decor ?? []),
      { tex: 'mizuki_ribbon_01', x: 16.2, y: 3.6, scale: 0.6, angle: 30, cycle: [3] },
      { tex: 'mizuki_ribbon_03', x: 19.8, y: 3.7, scale: 0.6, angle: -20, cycle: [3] },
    ],
  };
}
