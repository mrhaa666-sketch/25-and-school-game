import { describe, expect, it } from 'vitest';
import * as P from '../src/core/progress';
import type { SaveData, ThemeId } from '../src/core/types';

const ids = (themes: ThemeId[]) => P.MATERIALS.filter((m) => themes.includes(m.theme)).map((m) => m.id);
const all = () => P.MATERIALS.map((m) => m.id);
const without = (...drop: string[]) => all().filter((id) => !drop.includes(id));

function at(partial: Partial<SaveData>): SaveData {
  return { ...P.createNewSave(), ...partial };
}

describe('精神值', () => {
  it('分档', () => {
    expect(P.sanityTier(100)).toBe(1);
    expect(P.sanityTier(76)).toBe(1);
    expect(P.sanityTier(75)).toBe(2);
    expect(P.sanityTier(51)).toBe(2);
    expect(P.sanityTier(50)).toBe(3);
    expect(P.sanityTier(26)).toBe(3);
    expect(P.sanityTier(25)).toBe(4);
    expect(P.sanityTier(0)).toBe(4);
  });

  it('第一幕不扣，第二~十幕每幕 -10，最低为 0', () => {
    let s = P.createNewSave();
    s = P.enterAct(s, 1);
    expect(s.sanity).toBe(100);
    for (let act = 2; act <= 10; act++) s = P.enterAct(s, act);
    expect(s.sanity).toBe(10);
    s = P.enterAct({ ...s, sanity: 4 }, 10);
    expect(s.sanity).toBe(0);
  });

  it('终周目不扣', () => {
    expect(P.enterAct(at({ cycle: 'final', sanity: 100 }), 5).sanity).toBe(100);
  });
});

describe('材料进度 ⭐/？', () => {
  it('位置与材料顺序一一对应', () => {
    const mats = ['mafuyu_checkup', 'mafuyu_nameplate'];
    expect(P.starString(P.themeStars(mats, 1))).toBe('⭐？⭐');
    expect(P.starString(P.themeStars(['mafuyu_blank_paper'], 1))).toBe('？⭐？');
    expect(P.starString(P.themeStars([], 2))).toBe('？？？');
  });
});

describe('补充周目提示', () => {
  it('只在补充周目提示当前主题缺的材料所在房间', () => {
    const mats = without('ena_comment');
    expect(P.hintRooms(at({ cycle: 2, cycleCount: 2, materials: mats })).size).toBe(0);
    const supp = at({ cycle: 2, cycleCount: 5, materials: mats, replayCount: { 1: 0, 2: 1, 3: 0, 4: 0 } });
    expect([...P.hintRooms(supp)]).toEqual(['corridor3']);
    expect(P.hintLevel(supp)).toBe(1);
    expect(P.hintLevel({ ...supp, replayCount: { 1: 0, 2: 5, 3: 0, 4: 0 } })).toBe(3);
    expect(P.hintRooms(at({ cycle: 'final', cycleCount: 6, materials: mats })).size).toBe(0);
  });
});

describe('通讯录乱码', () => {
  it('每个新周目多一个乱码，补充周目和终周目全部乱码', () => {
    expect(P.garbledContactCount(at({ cycle: 1, cycleCount: 1 }))).toBe(0);
    expect(P.garbledContactCount(at({ cycle: 2, cycleCount: 2 }))).toBe(1);
    expect(P.garbledContactCount(at({ cycle: 3, cycleCount: 3 }))).toBe(2);
    expect(P.garbledContactCount(at({ cycle: 4, cycleCount: 4 }))).toBe(3);
    expect(P.garbledContactCount(at({ cycle: 2, cycleCount: 6 }))).toBe(3);
    expect(P.garbledContactCount(at({ cycle: 'final', cycleCount: 5 }))).toBe(3);
  });

  it('顺序：绘名 → 瑞希 → 奏', () => {
    const s = at({ cycle: 2, cycleCount: 2 });
    expect(P.isContactGarbled(s, 'ena')).toBe(true);
    expect(P.isContactGarbled(s, 'mizuki')).toBe(false);
    expect(P.isContactGarbled(s, 'kanade')).toBe(false);
  });
});

describe('第十幕 · 大门', () => {
  it('一~三周目材料没拿全也进入下一周目', () => {
    for (const c of [1, 2, 3] as ThemeId[]) {
      const s = at({ cycle: c, cycleCount: c, materials: [] });
      expect(P.resolveGate(s)).toEqual({ kind: 'next', theme: c + 1 });
      const n = P.applyGate(s, P.resolveGate(s));
      expect(n.cycle).toBe(c + 1);
      expect(n.cycleCount).toBe(c + 1);
      expect(n.act).toBe(2);
      expect(n.sanity).toBe(100);
    }
  });

  it('四周目 12/12 → 终周目', () => {
    const s = at({ cycle: 4, cycleCount: 4, materials: all() });
    expect(P.resolveGate(s)).toEqual({ kind: 'final' });
    expect(P.applyGate(s, { kind: 'final' }).cycle).toBe('final');
  });

  it('四周目不全 → 结局 9 → 按 一→二→三→四 顺序只补缺的主题', () => {
    // 文档例：一 ⭐⭐⭐、二 ⭐？⭐、三 ⭐⭐⭐、四 ？？⭐
    const mats = without('ena_comment', 'kanade_score', 'kanade_earphones');
    const s4 = at({ cycle: 4, cycleCount: 4, materials: mats });
    expect(P.resolveGate(s4)).toEqual({ kind: 'ending9' });

    const s5 = P.applyGate(s4, { kind: 'ending9' });
    expect(s5).toMatchObject({ cycle: 2, cycleCount: 5, pendingThemes: [4], act: 2 });
    expect(s5.replayCount[2]).toBe(1);
    expect(P.isSupplementary(s5)).toBe(true);
    expect(P.hintLevel(s5)).toBe(1);

    // 第五周目补完绘名，推开大门 → 第六周目 = 奏
    const s5done = { ...s5, materials: [...s5.materials, 'ena_comment'] };
    expect(P.resolveGate(s5done)).toEqual({ kind: 'next', theme: 4 });
    const s6 = P.applyGate(s5done, P.resolveGate(s5done));
    expect(s6).toMatchObject({ cycle: 4, cycleCount: 6, pendingThemes: [] });
    expect(s6.replayCount[4]).toBe(1);

    // 第六周目仍不全 → 结局 9 → 再补奏，提示强度上升
    expect(P.resolveGate(s6)).toEqual({ kind: 'ending9' });
    const s7 = P.applyGate(s6, { kind: 'ending9' });
    expect(s7).toMatchObject({ cycle: 4, cycleCount: 7 });
    expect(P.hintLevel(s7)).toBe(2);

    // 补全 → 终周目
    const s7done = { ...s7, materials: all() };
    expect(P.resolveGate(s7done)).toEqual({ kind: 'final' });
  });

  it('死亡重来：回到当前周目开头，材料保留，精神值重置', () => {
    const s = at({ cycle: 1, cycleCount: 1, act: 6, sanity: 20, materials: ids([1]), blankPaperThisCycle: true });
    const r = P.restartCycle(s);
    expect(r).toMatchObject({ act: 1, sanity: 100, blankPaperThisCycle: false });
    expect(r.materials).toEqual(ids([1]));
    expect(P.restartCycle(at({ cycle: 3, cycleCount: 3, act: 7 })).act).toBe(2);
  });
});
