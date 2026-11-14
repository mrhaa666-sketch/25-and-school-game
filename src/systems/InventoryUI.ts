import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { GameState } from '../core/GameState';
import { getMaterial, hintLevel, isSupplementary, materialsOfTheme, starString, themeStars } from '../core/progress';
import { tUi, tUiList } from '../core/text';
import { THEMES, type ThemeId } from '../core/types';
import type { Modal, UiAction } from './Modal';
import { COLORS, panel, textStyle } from './style';

const W = 1000;
const H = 560;
const X = (GAME_WIDTH - W) / 2;
const Y = (GAME_HEIGHT - H) / 2;
const LIST_X = X + 360;

/**
 * 背包（交接文档 2.3）。
 * 左边：四个周目的 ⭐/？ 进度，当前周目高亮；补充周目第 2 次起，？ 下方出现地点文字。
 * 右边：已拿到的材料列表 + 图片占位 + 说明文字。
 */
export class InventoryUI implements Modal {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dynamic: Phaser.GameObjects.Container;
  private cursor = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const bg = panel(scene, X, Y, W, H, 0.96);
    bg.lineStyle(1, COLORS.panelBorder, 1).lineBetween(LIST_X - 30, Y + 24, LIST_X - 30, Y + H - 24);
    const title = scene.add.text(X + 32, Y + 24, tUi('bagTitle'), textStyle(22, COLORS.textDim));
    this.dynamic = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [bg, title, this.dynamic]).setDepth(950).setVisible(false);
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  open(): void {
    this.cursor = 0;
    this.root.setVisible(true);
    this.render();
  }

  close(): void {
    this.root.setVisible(false);
  }

  handle(action: UiAction): void {
    const n = GameState.save.materials.length;
    if (action === 'back') return this.close();
    if (n > 0 && action === 'up') this.cursor = (this.cursor + n - 1) % n;
    if (n > 0 && action === 'down') this.cursor = (this.cursor + 1) % n;
    this.render();
  }

  private currentTheme(): ThemeId | null {
    const c = GameState.save.cycle;
    return c === 'final' ? null : c;
  }

  private render(): void {
    this.dynamic.removeAll(true);
    const s = GameState.save;
    const names = tUiList('cycleNames');
    const current = this.currentTheme();
    const hint = hintLevel(s);

    // ---- 左：进度
    let y = Y + 84;
    for (const theme of THEMES) {
      const isCurrent = theme === current;
      const color = isCurrent ? COLORS.highlight : COLORS.textDim;
      if (isCurrent) {
        const hl = this.scene.add.rectangle(X + 20, y - 8, 300, 44, 0xffffff, 0.06).setOrigin(0);
        this.dynamic.add(hl);
      }
      this.dynamic.add(this.scene.add.text(X + 36, y, names[theme - 1], textStyle(22, color)));
      this.dynamic.add(this.scene.add.text(X + 150, y - 2, starString(themeStars(s.materials, theme)), textStyle(24, color)));

      // 补充周目的提示：第 2 次起在 ？ 下方出现地点文字（第 2 次模糊，第 3 次起清晰）
      if (isCurrent && isSupplementary(s) && hint >= 2) {
        const mats = materialsOfTheme(theme);
        mats.forEach((m, i) => {
          if (s.materials.includes(m.id)) return;
          const label = hint >= 3 ? m.locationHint : `……${m.locationHint}……`;
          const t = this.scene.add.text(X + 150 + i * 30, y + 30, label, textStyle(13, '#9a968e')).setAngle(8);
          if (hint === 2) t.setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
          this.dynamic.add(t);
        });
        y += 22;
      }
      y += 64;
    }

    // ---- 右：材料
    const owned = s.materials.map(getMaterial).filter((m) => m !== undefined);
    if (owned.length === 0) {
      this.dynamic.add(this.scene.add.text(LIST_X, Y + 84, tUi('bagEmpty'), textStyle(22, COLORS.textDim)));
      return;
    }
    this.cursor = Math.min(this.cursor, owned.length - 1);
    owned.forEach((m, i) => {
      const sel = i === this.cursor;
      this.dynamic.add(
        this.scene.add.text(LIST_X, Y + 84 + i * 34, `${sel ? '›  ' : '   '}${m.name}`, textStyle(20, sel ? COLORS.highlight : COLORS.text)),
      );
    });
    const m = owned[this.cursor];
    const px = LIST_X + 300;
    // 图片占位：之后替换成 assets/ui/materials/<id>.png
    const frame = this.scene.add.rectangle(px, Y + 84, 300, 220, 0x1a1a20).setOrigin(0).setStrokeStyle(1, COLORS.panelBorder);
    const ph = this.scene.add.text(px + 150, Y + 194, m.name, textStyle(18, COLORS.textDim)).setOrigin(0.5);
    const desc = this.scene.add.text(px, Y + 324, m.desc || '　', textStyle(20, COLORS.text, { wordWrap: { width: 300, useAdvancedWrap: true }, lineSpacing: 6 }));
    this.dynamic.add([frame, ph, desc]);
  }
}
