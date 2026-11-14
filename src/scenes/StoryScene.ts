import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { parseLine, tUi } from '../core/text';
import { COLORS, textStyle } from '../systems/style';

export interface StoryData {
  /** 顶部小标题，例如「结局 3 · 收上去的绳子」 */
  header?: string;
  /** 开场先在屏幕中央短暂显示的大字（大门的 ⭐/？ 进度） */
  flash?: string;
  lines: string[];
  onDone: (scene: Phaser.Scene) => void;
}

/**
 * 黑屏 + 居中短句的演出场景。用于第一幕、结局、周目过渡等。
 * 正式演出做好之前，这些地方都先用它占位。
 */
export class StoryScene extends Phaser.Scene {
  private data_!: StoryData;
  private index = -1;
  private body!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private speaker!: Phaser.GameObjects.Text;
  private ready = false;
  private finished = false;

  constructor() {
    super('Story');
  }

  init(data: StoryData): void {
    this.data_ = data;
    this.index = -1;
    this.ready = false;
    this.finished = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    if (this.data_.header) {
      this.add.text(GAME_WIDTH / 2, 120, this.data_.header, textStyle(20, COLORS.textDim)).setOrigin(0.5);
    }
    this.body = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', textStyle(28, COLORS.text, { align: 'center', wordWrap: { width: 900, useAdvancedWrap: true }, lineSpacing: 10 }))
      .setOrigin(0.5);
    this.speaker = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, '', textStyle(16, '#8a8296')).setOrigin(0.5);
    this.hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, tUi('pressToContinue'), textStyle(14, '#4a4844')).setOrigin(0.5).setAlpha(0);

    const kb = this.input.keyboard!;
    kb.addCapture('SPACE');
    kb.on('keydown-SPACE', () => this.next());
    kb.on('keydown-ENTER', () => this.next());

    this.cameras.main.fadeIn(600, 0, 0, 0);
    if (this.data_.flash) {
      const f = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.data_.flash, textStyle(56, '#ffffff')).setOrigin(0.5).setAlpha(0);
      this.tweens.chain({
        targets: f,
        tweens: [
          { alpha: 1, duration: 500 },
          { alpha: 1, duration: 1400 },
          { alpha: 0, duration: 500 },
        ],
        onComplete: () => this.start(),
      });
    } else {
      this.time.delayedCall(500, () => this.start());
    }
  }

  private start(): void {
    this.ready = true;
    this.next();
  }

  private next(): void {
    if (!this.ready || this.finished) return;
    this.index++;
    if (this.index >= this.data_.lines.length) {
      this.finished = true;
      this.cameras.main.fadeOut(700, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.data_.onDone(this));
      return;
    }
    const { speaker, text } = parseLine(this.data_.lines[this.index]);
    this.body.setText(text).setAlpha(0);
    this.speaker.setText(speaker ?? '').setAlpha(0);
    this.tweens.add({ targets: [this.body, this.speaker], alpha: 1, duration: 400 });
    this.hint.setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 1, delay: 1200, duration: 600 });
  }
}
