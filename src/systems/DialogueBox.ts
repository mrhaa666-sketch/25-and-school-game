import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { panel, textStyle } from './style';

/**
 * 底部的短文本框。台词都很短，一次显示一行，空格/回车翻页。
 */
export class DialogueBox {
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Text;
  private lines: string[] = [];
  private index = 0;
  private onDone?: () => void;
  private openedAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const w = 900;
    const h = 110;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT - h - 28;
    this.body = scene.add.text(x + 32, y + 26, '', textStyle(24, undefined, { wordWrap: { width: w - 64, useAdvancedWrap: true }, lineSpacing: 8 }));
    this.arrow = scene.add.text(x + w - 36, y + h - 34, '▼', textStyle(16, '#7d7a74'));
    scene.tweens.add({ targets: this.arrow, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.root = scene.add.container(0, 0, [panel(scene, x, y, w, h), this.body, this.arrow]);
    this.root.setDepth(900).setVisible(false);
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  show(lines: string | string[], onDone?: () => void): void {
    this.lines = Array.isArray(lines) ? lines : [lines];
    this.index = 0;
    this.onDone = onDone;
    this.openedAt = this.scene.time.now;
    this.root.setVisible(true);
    this.render();
  }

  /** 返回 true 表示消费了这次按键 */
  advance(): boolean {
    if (!this.isOpen) return false;
    if (this.scene.time.now - this.openedAt < 150) return true; // 防止同一次按键连跳
    this.index++;
    if (this.index >= this.lines.length) {
      this.root.setVisible(false);
      const cb = this.onDone;
      this.onDone = undefined;
      cb?.();
    } else {
      this.openedAt = this.scene.time.now;
      this.render();
    }
    return true;
  }

  private render(): void {
    this.body.setText(this.lines[this.index] ?? '');
  }
}
