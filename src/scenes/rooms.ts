/**
 * 房间定义（代码内定义格子，交接文档 1 节的方案二）。
 *
 * 地图字符：
 *   ' ' 虚空（不可走，不绘制）
 *   '#' 墙
 *   '.' 地板
 *   '0'~'9' 出口：踩上去切换房间（见 exits）
 *   其他字母：物件。同一个字母的格子组成一个物件（见 objects）
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
  /** 只在这个高度画（例如墙上的镜子只占上半格） */
  label?: string;
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
  /** 玩家初始位置（格子坐标），没有指定时用于第一次进入 */
  spawn?: { x: number; y: number };
}

export const ROOMS: Record<string, RoomDef> = {
  infirmary: {
    id: 'infirmary',
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
    map: [
      '####W######1####W#######W#####SS',
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
};
