import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { ENDINGS, GameState } from '../core/GameState';
import { starString, themeStars } from '../core/progress';
import { cycleCountLabel, tUi, tUiList } from '../core/text';
import { THEMES, type SaveData } from '../core/types';
import { COLORS, panel, textStyle } from '../systems/style';
import { continueGame, SCENE, startAct } from './flow';

type View = 'main' | 'confirm' | 'gallery';

export class TitleScene extends Phaser.Scene {
  private view: View = 'main';
  private cursor = 0;
  private layer!: Phaser.GameObjects.Container;
  private save: SaveData | null = null;

  constructor() {
    super(SCENE.title);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000').fadeIn(800);
    if (this.textures.exists('bg:title')) {
      this.add.image(0, 0, 'bg:title').setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setTint(0x9a9a9a);
      // 下方压暗，放菜单
      const shade = this.add.graphics();
      shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0.85).fillRect(0, GAME_HEIGHT * 0.35, GAME_WIDTH, GAME_HEIGHT * 0.65);
    }
    this.save = GameState.peekSave();
    this.view = 'main';
    this.cursor = this.save ? 1 : 0;
    this.add.text(GAME_WIDTH / 2, 170, tUi('title'), textStyle(52, '#cfcac0')).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, tUi('controlsHint'), textStyle(14, '#4a4844')).setOrigin(0.5);
    this.layer = this.add.container(0, 0);

    const kb = this.input.keyboard!;
    kb.addCapture('SPACE,UP,DOWN');
    kb.on('keydown', (e: KeyboardEvent) => this.onKey(e.code));
    this.render();
  }

  private mainItems(): { label: string; enabled: boolean; run: () => void }[] {
    return [
      {
        label: tUi('newGame'),
        enabled: true,
        run: () => {
          if (this.save) {
            this.view = 'confirm';
            this.cursor = 1;
          } else this.startNew();
        },
      },
      {
        label: tUi('continue'),
        enabled: this.save !== null,
        run: () => {
          if (GameState.loadGame()) continueGame(this);
        },
      },
      {
        label: tUi('gallery'),
        enabled: true,
        run: () => {
          this.view = 'gallery';
          this.cursor = 0;
        },
      },
    ];
  }

  private startNew(): void {
    GameState.newGame();
    startAct(this, 1);
  }

  private onKey(code: string): void {
    const up = code === 'ArrowUp' || code === 'KeyW';
    const down = code === 'ArrowDown' || code === 'KeyS';
    const ok = code === 'Space' || code === 'Enter';
    const back = code === 'Escape' || code === 'Backspace';

    if (this.view === 'main') {
      const items = this.mainItems();
      if (up) this.cursor = (this.cursor + items.length - 1) % items.length;
      if (down) this.cursor = (this.cursor + 1) % items.length;
      if (ok && items[this.cursor].enabled) items[this.cursor].run();
    } else if (this.view === 'confirm') {
      if (up || down) this.cursor = 1 - this.cursor;
      if (back) this.toMain();
      if (ok) return this.cursor === 0 ? this.startNew() : this.toMain();
    } else if (this.view === 'gallery') {
      if (back || ok) this.toMain();
    }
    this.render();
  }

  private toMain(): void {
    this.view = 'main';
    this.cursor = 0;
  }

  private render(): void {
    this.layer.removeAll(true);
    if (this.view === 'main') this.renderMain();
    else if (this.view === 'confirm') this.renderConfirm();
    else this.renderGallery();
  }

  private renderMain(): void {
    this.mainItems().forEach((item, i) => {
      const sel = i === this.cursor;
      const color = !item.enabled ? '#3a3834' : sel ? COLORS.highlight : COLORS.textDim;
      this.layer.add(this.add.text(GAME_WIDTH / 2, 330 + i * 56, `${sel ? '›  ' : '   '}${item.label}`, textStyle(26, color)).setOrigin(0.5));
    });
    // 选中「继续游戏」时显示存档栏：四个周目的 ⭐/？ 进度
    if (this.cursor === 1) this.renderSaveSlot();
  }

  private renderSaveSlot(): void {
    const x = GAME_WIDTH / 2 + 220;
    const y = 300;
    this.layer.add(panel(this, x, y, 300, 230, 0.8));
    if (!this.save) {
      this.layer.add(this.add.text(x + 28, y + 28, tUi('noSave'), textStyle(18, COLORS.textDim)));
      return;
    }
    const s = this.save;
    const head = s.cycle === 'final' ? tUi('finalCycle') : cycleCountLabel(s.cycleCount);
    this.layer.add(this.add.text(x + 28, y + 22, `${head}　${tUiList('actNames')[s.act] ?? ''}`, textStyle(18, COLORS.text)));
    const names = tUiList('cycleNames');
    THEMES.forEach((t, i) => {
      const cur = s.cycle === t;
      const color = cur ? COLORS.highlight : COLORS.textDim;
      this.layer.add(this.add.text(x + 28, y + 70 + i * 38, names[t - 1], textStyle(18, color)));
      this.layer.add(this.add.text(x + 130, y + 68 + i * 38, starString(themeStars(s.materials, t)), textStyle(20, color)));
    });
  }

  private renderConfirm(): void {
    this.layer.add(this.add.text(GAME_WIDTH / 2, 330, tUi('overwriteConfirm'), textStyle(20, COLORS.text)).setOrigin(0.5));
    [tUi('confirm'), tUi('cancel')].forEach((label, i) => {
      const sel = i === this.cursor;
      this.layer.add(this.add.text(GAME_WIDTH / 2, 400 + i * 50, `${sel ? '›  ' : '   '}${label}`, textStyle(24, sel ? COLORS.highlight : COLORS.textDim)).setOrigin(0.5));
    });
  }

  private renderGallery(): void {
    const unlocked = GameState.meta.endingsUnlocked;
    const x0 = GAME_WIDTH / 2 - 420;
    this.layer.add(panel(this, x0, 250, 840, 380, 0.85));
    ENDINGS.forEach((e, i) => {
      const col = i < 5 ? 0 : 1;
      const row = i % 5;
      const open = unlocked.includes(e.id);
      const label = `${tUi('endingLabel')} ${e.id}　${open ? `${e.title}（${e.type}）` : tUi('lockedEnding')}`;
      this.layer.add(this.add.text(x0 + 50 + col * 400, 285 + row * 62, label, textStyle(20, open ? COLORS.text : '#4a4844')));
    });
    this.layer.add(this.add.text(GAME_WIDTH / 2, 600, tUi('back'), textStyle(16, COLORS.textDim)).setOrigin(0.5));
  }
}
