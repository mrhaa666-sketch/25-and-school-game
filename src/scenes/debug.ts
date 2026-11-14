import type Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { MATERIALS } from '../core/progress';
import { ListMenu } from '../systems/ListMenu';
import { startAct } from './flow';

/** 开发模式（npm run dev）或网址带 ?debug 时启用，F2 打开 */
export function debugEnabled(): boolean {
  return import.meta.env.DEV || (typeof location !== 'undefined' && location.search.includes('debug'));
}

export function buildDebugMenu(scene: Phaser.Scene, close: () => void): ListMenu {
  const jump = (act: number) => {
    close();
    GameState.patch({ act });
    startAct(scene, act, false);
  };
  return new ListMenu(
    scene,
    '调试（F2）',
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
      { label: '跳到第二幕', action: () => jump(2) },
      { label: '跳到第六幕', action: () => jump(6) },
      { label: '跳到第十幕（大门）', action: () => jump(10) },
      { label: '关闭', action: close },
    ],
    420,
    close,
  );
}
