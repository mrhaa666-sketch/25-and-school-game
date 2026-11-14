/**
 * 场景之间的流程：进入某一幕、触发结局、推开大门、周目过渡。
 * 所有「下一步去哪」的判断都集中在这里。
 */
import type Phaser from 'phaser';
import { ENDINGS, GameState } from '../core/GameState';
import * as P from '../core/progress';
import { cycleCountLabel, tLines, tRaw, tUi } from '../core/text';
import { Audio } from '../systems/audio';
import type { StoryData } from './StoryScene';

export const SCENE = {
  boot: 'Boot',
  title: 'Title',
  ui: 'UI',
  story: 'Story',
  finalRun: 'FinalRun',
} as const;

/** 第 n 幕对应的场景 key */
export const actKey = (n: number) => `Act${String(n).padStart(2, '0')}`;

const GAMEPLAY_SCENES = [...Array.from({ length: 10 }, (_, i) => actKey(i + 1)), 'FinalRun'];

function stopGameplay(scene: Phaser.Scene): void {
  for (const key of GAMEPLAY_SCENES) {
    if (scene.scene.isActive(key) || scene.scene.isPaused(key) || scene.scene.isSleeping(key)) scene.scene.stop(key);
  }
}

/**
 * 进入某一幕。
 * @param deduct 是否按「进入新的一幕」扣精神值。读档继续时为 false。
 */
export function startAct(scene: Phaser.Scene, act: number, deduct = true): void {
  if (deduct) GameState.enterAct(act);
  else GameState.persist();


  stopGameplay(scene);
  if (scene.scene.isActive(SCENE.story)) scene.scene.stop(SCENE.story);
  if (!scene.scene.isActive(SCENE.ui)) scene.scene.launch(SCENE.ui);

  // 终周目：不分幕，一个场景从医务室走到大门
  const key = GameState.save.cycle === 'final' ? SCENE.finalRun : actKey(act);
  scene.scene.launch(key, { act });
  scene.scene.bringToTop(SCENE.ui);
  if (scene.scene.key !== SCENE.ui && scene.scene.key !== key) scene.scene.stop();
}

/** 从存档继续：回到存档所在幕的开头，不重复扣精神值 */
export function continueGame(scene: Phaser.Scene): void {
  startAct(scene, GameState.save.act, false);
}

export function goToTitle(scene: Phaser.Scene): void {
  Audio.stopAll();
  stopGameplay(scene);
  for (const key of [SCENE.story, SCENE.ui]) if (scene.scene.isActive(key)) scene.scene.stop(key);
  scene.scene.start(SCENE.title);
}

function showStory(scene: Phaser.Scene, data: StoryData): void {
  if (data.header?.startsWith(tUi('endingLabel'))) data = { ...data, sfx: data.sfx ?? 'ending_hit' };
  stopGameplay(scene);
  if (scene.scene.isActive(SCENE.ui)) scene.scene.stop(SCENE.ui);
  if (scene.scene.key === SCENE.story) scene.scene.restart(data);
  else {
    if (scene.scene.isActive(SCENE.story)) scene.scene.stop(SCENE.story);
    scene.scene.start(SCENE.story, data);
  }
}

// ---------------------------------------------------------------- 结局

/** 结局文本：endings.e{id}，{monsterA} / {monsterB} 替换成本周目的怪物名 */
export function endingLines(id: number): string[] {
  const c = GameState.cycleDef;
  return tLines(`endings.e${id}`, GameState.save.cycle).map((l) =>
    l.replace('{monsterA}', c.monsterA.name).replace('{monsterB}', c.monsterB.name),
  );
}

/**
 * 触发结局。1~8：演出后回到当前周目开头；9：演出后直接进入补充周目。
 * 场景里先做画面上的演出，然后调用这里显示结局文字。
 */
/** 结局演出里显示的图 */
const ENDING_IMAGES: Record<number, string> = {
  6: 'mafuyu_sit_back',
  7: 'mafuyu_child_counting',
};

export function triggerEnding(scene: Phaser.Scene, id: number, lines?: string[]): void {
  const def = ENDINGS.find((e) => e.id === id)!;
  GameState.unlockEnding(id);
  const header = `${tUi('endingLabel')} ${id} · ${def.title}`;
  if (!lines && id <= 8) lines = endingLines(id);

  if (id >= 1 && id <= 8) {
    showStory(scene, {
      header,
      lines: lines ?? [def.summary],
      image: ENDING_IMAGES[id],
      onDone: (s) => {
        GameState.replace(P.restartCycle(GameState.save));
        startAct(s, GameState.save.act);
      },
    });
    return;
  }
  if (id === 9) {
    const next = P.applyGate(GameState.save, { kind: 'ending9' });
    showStory(scene, {
      header,
      lines: lines ?? tLines('ending9', GameState.save.cycle),
      bg: 'bg:ending9_home',
      onDone: (s) => {
        GameState.replace(next);
        GameState.persist();
        playTransition(s, 'supplementary');
      },
    });
    return;
  }
  // 10：真结局。尾声之后游戏结束：删除存档（结局图鉴保留），回到标题
  showStory(scene, {
    header,
    lines: lines ?? tLines('finalrun.epilogue', 'final'),
    bg: 'bg:final_gate',
    onDone: (s) => {
      GameState.clearSave();
      goToTitle(s);
    },
  });
}

// ---------------------------------------------------------------- 第十幕 · 大门

export function openGate(scene: Phaser.Scene): void {
  const s = GameState.save;
  if (s.cycle === 'final') return; // 终周目的大门在 M5 处理
  const stars = P.starString(P.themeStars(s.materials, s.cycle));
  const outcome = P.resolveGate(s);

  showStory(scene, {
    lines: tLines('gate.push', s.cycle),
    flash: stars, // 屏幕中央先显示本周目材料进度
    onDone: (st) => {
      if (outcome.kind === 'ending9') return triggerEnding(st, 9);
      GameState.replace(P.applyGate(GameState.save, outcome));
      GameState.persist();
      playTransition(st, outcome.kind === 'final' ? 'final' : 'cycle');
    },
  });
}

// ---------------------------------------------------------------- 周目过渡

type TransitionKind = 'cycle' | 'final' | 'supplementary';

/** 进入新周目后（存档已经是新周目）播放过渡演出，然后进入第二幕 */
export function playTransition(scene: Phaser.Scene, kind: TransitionKind): void {
  const s = GameState.save;
  const lines: string[] = [];
  if (kind === 'supplementary') {
    lines.push(...tLines('supplementary.flicker', s.cycle));
    lines.push(...tLines('transition.wake', s.cycle).slice(0, 1));
    lines.push(...tLines('supplementary.line', s.cycle));
  } else {
    lines.push(...tLines('transition.wake', s.cycle));
    lines.push(...tLines('transition.sit', s.cycle));
    // 只有常规周目（二~四）和进入终周目时才会多一个乱码；补充周目之间不再增加
    const garbleGrew = s.cycleCount <= 4;
    if (garbleGrew) lines.push(...tLines('transition.phone', s.cycle));
    lines.push(kind === 'final' ? '#sfx voice_last' : '#sfx voice_continue');
    lines.push(`「${tRaw<string>(kind === 'final' ? 'voice.last' : 'voice.continue')}」`);
  }
  const header = s.cycle === 'final' ? tUi('finalCycle') : cycleCountLabel(s.cycleCount);
  showStory(scene, { header, lines, onDone: (st) => startAct(st, 2) });
}
