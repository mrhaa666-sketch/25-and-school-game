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
}

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

/** 被无限拉长的三楼走廊（追逐战 2）。真正的长度足够跑 30 秒以上 */
function buildLongCorridor(): RoomDef {
  const W = 300;
  const top = [...'#'.repeat(W)];
  for (let x = 14; x < W - 4; x += 9) top[x] = 'c';
  top[6] = '1'; // 从三楼教室出来的门
  const bottom = [...'#'.repeat(W)];
  bottom[3] = 'B'; // 对面那扇门
  bottom[4] = 'B';
  const floor = '#' + '.'.repeat(W - 1);
  return {
    id: 'corridor3_long',
    floor: 3,
    map: [top.join(''), floor, floor, floor, bottom.join('')],
    lights: lampRow(2.5, 4, W - 4, 6, 1),
    objects: {
      c: CLASS_DOOR,
      B: { id: 'burst_door', color: 0x3a2a24, label: '门', tex: 'class_door', wall: true },
    },
    exits: {},
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
    map: [
      '##########M#######',
      '#BB..........KKK.#',
      '#BB..............#',
      '#................#',
      '#bb.....DD.......#',
      '#bb.....DD.......#',
      '#................#',
      '#................#',
      '########1#########',
    ],
    objects: {
      B: { id: 'bed', color: 0xb8b4aa, spot: 'bedhead', label: '病床', tex: 'bed' },
      b: { id: 'bed2', color: 0xa8a49a, label: '病床', tex: 'bed' },
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
    lights: lampRow(2.5, 3, 28, 5, 0),
    map: [
      '##2#W##3###1##4#W###5###W#####SS',
      '#.............................SS',
      '#.............................SS',
      '#.............................SS',
      '################################',
    ],
    objects: {
      W: { id: 'corridor_window', color: 0x1e2a36, label: '窗', tex: 'window_night', wall: true },
      S: { id: 'stairs', color: 0x3a3a3a, label: '楼梯口', tex: 'stairs' },
    },
    decor: [
      // 瑞希周目：走廊里散落的缎带（取代画在墙和地板贴图里的）
      { tex: 'mizuki_ribbon_01', x: 6.2, y: -0.6, scale: 0.8, wall: true, cycle: [3] },
      { tex: 'mizuki_ribbon_02', x: 9.5, y: 2.6, scale: 0.7, angle: 20, cycle: [3] },
      { tex: 'mizuki_ribbon_03', x: 18.3, y: -0.4, scale: 0.8, wall: true, cycle: [3] },
      { tex: 'mizuki_ribbon_04', x: 22.6, y: 3.3, scale: 0.7, angle: -35, cycle: [3] },
      { tex: 'mizuki_ribbon_02', x: 27.4, y: 1.8, scale: 0.6, angle: 70, cycle: [3] },
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
    map: [
      '############',
      '#ee..ee..ee#',
      '#..........#',
      '#....tt....#',
      '#..........#',
      '#####1######',
    ],
    objects: {
      e: { id: 'easel', color: 0x4a4440, tex: 'easel_portraits' },
      t: { id: 'prep_desk', color: 0x5a4a3a, spot: 'desk', tex: 'office_desk' },
    },
    exits: { '1': { to: 'corridor4', arriveAt: '3' } },
  },

  locked_class4: {
    id: 'locked_class4',
    floor: 4,
    doors: { '1': 'corridor4' },
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
    map: [
      '############',
      '#ll......ll#',
      '#..........#',
      '#....tt....#',
      '#..........#',
      '#####1######',
    ],
    objects: {
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
      { tex: 'mizuki_ribbon_03', x: 3.4, y: -0.5, scale: 0.8, wall: true, cycle: [3] },
      { tex: 'mizuki_ribbon_01', x: 8.6, y: 2.4, scale: 0.7, angle: -15, cycle: [3] },
      { tex: 'mizuki_ribbon_04', x: 15.2, y: -0.6, scale: 0.8, wall: true, cycle: [3] },
      { tex: 'mizuki_ribbon_02', x: 21.5, y: 3.2, scale: 0.7, angle: 40, cycle: [3] },
      { tex: 'mizuki_ribbon_03', x: 25.8, y: 1.5, scale: 0.6, angle: -60, cycle: [3] },
    ],
    lights: lampRow(2.5, 3, 29, 6, 2),
    map: [
      '#####c######c######c#######c####',
      '#..............................#',
      '1..............................T',
      '#.............................n#',
      '################################',
    ],
    objects: {
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
    lights: [...lampRow(4.5, 5, 13, 8, 1)],
    map: [
      '##################',
      '#....PPPP........#',
      '#....PPPPk.......#',
      '#................#',
      '#................#',
      '#..s.s.s.s.s.....#',
      '#................#',
      'v................#',
      '##################',
    ],
    objects: {
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
    map: [
      '########1#######',
      '#..............#',
      '#.kk........kk.#',
      '#..............#',
      '#.kk........kk.#',
      '#..............#',
      '######GGGG######',
    ],
    objects: {
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
  lights: lampRow(2.5, 3, 21, 6, 2),
  map: [
    '#####1######2##########SS',
    '#......................SS',
    '#......................SS',
    'U......................SS',
    '###BB####################',
  ],
  objects: {
    S: { id: 'stairs_final', color: 0x3a3a3a, tex: 'stairs' },
    B: { id: 'quiet_door', color: 0x3a2a24, tex: 'class_door', wall: true },
    U: { id: 'stairs_up', color: 0x2a2a2a, hidden: true },
  },
  exits: {
    '1': { to: 'classroom3_final', arriveAt: '1' },
    '2': { to: 'exam_room_final', arriveAt: '1' },
  },
  doors: { '1': 'classroom3', '2': 'exam_room' },
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
