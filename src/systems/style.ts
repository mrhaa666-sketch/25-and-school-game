import type Phaser from 'phaser';
import { FONT_FAMILY } from '../core/constants';

export const COLORS = {
  bg: 0x000000,
  panel: 0x0c0c10,
  panelBorder: 0x3a3a44,
  text: '#d6d3cc',
  textDim: '#7d7a74',
  highlight: '#ffffff',
  accent: 0x8a8296,
  danger: '#8b1a1a',
} as const;

export function textStyle(
  size = 22,
  color: string = COLORS.text,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color, ...extra };
}

/** 画一个带边框的面板 */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.92,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panel, alpha).fillRect(x, y, w, h);
  g.lineStyle(1, COLORS.panelBorder, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  return g;
}

const GARBLE_CHARS = '繧ｫ繝翫ョ縺ｮ荳譁蟄怜喧縺鍋ｵｵ蜷咲曝蟶瑞■□◆▓▒░';

/** 生成固定长度的乱码。seed 相同时结果相同，避免名字每帧都在变。 */
export function garble(length: number, seed: number): string {
  let s = seed * 9301 + 49297;
  let out = '';
  for (let i = 0; i < length; i++) {
    s = (s * 9301 + 49297) % 233280;
    out += GARBLE_CHARS[Math.floor((s / 233280) * GARBLE_CHARS.length)];
  }
  return out;
}
