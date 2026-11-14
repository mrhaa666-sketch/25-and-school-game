import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { parseLine, tUi } from '../core/text';
import { poseImage } from '../systems/sprites';
import { COLORS, textStyle } from '../systems/style';

export interface StoryData {
  /** 顶部小标题，例如「结局 3 · 收上去的绳子」 */
  header?: string;
  /** 开场先在屏幕中央短暂显示的大字（大门的 ⭐/？ 进度） */
  flash?: string;
  lines: string[];
  /** 句子上方显示的一张图（素材 key），缺失就不显示 */
  image?: string;
  /** 全屏背景图（素材 key），压暗显示 */
  bg?: string;
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
  private bgImage!: Phaser.GameObjects.Image;
  private bgShade!: Phaser.GameObjects.Rectangle;
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
    this.bgImage = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false);
    this.bgShade = this.add.rectangle(0, GAME_HEIGHT / 2 - 90, GAME_WIDTH, 260, 0x000000, 0.45).setOrigin(0).setVisible(false);
    if (this.data_.bg) this.setBg(this.data_.bg, false);
    if (this.data_.header) {
      this.add.text(GAME_WIDTH / 2, 120, this.data_.header, textStyle(20, COLORS.textDim)).setOrigin(0.5);
    }
    this.body = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', textStyle(28, COLORS.text, { align: 'center', wordWrap: { width: 900, useAdvancedWrap: true }, lineSpacing: 10 }))
      .setOrigin(0.5);
    if (this.data_.image && this.textures.exists(this.data_.image)) {
      const img = poseImage(this, this.data_.image, 150);
      img?.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10).setAlpha(0);
      if (img) this.tweens.add({ targets: img, alpha: 0.9, duration: 1600, delay: 300 });
      this.body.setY(GAME_HEIGHT / 2 + 70);
    }
    this.speaker = this.add.text(GAME_WIDTH / 2, this.body.y - 50, '', textStyle(16, '#8a8296')).setOrigin(0.5);
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

  /** 换背景（台词里写 "#bg 素材key" 就会切换；"#bg" 后面不写则变回黑屏） */
  private setBg(key: string, fade = true): void {
    const show = !!key && this.textures.exists(key);
    const apply = () => {
      if (show) this.bgImage.setTexture(key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setTint(0x8a8a8a);
      this.bgImage.setVisible(show);
      this.bgShade.setVisible(show); // 文字区压暗，保证看得清
    };
    if (!fade) return apply();
    this.tweens.add({ targets: this.bgImage, alpha: 0, duration: 700, onComplete: () => {
      apply();
      this.bgImage.setAlpha(0);
      this.tweens.add({ targets: this.bgImage, alpha: 1, duration: 1400 });
    } });
  }

  private next(): void {
    if (!this.ready || this.finished) return;
    this.index++;
    // 指令行：切换背景，然后直接显示下一句
    while (this.index < this.data_.lines.length && this.data_.lines[this.index].startsWith('#bg')) {
      this.setBg(this.data_.lines[this.index].slice(3).trim());
      this.index++;
    }
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
