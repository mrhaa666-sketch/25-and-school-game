import Phaser from 'phaser';
import { EV, GameState } from '../core/GameState';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { getMaterial } from '../core/progress';
import { Audio } from '../systems/audio';
import { saveSettings, settings } from '../core/settings';
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
  KeyF: 'confirm',
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
    this.objectiveText = undefined; // 场景重启后旧的文字对象已经销毁了
    this.heldText = undefined;
    this.phone = new PhoneUI(this);
    this.bag = new InventoryUI(this);
    this.pause = new ListMenu(this, tUi('pauseTitle'), [
      { label: tUi('resume'), action: () => this.closeModal() },
      { label: () => (Audio.muted ? tUi('soundOff') : tUi('soundOn')), action: () => Audio.toggleMute() },
      {
        label: () => `亮度：${['正常', '亮一些', '更亮'][settings.brightness]}`,
        action: () => {
          settings.brightness = ((settings.brightness + 1) % 3) as 0 | 1 | 2;
          saveSettings();
        },
      },
      {
        label: () => `减弱闪光和晃屏：${settings.calm ? '开' : '关'}`,
        action: () => {
          settings.calm = !settings.calm;
          saveSettings();
        },
      },
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

    const onSanity = (c: { delta: number; reason?: string }) => {
      this.screenText.reschedule(this.time.now);
      if (c.delta < 0 && c.reason !== 'act') Audio.play('sanity_drop');
    };
    GameState.events.on(EV.sanity, onSanity);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => GameState.events.off(EV.sanity, onSanity));

    const kb = this.input.keyboard!;
    kb.addCapture('TAB,SPACE,UP,DOWN,LEFT,RIGHT,F2');
    kb.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    // 鼠标点击怎么处理（见 main.ts）：在房间里自由走动时交给房间，其余等于按空格
    (window as unknown as { __clickMode?: () => string }).__clickMode = () => {
      if (!this.sys.isActive()) return 'space';
      if (this.activeModal || this.dialogueBox.isOpen) return 'space';
      const t = this.target as (PlayTarget & { clickMode?: () => string }) | null;
      if (t && t.sys.isActive() && t.clickMode) return t.clickMode();
      return 'space';
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      (window as unknown as { __clickMode?: () => string }).__clickMode = undefined;
    });
  }

  update(time: number, delta: number): void {
    this.hud.update(delta);
    // 精神值档位 4：心跳、音频失真
    const tier4 = !GameState.isFinal && GameState.save.sanity <= 25 && this.target !== null;
    Audio.loop('heart', tier4 ? 'heartbeat' : null, 1500);
    Audio.setDistorted(tier4);
    const s = GameState.save;
    // 不显示第几周目
    this.cycleLabel.setVisible(false).setText(cycleCountLabel(s.cycleCount));
    this.filter.update(time, this.registry.get('roomLit') === true);
    if (GameState.lastCheckpointAt > this.savedShownAt) {
      this.time.delayedCall(800, () => this.showSaved());
    }
    this.screenText.update(time);
  }

  // ------------------------------------------------------------ 对外接口

  setTarget(target: PlayTarget | null): void {
    this.target = target;
    this.closeModal();
  }

  private objectiveText?: Phaser.GameObjects.Text;
  private savedShownAt = 0;

  /** 右上角短暂显示「已存档」 */
  private showSaved(): void {
    const t = this.add.text(GAME_WIDTH - 28, 22, '已存档', textStyle(16, '#a8a090')).setOrigin(1, 0).setDepth(800).setAlpha(0);
    this.tweens.chain({ targets: t, tweens: [{ alpha: 1, duration: 400 }, { alpha: 1, duration: 1600 }, { alpha: 0, duration: 600 }], onComplete: () => t.destroy() });
  }

  /** 左上角「现在要做的事」。null 隐藏 */
  setObjective(text: string | null): void {
    if (!this.objectiveText || !this.objectiveText.active) {
      this.objectiveText = this.add
        .text(26, 58, '', { ...textStyle(19, '#e8e0d0'), backgroundColor: '#000000aa', padding: { x: 10, y: 6 } })
        .setDepth(800)
        .setAlpha(0);
    }
    const t = this.objectiveText;
    if (!text) {
      if (t.alpha > 0) this.tweens.add({ targets: t, alpha: 0, duration: 300 });
      t.setData('v', null);
      return;
    }
    if (t.getData('v') === text) return;
    t.setData('v', text);
    t.setText(`目标　${text}`).setAlpha(0);
    // 目标换了：闪两下，让玩家注意到
    this.tweens.chain({ targets: t, tweens: [{ alpha: 1, duration: 300 }, { alpha: 0.4, duration: 250 }, { alpha: 1, duration: 250 }, { alpha: 0.4, duration: 250 }, { alpha: 1, duration: 300 }] });
  }

  private heldText?: Phaser.GameObjects.Text;

  /** 目标栏下面：手上拿着的关键物品（绳子、剪刀）。空数组隐藏 */
  setHeld(items: string[]): void {
    if (!this.heldText || !this.heldText.active) {
      this.heldText = this.add.text(26, 98, '', textStyle(15, '#c8c0b0')).setDepth(800);
    }
    this.heldText.setText(items.length ? `手上：${items.join('、')}` : '');
  }

  /** 是否有界面挡住玩家操作 */
  isBlocking(): boolean {
    return this.activeModal !== null || this.dialogueBox.isOpen;
  }

  say(lines: string | string[], onDone?: () => void): void {
    this.dialogueBox.show(lines, onDone);
  }

  private cg?: Phaser.GameObjects.Image;

  /** 铺满画面的 CG（在对话框下面）。缺图时什么也不做，返回 false */
  showCG(key: string): boolean {
    if (!this.textures.exists(key)) return false;
    this.cg?.destroy();
    this.cg = this.add.image(0, 0, key).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(850).setAlpha(0);
    this.tweens.add({ targets: this.cg, alpha: 1, duration: 700 });
    return true;
  }

  hideCG(): Promise<void> {
    const cg = this.cg;
    this.cg = undefined;
    if (!cg) return Promise.resolve();
    return new Promise((resolve) =>
      this.tweens.add({ targets: cg, alpha: 0, duration: 600, onComplete: () => (cg.destroy(), resolve()) }),
    );
  }

  /**
   * 楼梯间过场（N8）：全屏的楼梯间，窗口里是窗外远景。往下走一层，远景在窗里的位置往上移。
   * 配脚步声，不显示文字。stairwell 图缺失时用色块画一个楼梯间。
   */
  playStairwell(fromFloor: number, toFloor: number, dawn: boolean, ms = 2600): Promise<void> {
    const layer = this.add.container(0, 0).setDepth(840);
    const v = (f: number) => ({ 4: 0.1, 3: 0.25, 2: 0.4, 1: 0.55 })[f] ?? 0.3;
    const bdKey = tex('backdrop', dawn ? 'dawn_view' : 'night_view');
    const fallback = dawn ? 'backdrop-fallback-dawn' : 'backdrop-fallback-night';
    const key = this.textures.exists(bdKey) ? bdKey : this.textures.exists(fallback) ? fallback : null;
    const bgKey = tex('bg', 'stairwell');
    const hasArt = this.textures.exists(bgKey);
    // 窗口：有图时整屏都铺远景（图的窗玻璃是透明的），没图时只在画出来的窗口里
    const win = hasArt ? { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT } : { x: 760, y: 120, w: 300, h: 260 };
    let view: Phaser.GameObjects.TileSprite | null = null;
    let viewH = 1;
    if (key) {
      const src = this.textures.get(key).getSourceImage();
      const scale = (GAME_HEIGHT * 1.6) / src.height;
      view = this.add.tileSprite(win.x, win.y, win.w, win.h, key).setOrigin(0).setTileScale(scale).setTint(dawn ? 0xd0d0d0 : 0x9a9a9a);
      viewH = src.height;
      view.tilePositionY = viewH * v(fromFloor);
      layer.add(view);
    }
    if (hasArt) {
      layer.add(this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setTint(dawn ? 0xd8d8d8 : 0xa0a0a0));
    } else {
      // 色块楼梯间：四周的墙、窗框、一段往下的台阶
      const g = this.add.graphics();
      const wall = dawn ? 0x4a4a4e : 0x16161a;
      g.fillStyle(wall, 1);
      g.fillRect(0, 0, GAME_WIDTH, win.y).fillRect(0, win.y + win.h, GAME_WIDTH, GAME_HEIGHT - win.y - win.h);
      g.fillRect(0, win.y, win.x, win.h).fillRect(win.x + win.w, win.y, GAME_WIDTH - win.x - win.w, win.h);
      g.lineStyle(6, dawn ? 0x2a2a2e : 0x0a0a0c, 1).strokeRect(win.x, win.y, win.w, win.h);
      g.lineBetween(win.x + win.w / 2, win.y, win.x + win.w / 2, win.y + win.h);
      g.fillStyle(dawn ? 0x3a3a3e : 0x0e0e11, 1);
      for (let i = 0; i < 8; i++) g.fillRect(140 + i * 60, 460 + i * 30, 640 - i * 30, 30);
      g.lineStyle(3, dawn ? 0x2a2a2e : 0x08080a, 1).lineBetween(120, 420, 600, 660);
      layer.add(g);
    }
    layer.setAlpha(0);
    return new Promise((resolve) => {
      this.tweens.add({ targets: layer, alpha: 1, duration: 450 });
      if (view) this.tweens.add({ targets: view, tilePositionY: viewH * v(toFloor), duration: ms, ease: 'Sine.easeInOut' });
      // 下楼梯的脚步声
      const steps = this.time.addEvent({ delay: 380, repeat: Math.floor(ms / 380) - 1, callback: () => Audio.play('step_walk') });
      this.time.delayedCall(ms - 450, () =>
        this.tweens.add({
          targets: layer,
          alpha: 0,
          duration: 450,
          onComplete: () => {
            steps.remove();
            layer.destroy(true);
            resolve();
          },
        }),
      );
    });
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
        ((e.code === 'KeyE' || e.code === 'KeyI') && this.activeModal === this.bag) ||
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
      case 'KeyE':
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
