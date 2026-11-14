import Phaser from 'phaser';
import { EV, GameState, type SanityChange } from '../core/GameState';
import { sanityTier, type SanityTier } from '../core/progress';
import { tUi } from '../core/text';
import { garble, textStyle } from './style';

const BAR_X = 28;
const BAR_Y = 30;
const BAR_W = 220;
const BAR_H = 10;

/** 档位 → 精神值条颜色（档位 1~2 灰白，3 发白，4 暗红） */
const TIER_COLOR: Record<SanityTier, number> = { 1: 0xb8b6b0, 2: 0xb8b6b0, 3: 0xffffff, 4: 0x8b1a1a };

/**
 * 左上角常驻的精神值条（交接文档 2.1 UI 显示）。
 */
export class SanityHUD {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private shown = GameState.save.sanity;
  private jitterTimer = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.bar = scene.add.graphics();
    this.label = scene.add.text(BAR_X + BAR_W + 14, BAR_Y - 8, '', textStyle(18));
    this.root = scene.add.container(0, 0, [this.bar, this.label]).setDepth(800);

    const onSanity = (c: SanityChange) => this.onChange(c);
    const onState = () => {
      this.shown = GameState.save.sanity;
      this.refresh();
    };
    GameState.events.on(EV.sanity, onSanity);
    GameState.events.on(EV.state, onState);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      GameState.events.off(EV.sanity, onSanity);
      GameState.events.off(EV.state, onState);
    });
    this.refresh();
  }

  update(dt: number): void {
    const visible = !GameState.isFinal; // 终周目隐藏
    this.root.setVisible(visible);
    if (!visible) return;

    // 档位 4：条轻微抖动，数字偶尔错位成乱码
    if (sanityTier(this.shown) === 4) {
      this.jitterTimer -= dt;
      this.root.setPosition(Phaser.Math.Between(-1, 1), Phaser.Math.Between(-1, 1));
      if (this.jitterTimer <= 0) {
        this.jitterTimer = Phaser.Math.Between(400, 1400);
        if (Math.random() < 0.35) {
          this.label.setText(`${tUi('sanityLabel')} ${garble(2, Math.floor(Math.random() * 999))}`);
          this.scene.time.delayedCall(120, () => this.refreshLabel());
        }
      }
    } else {
      this.root.setPosition(0, 0);
    }
  }

  private onChange(c: SanityChange): void {
    this.shown = c.value;
    this.refresh();
    // 闪烁
    this.scene.tweens.add({ targets: this.bar, alpha: 0.15, duration: 90, yoyo: true, repeat: 2 });
    // 浮出扣除数值
    if (c.delta < 0) {
      const t = this.scene.add
        .text(BAR_X + BAR_W + 90, BAR_Y - 8, `${c.delta}`, textStyle(18, '#c23b3b'))
        .setDepth(801);
      this.scene.tweens.add({ targets: t, y: t.y - 18, alpha: 0, delay: 500, duration: 700, onComplete: () => t.destroy() });
    }
  }

  private refreshLabel(): void {
    this.label.setText(`${tUi('sanityLabel')} ${this.shown}`);
  }

  private refresh(): void {
    const tier = sanityTier(this.shown);
    const color = TIER_COLOR[tier];
    this.bar.clear();
    this.bar.fillStyle(0x000000, 0.6).fillRect(BAR_X - 2, BAR_Y - 2, BAR_W + 4, BAR_H + 4);
    this.bar.lineStyle(1, 0x55555c, 1).strokeRect(BAR_X - 2.5, BAR_Y - 2.5, BAR_W + 5, BAR_H + 5);
    this.bar.fillStyle(color, 1).fillRect(BAR_X, BAR_Y, (BAR_W * this.shown) / 100, BAR_H);
    this.label.setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
    this.refreshLabel();
  }
}
