import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TIMERS } from '../core/constants';
import type { UiAction } from './Modal';
import { textStyle } from './style';

export type ExamResult = { kind: 'answer'; index: number } | { kind: 'blank' } | { kind: 'refuse' };

export interface ExamTexts {
  question: string;
  options: string[];
  blankPrompt: string;
  yes: string;
  no: string;
}

/**
 * 考场试卷（第五幕）。
 * 任何时候选一个选项 → answer；10 秒不选 → 出现「交白卷吗？」与「交 / 不交」。
 * showCountdown：补充周目的提示，挂钟的 10 秒倒计时清楚可见。
 */
export class ExamUI {
  private readonly root: Phaser.GameObjects.Container;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private cursor = 0;
  private elapsed = 0;
  private promptShown = false;
  private resolve?: (r: ExamResult) => void;
  private readonly onUpdate = (_t: number, delta: number) => this.tick(delta);

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly t: ExamTexts,
    private readonly showCountdown: boolean,
  ) {
    const W = 560;
    const H = 600;
    const X = (GAME_WIDTH - W) / 2;
    const Y = (GAME_HEIGHT - H) / 2;
    const paper = scene.add.rectangle(X, Y, W, H, 0xe9e4d8).setOrigin(0);
    const lines = scene.add.graphics();
    lines.lineStyle(1, 0xc9c2b2, 1);
    for (let y = Y + 140; y < Y + H - 20; y += 34) lines.lineBetween(X + 30, y, X + W - 30, y);
    const q = scene.add.text(X + 40, Y + 50, t.question, textStyle(26, '#1a1814'));
    this.root = scene.add.container(0, 0, [paper, lines, q]).setDepth(980).setScrollFactor(0).setVisible(false);
    for (let i = 0; i < t.options.length + 2; i++) {
      const row = scene.add.text(X + 70, Y + 150 + i * 56, '', textStyle(24, '#2a2620'));
      this.rows.push(row);
      this.root.add(row);
    }
    this.prompt = scene.add.text(X + W / 2, Y + 150 + t.options.length * 56 + 20, t.blankPrompt, textStyle(24, '#5a1010')).setOrigin(0.5, 0).setVisible(false);
    this.countdown = scene.add.text(X + W - 40, Y + 20, '', textStyle(18, '#7a2020')).setOrigin(1, 0);
    this.root.add([this.prompt, this.countdown]);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  open(): Promise<ExamResult> {
    this.cursor = 0;
    this.elapsed = 0;
    this.promptShown = false;
    this.prompt.setVisible(false);
    this.root.setVisible(true);
    this.render();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    return new Promise((r) => (this.resolve = r));
  }

  private close(result: ExamResult): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    this.root.setVisible(false);
    const r = this.resolve;
    this.resolve = undefined;
    r?.(result);
  }

  private itemCount(): number {
    return this.t.options.length + (this.promptShown ? 2 : 0);
  }

  handle(action: UiAction): void {
    if (!this.isOpen) return;
    const n = this.itemCount();
    if (action === 'up') this.cursor = (this.cursor + n - 1) % n;
    if (action === 'down') this.cursor = (this.cursor + 1) % n;
    if (action === 'confirm') {
      if (this.cursor < this.t.options.length) return this.close({ kind: 'answer', index: this.cursor });
      return this.close(this.cursor === this.t.options.length ? { kind: 'blank' } : { kind: 'refuse' });
    }
    this.render();
  }

  private tick(delta: number): void {
    this.elapsed += delta;
    const limit = TIMERS.examBlankPromptSec * 1000;
    if (this.showCountdown && !this.promptShown) {
      this.countdown.setText(String(Math.max(0, Math.ceil((limit - this.elapsed) / 1000))));
    } else this.countdown.setText('');
    if (!this.promptShown && this.elapsed >= limit) {
      this.promptShown = true;
      this.prompt.setVisible(true);
      this.cursor = this.t.options.length; // 光标移到「交」
      this.render();
    }
  }

  private render(): void {
    const labels = [...this.t.options.map((o, i) => `${'ABCD'[i] ?? ''}．${o}`)];
    this.rows.forEach((r) => r.setText(''));
    labels.forEach((l, i) => this.rows[i].setText(`${i === this.cursor ? '›  ' : '   '}${l}`).setColor(i === this.cursor ? '#000000' : '#5a554c'));
    if (this.promptShown) {
      const base = this.t.options.length;
      [this.t.yes, this.t.no].forEach((l, j) => {
        const i = base + j;
        const row = this.rows[i];
        row.setY(this.prompt.y + 50 + j * 44).setText(`${i === this.cursor ? '›  ' : '   '}${l}`).setColor(i === this.cursor ? '#000000' : '#5a554c');
      });
    }
  }
}

