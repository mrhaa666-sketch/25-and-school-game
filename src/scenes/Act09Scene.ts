import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TIMERS } from '../core/constants';
import { makeNoteMonster } from '../systems/figures';
import { panel, textStyle } from '../systems/style';
import { actKey, startAct, triggerEnding } from './flow';
import { startNoise } from './noise';
import { RoomScene } from './RoomScene';

/**
 * 第九幕 · 邀请。怪物们唱着歌，邀请真冬加入。
 * 「不同意」只在前 3 秒正常显示，之后扭曲、抖动、颜色反转，定格为第二个「同意」。
 * 同意 → 结局 8；3 秒内选不同意 → 离开音乐室 → 第十幕。
 */
export class Act09Scene extends RoomScene {
  private choosing = false;
  private cursor = 0;
  private elapsed = 0;
  private eaten = false;
  private buttons: Phaser.GameObjects.Text[] = [];
  private stopNoise?: () => void;

  constructor() {
    super(actKey(9));
  }

  protected onObject(): void {}

  create(): void {
    super.create();
    this.choosing = false;
    this.cursor = 0;
    this.elapsed = 0;
    this.eaten = false;
    this.buttons = [];
    this.loadRoom('music_room');
    const k = this.objectCenter('k');
    this.pos.set(k.x - 60, k.y + 90);
    this.facing = 'up';
    this.syncPlayer();
    this.locked = true;
    this.stopNoise = startNoise(this, 0.6);
    this.events.once('shutdown', () => this.stopNoise?.());

    // 包围着真冬的音符怪物，慢慢转圈
    const notes = Array.from({ length: 8 }, (_, i) => ({ n: makeNoteMonster(this, 0, 0).setDepth(115), a: (i / 8) * Math.PI * 2 }));
    const orbit = (_t: number, d: number) => {
      notes.forEach((o) => {
        o.a += d * 0.0004;
        o.n.setPosition(this.pos.x + Math.cos(o.a) * 80, this.pos.y + Math.sin(o.a) * 50 + Math.sin(o.a * 5) * 4);
      });
    };
    this.events.on('update', orbit);
    this.events.once('shutdown', () => this.events.off('update', orbit));
    // 歌声
    this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        const words = ['♪', '加入我们', '一起来玩', '♪'];
        const t = this.add.text(this.pos.x + Phaser.Math.Between(-140, 140), this.pos.y - Phaser.Math.Between(60, 140), Phaser.Utils.Array.GetRandom(words), textStyle(16, '#6a6660')).setDepth(116);
        this.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 1800, onComplete: () => t.destroy() });
      },
    });

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (!this.choosing || this.ui.isBlocking()) return;
      if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
        this.cursor = 1 - this.cursor;
        this.renderButtons();
      }
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
    void this.cutscene(async () => {
      await this.say(this.text('act09.sing'));
    }).then(() => this.openChoice());
  }

  allowMenus(): boolean {
    return !this.choosing && super.allowMenus();
  }

  private openChoice(): void {
    this.locked = true;
    const y = GAME_HEIGHT - 150;
    this.add.existing(panel(this, GAME_WIDTH / 2 - 260, y - 50, 520, 100, 0.92).setDepth(900));
    const agree = this.textOne('act09.agree');
    const refuse = this.textOne('act09.refuse');
    this.buttons = [
      this.add.text(GAME_WIDTH / 2 - 120, y, agree, textStyle(30)).setOrigin(0.5).setDepth(901),
      this.add.text(GAME_WIDTH / 2 + 120, y, refuse, textStyle(30)).setOrigin(0.5).setDepth(901),
    ];
    this.cursor = 0; // 默认停在「同意」上
    this.choosing = true;
    this.renderButtons();
  }

  private renderButtons(): void {
    this.buttons.forEach((b, i) => {
      if (this.eaten && i === 1) return;
      b.setColor(i === this.cursor ? '#ffffff' : '#6a6660').setScale(i === this.cursor ? 1.1 : 1);
    });
  }

  onInteract(): void {
    if (!this.choosing || this.ui.isBlocking()) return;
    this.choosing = false;
    const refused = this.cursor === 1 && !this.eaten;
    if (refused) {
      void this.cutscene(async () => {
        this.buttons.forEach((b) => b.destroy());
        await this.say(this.text('act09.leave'));
        startAct(this, 10);
      });
    } else {
      this.locked = true;
      this.cameras.main.fadeOut(1600, 0, 0, 0);
      this.time.delayedCall(1700, () => triggerEnding(this, 8));
    }
  }

  protected onUpdate(_time: number, delta: number): void {
    if (!this.choosing || this.eaten) return;
    this.elapsed += delta;
    const limit = TIMERS.inviteRefuseSec * 1000;
    const b = this.buttons[1];
    // 最后一秒开始抖
    if (this.elapsed > limit - 1000) b.setPosition(GAME_WIDTH / 2 + 120 + Phaser.Math.Between(-2, 2), GAME_HEIGHT - 150 + Phaser.Math.Between(-1, 1));
    if (this.elapsed >= limit) void this.eatRefuse();
  }

  /** 「不同意」被吃掉：字形抖动、错位、颜色反转，定格为「同意」 */
  private async eatRefuse(): Promise<void> {
    this.eaten = true;
    const b = this.buttons[1];
    const agree = this.textOne('act09.agree');
    const refuse = this.textOne('act09.refuse');
    const glitch = ['不同意', '不冋意', '丕同意', '　同意', '不同', '同意'];
    for (let i = 0; i < 12; i++) {
      b.setText(i < 10 ? Phaser.Utils.Array.GetRandom(glitch.concat(refuse)) : agree);
      b.setPosition(GAME_WIDTH / 2 + 120 + Phaser.Math.Between(-10, 10), GAME_HEIGHT - 150 + Phaser.Math.Between(-6, 6));
      b.setColor(i % 2 ? '#000000' : '#ffffff').setBackgroundColor(i % 2 ? '#ffffff' : '#000000');
      b.setAngle(Phaser.Math.Between(-6, 6));
      await this.wait(70);
    }
    b.setText(agree).setPosition(GAME_WIDTH / 2 + 120, GAME_HEIGHT - 150).setAngle(0).setBackgroundColor('#00000000');
    this.renderButtons();
    b.setColor(this.cursor === 1 ? '#ffffff' : '#6a6660');
  }
}
