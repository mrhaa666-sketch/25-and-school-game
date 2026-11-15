import type Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { MATERIALS } from '../core/progress';
import { ListMenu } from '../systems/ListMenu';
import { startAct } from './flow';

/** 开发者模式：所有版本都能用，游戏里按 F2 打开 */
export function debugEnabled(): boolean {
  return true;
}

/** 无敌：追逐中被追上也不算（只用于测试） */
export function godMode(): boolean {
  return (globalThis as { __god?: boolean }).__god === true;
}

export function buildDebugMenu(scene: Phaser.Scene, close: () => void): ListMenu {
  let target = 2;
  const jump = (act: number) => {
    close();
    GameState.patch({ act });
    startAct(scene, act, false);
  };
  return new ListMenu(
    scene,
    '开发者模式（F2）',
    [
      { label: '精神值 -10', action: () => GameState.deductSanity(10, 'debug') },
      { label: '精神值设为 100', action: () => GameState.debugSetSanity(100) },
      { label: '精神值设为 20', action: () => GameState.debugSetSanity(20) },
      {
        label: '获得本周目全部材料',
        action: () => {
          const c = GameState.save.cycle;
          MATERIALS.filter((m) => m.theme === c).forEach((m) => GameState.addMaterial(m.id));
        },
      },
      { label: '获得全部 12 份材料', action: () => MATERIALS.forEach((m) => GameState.addMaterial(m.id)) },
      {
        label: () => `周目：${GameState.save.cycle === 'final' ? '终周目' : GameState.save.cycle}（确认切换）`,
        action: () => {
          const order = [1, 2, 3, 4, 'final'] as const;
          const i = order.indexOf(GameState.save.cycle as (typeof order)[number]);
          GameState.patch({ cycle: order[(i + 1) % order.length] });
        },
      },
      {
        label: () => `无敌（追逐不会被抓）：${godMode() ? '开' : '关'}`,
        action: () => ((globalThis as { __god?: boolean }).__god = !godMode()),
      },
      { label: () => `目标：第 ${target} 幕（确认切换）`, action: () => (target = (target % 10) + 1) },
      { label: () => `跳到第 ${target} 幕`, action: () => jump(target) },
      { label: '关闭', action: close },
    ],
    420,
    close,
  );
}
