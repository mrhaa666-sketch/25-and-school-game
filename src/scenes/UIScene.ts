import Phaser from 'phaser';
import { EV, GameState } from '../core/GameState';
import { GAME_WIDTH } from '../core/constants';
import { getMaterial } from '../core/progress';
import { cycleCountLabel, tUi } from '../core/text';
import { tex } from '../systems/sprites';
import { textStyle } from '../systems/style';
import { DialogueBox } from '../systems/DialogueBox';
import { InventoryUI } from '../systems/InventoryUI';
import { ListMenu } from '../systems/ListMenu';
import type { Modal, UiAction } from '../systems/Modal';
import { PhoneUI } from '../systems/PhoneUI';
import { SanityHUD } from '../systems/SanityHUD';
import { ScreenText } from '../systems/ScreenText';
import { VisualFilter } from '../systems/VisualFilter';
import { buildDebugMenu, debugEnabled } from './debug';
import { goToTitle } from './flow';

/** 游戏场景实现这个接口，UI 场景把「调查」按键转发给它 */
export interface PlayTarget {
  readonly sys: Phaser.Scenes.Systems;
  onInteract(): void;
  /** 是否允许打开手机/背包（演出中可以关掉） */
  allowMenus?(): boolean;
}

export const UI_KEY = 'UI';

const KEY_ACTIONS: Record<string, UiAction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'confirm',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Escape: 'back',
  Backspace: 'back',
};

/**
 * 常驻在游戏场景上层的 UI：精神值条、屏幕文字、滤镜、对话框、手机、背包、暂停。
 * 所有按键都先经过这里，再决定是给 UI 还是转发给游戏场景，避免同一次按键被处理两次。
 */
export class UIScene extends Phaser.Scene {
  private hud!: SanityHUD;
  private screenText!: ScreenText;
  private filter!: VisualFilter;
  private dialogueBox!: DialogueBox;
  private phone!: PhoneUI;
  private bag!: InventoryUI;
  private pause!: ListMenu;
  private debug?: ListMenu;
  private cycleLabel!: Phaser.GameObjects.Text;
  private flashSlot = 0;
  private activeModal: Modal | null = null;
  private target: PlayTarget | null = null;

  constructor() {
    super(UI_KEY);
  }

  create(): void {
    this.filter = new VisualFilter(this);
    this.screenText = new ScreenText(this);
    this.hud = new SanityHUD(this);
    // 右上角：第几周目（补充周目显示「第五周目」……）。终周目隐藏
    this.cycleLabel = this.add.text(GAME_WIDTH - 28, 22, '', textStyle(16, '#6a6660')).setOrigin(1, 0).setDepth(800);
    this.dialogueBox = new DialogueBox(this);
    this.phone = new PhoneUI(this);
    this.bag = new InventoryUI(this);
    this.pause = new ListMenu(this, tUi('pauseTitle'), [
      { label: tUi('resume'), action: () => this.closeModal() },
      {
        label: tUi('toTitle'),
        action: () => {
          this.closeModal();
          GameState.persist();
          goToTitle(this);
        },
      },
    ], 360, () => this.closeModal());
    if (debugEnabled()) this.debug = buildDebugMenu(this, () => this.closeModal());

    const onSanity = () => this.screenText.reschedule(this.time.now);
    GameState.events.on(EV.sanity, onSanity);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => GameState.events.off(EV.sanity, onSanity));

    const kb = this.input.keyboard!;
    kb.addCapture('TAB,SPACE,UP,DOWN,LEFT,RIGHT,F2');
    kb.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  update(time: number, delta: number): void {
    this.hud.update(delta);
    const s = GameState.save;
    this.cycleLabel.setVisible(s.cycle !== 'final').setText(cycleCountLabel(s.cycleCount));
    this.filter.update(time);
    this.screenText.update(time);
  }

  // ------------------------------------------------------------ 对外接口

  setTarget(target: PlayTarget | null): void {
    this.target = target;
    this.closeModal();
  }

  /** 是否有界面挡住玩家操作 */
  isBlocking(): boolean {
    return this.activeModal !== null || this.dialogueBox.isOpen;
  }

  say(lines: string | string[], onDone?: () => void): void {
    this.dialogueBox.show(lines, onDone);
  }

  /** 用 Promise 写演出脚本更顺手：await ui.sayAsync([...]) */
  sayAsync(lines: string | string[]): Promise<void> {
    return new Promise((resolve) => this.say(lines, resolve));
  }

  get phoneUI(): PhoneUI {
    return this.phone;
  }

  /**
   * 终周目：经过材料所在的地方时，背包里的材料亮一下。
   * 在画面右上角浮现材料的小图和名字，再淡出。
   */
  flashMaterials(ids: string[]): void {
    ids.forEach((id, i) => {
      const m = getMaterial(id);
      if (!m) return;
      const y = 70 + this.flashSlot * 64;
      this.flashSlot = (this.flashSlot + 1) % 4;
      const x = GAME_WIDTH - 40;
      const parts: Phaser.GameObjects.GameObject[] = [];
      const glow = this.add.circle(x - 34, y + 22, 30, 0xd8e4ff, 0.18).setBlendMode(Phaser.BlendModes.ADD);
      parts.push(glow);
      if (this.textures.exists(tex('mat', id))) parts.push(this.add.image(x - 34, y + 22, tex('mat', id)).setDisplaySize(60, 44));
      parts.push(this.add.text(x - 74, y + 22, m.name, textStyle(14, '#c8d0e0')).setOrigin(1, 0.5));
      const c = this.add.container(0, 0, parts).setDepth(820).setAlpha(0);
      this.tweens.chain({
        targets: c,
        tweens: [
          { alpha: 1, duration: 700, delay: i * 500 },
          { alpha: 1, duration: 1600 },
          { alpha: 0, duration: 1200 },
        ],
        onComplete: () => c.destroy(),
      });
      this.tweens.add({ targets: glow, scale: 1.4, alpha: 0.05, duration: 900, yoyo: true, repeat: 1, delay: i * 500 });
    });
  }

  /** 终周目结尾：打开手机，通讯录里的名字一个一个变回来 */
  restoreContacts(): Promise<void> {
    return new Promise((resolve) => {
      this.openModal(this.phone);
      const order = ['kanade', 'mizuki', 'ena']; // 和变成乱码的顺序相反
      order.forEach((id, i) =>
        this.time.delayedCall(1300 + i * 1300, () => {
          this.phone.restored.add(id);
          this.phone.refresh();
        }),
      );
      this.time.delayedCall(1300 + order.length * 1300 + 1200, () => {
        this.closeModal();
        resolve();
      });
    });
  }

  setScreenTextEnabled(on: boolean): void {
    this.screenText.enabled = on;
  }

  // ------------------------------------------------------------ 按键

  private onKey(e: KeyboardEvent): void {
    if (e.repeat && (e.code === 'Space' || e.code === 'Enter')) return;

    if (this.activeModal) {
      // 同一个快捷键可以再关掉对应界面
      if (
        (e.code === 'Tab' && this.activeModal === this.phone) ||
        (e.code === 'KeyI' && this.activeModal === this.bag) ||
        (e.code === 'F2' && this.activeModal === this.debug)
      ) {
        return this.closeModal();
      }
      const action = KEY_ACTIONS[e.code];
      if (action) {
        const modal = this.activeModal;
        modal.handle(action); // 菜单项本身可能已经关闭界面、甚至切换了场景
        if (this.activeModal === modal && !modal.isOpen) this.closeModal();
      }
      return;
    }

    if (this.dialogueBox.isOpen) {
      if (KEY_ACTIONS[e.code] === 'confirm') this.dialogueBox.advance();
      return;
    }

    const menusAllowed = this.target !== null && (this.target.allowMenus?.() ?? true);
    switch (e.code) {
      case 'Tab':
        if (menusAllowed) this.openModal(this.phone);
        return;
      case 'KeyI':
        if (menusAllowed) this.openModal(this.bag);
        return;
      case 'Escape':
        if (this.target) this.openModal(this.pause);
        return;
      case 'F2':
        if (this.debug) this.openModal(this.debug);
        return;
    }
    if (KEY_ACTIONS[e.code] === 'confirm') this.target?.onInteract();
  }

  private openModal(m: Modal): void {
    this.activeModal = m;
    m.open();
    // 打开手机/背包/暂停时，游戏场景暂停（计时、追逐、停留扣除都会停下）
    if (this.target && this.target.sys.isActive()) this.scene.pause(this.target.sys.settings.key);
  }

  closeModal(): void {
    if (this.activeModal?.isOpen) this.activeModal.close();
    this.activeModal = null;
    if (this.target && this.target.sys.isPaused()) this.scene.resume(this.target.sys.settings.key);
  }
}
