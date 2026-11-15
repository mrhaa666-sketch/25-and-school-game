import Phaser from 'phaser';
import { SANITY_COST, GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { GameState } from '../core/GameState';
import { isContactGarbled } from '../core/progress';
import { tRaw, tUi } from '../core/text';
import { Audio } from './audio';
import type { Modal, UiAction } from './Modal';
import { COLORS, garble, panel, textStyle } from './style';

interface Contact {
  id: string;
  name: string;
}

type Mode = 'list' | 'actions' | 'busy';

const W = 380;
const H = 560;
const X = (GAME_WIDTH - W) / 2;
const Y = (GAME_HEIGHT - H) / 2;

/**
 * 手机（交接文档 2.2）。发消息、打电话一律失败。
 * 第一次打电话不扣精神值，之后每次 -2。
 */
export class PhoneUI implements Modal {
  private readonly root: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly status: Phaser.GameObjects.Text;
  private mode: Mode = 'list';
  private cursor = 0;
  private actionCursor = 0;
  private busyTimer?: Phaser.Time.TimerEvent;
  /** 终周目结尾，名字逐个恢复时使用（M5） */
  readonly restored = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {
    const bg = panel(scene, X, Y, W, H, 0.97);
    bg.fillStyle(0x1b1b22, 1).fillRect(X + 16, Y + 16, W - 32, 2);
    this.title = scene.add.text(X + 28, Y + 34, tUi('phoneTitle'), textStyle(22, COLORS.textDim));
    this.status = scene.add.text(X + W / 2, Y + H - 70, '', textStyle(22, COLORS.text)).setOrigin(0.5);
    this.root = scene.add.container(0, 0, [bg, this.title, this.status]).setDepth(950).setVisible(false);
    for (let i = 0; i < 6; i++) {
      const t = scene.add.text(X + 40, Y + 100 + i * 52, '', textStyle(26));
      // 鼠标指到哪一行就选中哪一行，点一下（等于空格）确认
      t.setInteractive({ useHandCursor: true }).on('pointerover', () => {
        if (!t.text) return;
        if (this.mode === 'list' && i !== this.cursor) this.cursor = i;
        else if (this.mode === 'actions' && i >= 2 && i - 2 !== this.actionCursor) this.actionCursor = i - 2;
        else return;
        this.render();
      });
      this.rows.push(t);
      this.root.add(t);
    }
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  private contacts(): Contact[] {
    return tRaw<Contact[]>('contacts');
  }

  private displayName(c: Contact, index: number): string {
    const s = GameState.save;
    if (!isContactGarbled(s, c.id) || this.restored.has(c.id)) return c.name;
    return garble(c.name.length + 2, index * 31 + s.cycleCount);
  }

  open(): void {
    this.mode = 'list';
    this.cursor = 0;
    this.status.setText('');
    this.root.setVisible(true);
    this.render();
  }

  close(): void {
    this.busyTimer?.remove();
    this.busyTimer = undefined;
    this.root.setVisible(false);
  }

  handle(action: UiAction): void {
    if (this.mode === 'busy') {
      if (action === 'back') this.endBusy();
      return;
    }
    if (this.mode === 'list') {
      const n = this.contacts().length;
      if (action === 'up') this.cursor = (this.cursor + n - 1) % n;
      if (action === 'down') this.cursor = (this.cursor + 1) % n;
      if (action === 'confirm') {
        this.mode = 'actions';
        this.actionCursor = 0;
      }
      if (action === 'back') return this.close();
    } else if (this.mode === 'actions') {
      if (action === 'up' || action === 'down') this.actionCursor = 1 - this.actionCursor;
      if (action === 'back') this.mode = 'list';
      if (action === 'confirm') return this.actionCursor === 0 ? this.sendMessage() : this.call();
    }
    this.render();
  }

  /** 外部改了状态（名字恢复）后重画 */
  refresh(): void {
    if (this.isOpen) this.render();
  }

  private sendMessage(): void {
    this.mode = 'busy';
    this.renderBusy('……');
    this.busyTimer = this.scene.time.delayedCall(900, () => {
      this.status.setColor('#a04040').setText(tUi('phoneSendFailed'));
      Audio.play('phone_fail');
      this.busyTimer = this.scene.time.delayedCall(1300, () => this.endBusy());
    });
  }

  private call(): void {
    const s = GameState.save;
    if (s.phoneCallsThisCycle >= 1) GameState.deductSanity(SANITY_COST.phoneCall, 'phone');
    GameState.patch({ phoneCallsThisCycle: s.phoneCallsThisCycle + 1 });
    this.mode = 'busy';
    this.renderBusy(tUi('phoneCalling'));
    Audio.play('phone_dial');
    // 电话没有声音。屏幕上只有计时，几秒后自己断掉。
    let sec = 0;
    this.busyTimer = this.scene.time.addEvent({
      delay: 1000,
      repeat: 3,
      callback: () => {
        sec++;
        if (sec < 4) this.status.setText(`00:0${sec}`);
        else {
          this.status.setText(tUi('phoneCallEnded'));
          this.busyTimer = this.scene.time.delayedCall(900, () => this.endBusy());
        }
      },
    });
  }

  private endBusy(): void {
    this.busyTimer?.remove();
    this.busyTimer = undefined;
    this.mode = 'actions';
    this.status.setText('').setColor(COLORS.text);
    this.render();
  }

  private renderBusy(msg: string): void {
    const c = this.contacts()[this.cursor];
    this.rows.forEach((r) => r.setText(''));
    this.rows[1].setText(this.displayName(c, this.cursor)).setColor(COLORS.highlight).setX(X + W / 2).setOrigin(0.5, 0);
    this.status.setColor(COLORS.text).setText(msg);
  }

  private render(): void {
    this.rows.forEach((r) => r.setText('').setX(X + 40).setOrigin(0, 0));
    const contacts = this.contacts();
    if (this.mode === 'list') {
      contacts.forEach((c, i) => {
        const sel = i === this.cursor;
        this.rows[i].setText(`${sel ? '›  ' : '   '}${this.displayName(c, i)}`).setColor(sel ? COLORS.highlight : COLORS.text);
      });
    } else {
      const c = contacts[this.cursor];
      this.rows[0].setText(this.displayName(c, this.cursor)).setColor(COLORS.textDim);
      [tUi('phoneMessage'), tUi('phoneCall')].forEach((label, i) => {
        const sel = i === this.actionCursor;
        this.rows[i + 2].setText(`${sel ? '›  ' : '   '}${label}`).setColor(sel ? COLORS.highlight : COLORS.text);
      });
    }
  }
}
