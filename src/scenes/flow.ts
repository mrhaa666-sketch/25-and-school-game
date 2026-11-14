/**
 * 场景之间的流程：进入某一幕、触发结局、推开大门、周目过渡。
 * 所有「下一步去哪」的判断都集中在这里。
 */
import type Phaser from 'phaser';
import { ENDINGS, GameState } from '../core/GameState';
import * as P from '../core/progress';
import { tLines, tRaw, tUi } from '../core/text';
import type { StoryData } from './StoryScene';

export const SCENE = {
  boot: 'Boot',
  title: 'Title',
  ui: 'UI',
  story: 'Story',
  act02: 'Act02',
  placeholder: 'ActPlaceholder',
} as const;

/** 已经做好的幕。没做好的幕先进占位场景（M2 起逐个替换）。 */
const ACT_SCENES: Record<number, string> = {
  2: SCENE.act02,
};

const GAMEPLAY_SCENES = [SCENE.act02, SCENE.placeholder];

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

  // 第一幕是纯演出（仅一周目）。正式演出在 M2 制作，先用文字占位
  if (act === 1) {
    showStory(scene, { lines: tLines('act01.opening', GameState.save.cycle), onDone: (s) => startAct(s, 2) });
    return;
  }

  stopGameplay(scene);
  if (scene.scene.isActive(SCENE.story)) scene.scene.stop(SCENE.story);
  if (!scene.scene.isActive(SCENE.ui)) scene.scene.launch(SCENE.ui);

  const key = ACT_SCENES[act] ?? SCENE.placeholder;
  scene.scene.launch(key, { act });
  scene.scene.bringToTop(SCENE.ui);
  if (scene.scene.key !== SCENE.ui && scene.scene.key !== key) scene.scene.stop();
}

/** 从存档继续：回到存档所在幕的开头，不重复扣精神值 */
export function continueGame(scene: Phaser.Scene): void {
  startAct(scene, GameState.save.act, false);
}

export function goToTitle(scene: Phaser.Scene): void {
  stopGameplay(scene);
  for (const key of [SCENE.story, SCENE.ui]) if (scene.scene.isActive(key)) scene.scene.stop(key);
  scene.scene.start(SCENE.title);
}

function showStory(scene: Phaser.Scene, data: StoryData): void {
  stopGameplay(scene);
  if (scene.scene.isActive(SCENE.ui)) scene.scene.stop(SCENE.ui);
  if (scene.scene.key === SCENE.story) scene.scene.restart(data);
  else {
    if (scene.scene.isActive(SCENE.story)) scene.scene.stop(SCENE.story);
    scene.scene.start(SCENE.story, data);
  }
}

// ---------------------------------------------------------------- 结局

/**
 * 触发结局。1~8：演出后回到当前周目开头；9：演出后直接进入补充周目。
 * 具体的结局演出在各幕制作时补上，这里先用文字占位。
 */
export function triggerEnding(scene: Phaser.Scene, id: number, lines?: string[]): void {
  const def = ENDINGS.find((e) => e.id === id)!;
  GameState.unlockEnding(id);
  const header = `${tUi('endingLabel')} ${id} · ${def.title}`;

  if (id >= 1 && id <= 8) {
    showStory(scene, {
      header,
      lines: lines ?? [def.summary],
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
      onDone: (s) => {
        GameState.replace(next);
        GameState.persist();
        playTransition(s, 'supplementary');
      },
    });
    return;
  }
  // 10 由终周目（M5）处理
  showStory(scene, { header, lines: lines ?? [def.summary], onDone: (s) => goToTitle(s) });
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
    lines.push(...tLines('transition.wake', s.cycle).slice(0, 1));
    lines.push(...tLines('supplementary.line', s.cycle));
  } else {
    lines.push(...tLines('transition.wake', s.cycle));
    lines.push(...tLines('transition.sit', s.cycle));
    // 只有常规周目（二~四）和进入终周目时才会多一个乱码；补充周目之间不再增加
    const garbleGrew = s.cycleCount <= 4;
    if (garbleGrew) lines.push(...tLines('transition.phone', s.cycle));
    lines.push(`「${tRaw<string>(kind === 'final' ? 'voice.last' : 'voice.continue')}」`);
  }
  showStory(scene, { lines, onDone: (st) => startAct(st, 2) });
}
