import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import type { Modal, UiAction } from './Modal';
import { COLORS, panel, textStyle } from './style';

export interface MenuItem {
  label: string | (() => string);
  action: () => void;
}

/** 居中的竖排菜单，暂停菜单和调试面板共用 */
export class ListMenu implements Modal {
  private readonly root: Phaser.GameObjects.Container;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private cursor = 0;

  constructor(
    scene: Phaser.Scene,
    title: string,
    private readonly items: MenuItem[],
    width = 420,
    private readonly onBack?: () => void,
  ) {
    const h = 110 + items.length * 46;
    const x = (GAME_WIDTH - width) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const bg = panel(scene, x, y, width, h, 0.96);
    const t = scene.add.text(x + 32, y + 26, title, textStyle(22, COLORS.textDim));
    this.root = scene.add.container(0, 0, [bg, t]).setDepth(980).setVisible(false);
    items.forEach((_, i) => {
      const row = scene.add.text(x + 40, y + 80 + i * 46, '', textStyle(22));
      // 鼠标指到哪一项就选中哪一项，点一下（等于空格）确认
      row.setInteractive({ useHandCursor: true }).on('pointerover', () => {
        this.cursor = i;
        this.render();
      });
      this.rows.push(row);
      this.root.add(row);
    });
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
    const n = this.items.length;
    if (action === 'up') this.cursor = (this.cursor + n - 1) % n;
    if (action === 'down') this.cursor = (this.cursor + 1) % n;
    if (action === 'back') {
      this.close();
      this.onBack?.();
      return;
    }
    if (action === 'confirm') {
      this.items[this.cursor].action();
      if (this.isOpen) this.render();
      return;
    }
    this.render();
  }

  private render(): void {
    this.items.forEach((item, i) => {
      const sel = i === this.cursor;
      const label = typeof item.label === 'function' ? item.label() : item.label;
      this.rows[i].setText(`${sel ? '›  ' : '   '}${label}`).setColor(sel ? COLORS.highlight : COLORS.text);
    });
  }
}
