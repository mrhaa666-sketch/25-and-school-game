import Phaser from 'phaser';
import type { SoundKey } from '../systems/audio';
import { GAME_HEIGHT, GAME_WIDTH, MOVE, SANITY_COST } from '../core/constants';
import { GameState } from '../core/GameState';
import { makeFigure, PALETTE } from '../systems/figures';
import { textStyle } from '../systems/style';
import { actKey, startAct, triggerEnding } from './flow';
import { RoomScene } from './RoomScene';

/** 停下来听数数声超过这个时间就扣精神值（毫秒） */
const LISTEN_MS = 3000;

/**
 * 第七幕 · 管道。很长、很窄，只能爬。
 * 爬到一半，前方黑暗里传来真冬自己的声音在数数。出现岔路：
 *   没有声音的那条 → 一楼音乐室（第八幕）
 *   有数数声的那条 → 结局 7
 */
export class Act07Scene extends RoomScene {
  private heard = false;
  private forkSaid = false;
  private stillMs = 0;
  private listenedThisStop = false;
  private darkness?: Phaser.GameObjects.Image;
  private nextVoice = 0;

  constructor() {
    super(actKey(7));
  }

  create(): void {
    super.create();
    this.heard = false;
    this.forkSaid = false;
    this.stillMs = 0;
    this.listenedThisStop = false;
    this.nextVoice = 0;
    this.allowRun = false;
    // 爬行姿势
    this.setPlayerPose('mafuyu_crawl', () => makeFigure(this, 0, 0, { ...PALETTE.mafuyu, pose: 'crawl' }));
    this.loadRoom('pipe');
    this.facing = 'right';
    this.makeDarkness();
    this.cameras.main.fadeIn(800, 0, 0, 0);
    void this.cutscene(() => this.say(this.text('act07.enter')));
  }

  protected ambience(): SoundKey | null {
    return 'amb_pipe';
  }

  protected moveSpeed(): number {
    return MOVE.crawlSpeed;
  }

  protected onObject(): void {}

  /** 管道里很黑：只看得到身边一小圈 */
  private makeDarkness(): void {
    const key = 'pipe-dark';
    if (!this.textures.exists(key)) {
      const w = GAME_WIDTH * 2;
      const h = GAME_HEIGHT * 2;
      const tex = this.textures.createCanvas(key, w, h);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 230);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.97)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        tex.refresh();
      }
    }
    this.darkness = this.add.image(0, 0, key).setDepth(300);
  }

  private voiceText(x: number, y: number, alpha: number): void {
    const t = this.add.text(x, y, this.textOne('act07.counting'), textStyle(16, '#9a968e')).setOrigin(0.5).setDepth(310).setAlpha(0);
    this.tweens.chain({
      targets: t,
      tweens: [
        { alpha, duration: 700 },
        { alpha, duration: 1600 },
        { alpha: 0, duration: 900 },
      ],
      onComplete: () => t.destroy(),
    });
  }

  protected onUpdate(_time: number, delta: number): void {
    this.darkness?.setPosition(this.player.x, this.player.y - 10);
    // 爬行图朝右画的，往左爬时水平翻转
    const body = this.player.list[0];
    if (body instanceof Phaser.GameObjects.Image && (this.facing === 'left' || this.facing === 'right')) body.setFlipX(this.facing === 'left');
    const tile = this.playerTile();

    // 爬到一半，前方传来数数声（从下面那条岔路传来）
    if (!this.heard && tile.x >= 9) {
      this.heard = true;
      // 第一次听到：前方的黑暗里，有人在数数
      void this.cutscene(() => this.say(this.text('act07.counting_heard')));
    }
    if (this.heard) {
      this.nextVoice -= delta;
      if (this.nextVoice <= 0) {
        this.nextVoice = Phaser.Math.Between(3500, 5500);
        const src = this.tileCenter(24, 8);
        const d = Phaser.Math.Distance.Between(src.x, src.y, this.pos.x, this.pos.y);
        // 文字出现在声音来的方向，越近越清楚
        const ang = Phaser.Math.Angle.Between(this.pos.x, this.pos.y, src.x, src.y);
        const r = Math.min(d, 150);
        // 数数声：越靠近下面那条岔路越清楚
        this.voiceText(this.pos.x + Math.cos(ang) * r, this.pos.y - 20 + Math.sin(ang) * r, Phaser.Math.Clamp(1.2 - d / 700, 0.3, 1));
      }
      // 停下来听超过 3 秒：-5（每次停下只扣一次）
      if (!this.moving && !this.locked && !this.ui.isBlocking()) {
        this.stillMs += delta;
        if (this.stillMs >= LISTEN_MS && !this.listenedThisStop) {
          this.listenedThisStop = true;
          GameState.deductSanity(SANITY_COST.pipeCounting, 'pipe');
        }
      } else if (this.moving) {
        this.stillMs = 0;
        this.listenedThisStop = false;
      }
    }

    if (!this.forkSaid && tile.x >= 19) {
      this.forkSaid = true;
      void this.cutscene(() => this.say(this.text('act07.fork')));
    }
  }

  protected onExit(ch: string): boolean {
    if (ch === '1') {
      this.locked = true;
      startAct(this, 8);
      return true;
    }
    if (ch === '2') {
      this.locked = true;
      this.cameras.main.fadeOut(1500, 0, 0, 0);
      this.time.delayedCall(1600, () => triggerEnding(this, 7));
      return true;
    }
    return false;
  }
}
