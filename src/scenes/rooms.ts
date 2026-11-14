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
}

export interface RoomExit {
  to: string;
  /** 进入目标房间时出现在哪个出口旁边 */
  arriveAt: string;
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
  /** 所在楼层（补充周目第 3 次提示：走到材料所在楼层时停下来看一眼） */
  floor?: number;
  /**
   * 门（出口数字或门物件的字母）通往哪个房间。用于补充周目的提示：
   * 材料所在房间的门口，灯闪得更频繁。
   */
  doors?: Record<string, string>;
}

const DESK = { id: 'desk', color: 0x4a4038, label: '桌' };
const CLASS_DOOR = { id: 'class_door', color: 0x2c2620, label: '门' };

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
    objects: {
      c: CLASS_DOOR,
      B: { id: 'burst_door', color: 0x3a2a24, label: '门' },
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
      B: { id: 'bed', color: 0xb8b4aa, spot: 'bedhead', label: '病床' },
      b: { id: 'bed2', color: 0xa8a49a, label: '病床' },
      M: { id: 'mirror', color: 0x6f7c86, label: '镜子' },
      K: { id: 'cabinet', color: 0x58625a, spot: 'cabinet', label: '药柜' },
      D: { id: 'desk', color: 0x5a4a3a, label: '办公桌' },
    },
    exits: { '1': { to: 'corridor4', arriveAt: '1' } },
    spawn: { x: 3, y: 2 },
  },

  corridor4: {
    id: 'corridor4',
    floor: 4,
    doors: { '1': 'infirmary', '2': 'classroom4' },
    map: [
      '##2#W######1####W#######W#####SS',
      '#.............................SS',
      '#.............................SS',
      '#.............................SS',
      '################################',
    ],
    objects: {
      W: { id: 'corridor_window', color: 0x1e2a36, label: '窗' },
      S: { id: 'stairs', color: 0x3a3a3a, label: '楼梯口' },
    },
    exits: { '1': { to: 'infirmary', arriveAt: '1' } },
  },

  // ------------------------------------------------------------ 第三幕
  classroom4: {
    id: 'classroom4',
    floor: 4,
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
      K: { id: 'blackboard', color: 0x1f2a24, label: '黑板' },
      L: { id: 'lectern', color: 0x5a4a3a, spot: 'lectern_drawer', label: '讲台' },
      W: { id: 'window', color: 0x1e2a36, label: '窗' },
      r: { id: 'ropes', color: 0x6a604e, label: '绳子' },
      d: DESK,
      D: { id: 'door', color: 0x2c2620, label: '门' },
    },
    exits: {},
    spawn: { x: 1, y: 8 },
  },

  // ------------------------------------------------------------ 第四幕
  classroom3: {
    id: 'classroom3',
    floor: 3,
    doors: { '1': 'corridor3_long' },
    map: [
      '######KKKK########',
      '#.......LL.......#',
      'W................#',
      'W..d.d.....d.d...#',
      'W.......EE.......#',
      '#..d.d.....d.d...#',
      '#................#',
      '#..d.d.d.d.d.d...#',
      '#................#',
      '##############1###',
    ],
    objects: {
      K: { id: 'blackboard', color: 0x1f2a24, label: '黑板' },
      L: { id: 'lectern', color: 0x5a4a3a, label: '讲台' },
      W: { id: 'window', color: 0x1e2a36, spot: 'window', label: '窗' },
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
      K: { id: 'blackboard', color: 0x1f2a24, label: '黑板' },
      C: { id: 'clock', color: 0x7a7468 },
      T: { id: 'lectern', color: 0x5a4a3a },
      d: { id: 'exam_desk', color: 0x4a4038 },
      X: { id: 'own_desk', color: 0x4a4038 },
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
      I: { id: 'iron_door', color: 0x4a4e52, label: '铁门' },
      f: { id: 'steps', color: 0x34322e, spot: 'floor' },
    },
    exits: { '1': { to: 'corridor2', arriveAt: '1' } },
    spawn: { x: 4, y: 1 },
  },

  corridor2: {
    id: 'corridor2',
    floor: 2,
    doors: { '1': 'stairs2', T: 'pink_room2', P: 'pink_room2' },
    map: [
      '#####c######c######c#######c####',
      '#..............................#',
      '1..............................T',
      '#.............................n#',
      '################################',
    ],
    objects: {
      c: CLASS_DOOR,
      n: { id: 'corridor_end', color: 0x2a2a2a, spot: 'corridor_end' },
      T: { id: 'stairs_down', color: 0x3a3a3a },
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
      t: { id: 'table', color: 0x6a5048, spot: 'table', label: '桌子' },
      R: { id: 'member_scene', color: 0x000000, hidden: true },
      O: { id: 'pipe', color: 0x2a2a2e, label: '' },
    },
    exits: {},
    floorColor: '#3a2a32',
    wallColor: '#2a1820',
  },

  // ------------------------------------------------------------ 第七幕
  pipe: buildPipe(),

  // ------------------------------------------------------------ 第八、九幕
  music_room: {
    id: 'music_room',
    floor: 1,
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
      P: { id: 'piano', color: 0x101012, label: '钢琴' },
      k: { id: 'kanade', color: 0x000000, hidden: true },
      s: { id: 'chair', color: 0x3a3430 },
      v: { id: 'vent', color: 0x2a2a2e },
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
      k: { id: 'shoe_locker', color: 0x4a4440, label: '鞋柜' },
      G: { id: 'gate', color: 0x5a5248, label: '大门' },
    },
    exits: {},
    spawn: { x: 8, y: 1 },
  },
};
