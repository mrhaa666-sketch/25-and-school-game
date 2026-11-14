import Phaser from 'phaser';
import { GAME_WIDTH, SANITY, SANITY_COST } from '../core/constants';
import { GameState } from '../core/GameState';
import { MATERIALS } from '../core/progress';
import { tUi, tUiList } from '../core/text';
import { ListMenu, type MenuItem } from '../systems/ListMenu';
import { COLORS, textStyle } from '../systems/style';
import { openGate, SCENE, startAct, triggerEnding } from './flow';
import type { PlayTarget, UIScene } from './UIScene';

/** 材料所在房间 → 第几幕经过那里 */
const ROOM_ACT: Record<string, number> = {
  classroom4: 3,
  corridor3: 4,
  classroom3: 4,
  locker3: 4,
  stairs2: 6,
  corridor2: 6,
  pink_room2: 6,
};

const SUMMARY: Record<number, string> = {
  3: '四楼教室。天花板上挂着很多绳子。\n打结 QTE → 顺绳下爬，怪物在上面拉。',
  4: '三楼。成员场景、剪断绳子。\n追逐战 2：走廊被无限拉长。',
  5: '三楼考场。黑板：「考试时间：三分钟」。',
  6: '二楼。楼梯变成了粉色的门。',
  7: '管道。很长，很窄。前方有人在数数。',
  8: '一楼音乐室。到处都是刺耳的声音。',
  9: '怪物们唱着歌，邀请真冬加入。',
  10: '大门。',
};

/**
 * 还没做好的幕的占位场景（M2 起逐个替换成正式场景）。
 * 用菜单模拟这一幕的各个分支，方便在 M1 就能把整个流程、精神值、结局、周目串起来测试。
 */
export class ActPlaceholderScene extends Phaser.Scene implements PlayTarget {
  private ui!: UIScene;
  private menu!: ListMenu;
  private act = 3;

  constructor() {
    super(SCENE.placeholder);
  }

  init(data: { act: number }): void {
    this.act = data.act;
  }

  create(): void {
    this.ui = this.scene.get(SCENE.ui) as UIScene;
    this.ui.setTarget(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.ui?.scene.isActive()) this.ui.setTarget(null);
    });
    this.cameras.main.setBackgroundColor('#08080a').fadeIn(500);

    const s = GameState.save;
    const cycleName = s.cycle === 'final' ? tUi('finalCycle') : tUiList('cycleNames')[s.cycle - 1];
    this.add.text(GAME_WIDTH / 2, 90, `${tUiList('actNames')[this.act]}　·　${cycleName}`, textStyle(26)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 150, SUMMARY[this.act] ?? '', textStyle(18, COLORS.textDim, { align: 'center', lineSpacing: 8 })).setOrigin(0.5, 0);
    this.add.text(GAME_WIDTH / 2, 660, '【占位场景】这一幕在 M2 制作。用菜单模拟分支。', textStyle(14, '#55524c')).setOrigin(0.5);

    // 第六幕：进入粉色房间时精神值 ≤ 25 → 结局 6
    if (this.act === 6 && s.sanity <= SANITY.pinkRoomThreshold) {
      this.time.delayedCall(700, () =>
        this.ui.say(['打开了粉色的门。', '……'], () => triggerEnding(this, 6, ['真冬没有走向管道。', '她在房间里坐了下来。', '再也没有站起来。'])),
      );
      return;
    }

    this.menu = new ListMenu(this, '分支', this.items(), 560);
    this.menu.open();

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.ui.isBlocking()) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.menu.handle('up');
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.menu.handle('down');
    });
  }

  onInteract(): void {
    if (this.menu?.isOpen) this.menu.handle('confirm');
  }

  private next(): void {
    startAct(this, this.act + 1);
  }

  private cost(amount: number, line: string): MenuItem {
    return { label: `${line}（精神 -${amount}）`, action: () => GameState.deductSanity(amount, 'placeholder') };
  }

  private materialItems(): MenuItem[] {
    const s = GameState.save;
    if (s.cycle === 'final') return [];
    return MATERIALS.filter((m) => m.theme === s.cycle && ROOM_ACT[m.room] === this.act && !s.materials.includes(m.id)).map((m) => ({
      label: `调查（${m.locationHint}）`,
      action: () => {
        GameState.addMaterial(m.id);
        this.ui.say(tUi('obtained').replace('{name}', m.name));
        this.scene.restart({ act: this.act });
      },
    }));
  }

  private items(): MenuItem[] {
    const s = GameState.save;
    const m = this.materialItems();
    switch (this.act) {
      case 3:
        return [...m, { label: '打结、下爬成功 → 第四幕', action: () => this.next() }, { label: '打结失败 → 结局 2', action: () => triggerEnding(this, 2) }, { label: '攀爬超时 → 结局 3', action: () => triggerEnding(this, 3) }];
      case 4:
        return [...m, this.cost(SANITY_COST.floor3Scene, '调查三楼的成员场景'), { label: '逃过追逐战 2 → 第五幕', action: () => this.next() }, { label: '被追上 → 结局 4', action: () => triggerEnding(this, 4) }];
      case 5: {
        const exam = GameState.cycleDef.exam;
        return [
          ...exam.options.map((o) => ({
            label: `${exam.question}　选「${o}」交卷（精神 -10）`,
            action: () => {
              GameState.deductSanity(SANITY_COST.examAnswer, 'exam');
              this.next();
            },
          })),
          {
            label: '10 秒不选 →「交白卷吗？」→ 交',
            action: () => {
              GameState.patch({ blankPaperThisCycle: true });
              if (s.cycle === 1) GameState.addMaterial('mafuyu_blank_paper');
              this.next();
            },
          },
          { label: '10 秒不选 →「交白卷吗？」→ 不交 → 结局 5', action: () => triggerEnding(this, 5) },
        ];
      }
      case 6:
        return [...m, this.cost(SANITY_COST.floor2Scene, '调查二楼的成员场景'), { label: '钻进管道 → 第七幕', action: () => this.next() }];
      case 7:
        return [this.cost(SANITY_COST.pipeCounting, '停下来听数数声'), { label: '没有声音的那条 → 第八幕', action: () => this.next() }, { label: '有数数声的那条 → 结局 7', action: () => triggerEnding(this, 7) }];
      case 8:
        return [this.cost(SANITY_COST.musicRoom, '靠近钢琴'), { label: '走过去 → 第九幕', action: () => this.next() }];
      case 9:
        return [{ label: '3 秒内选「不同意」→ 第十幕', action: () => this.next() }, { label: '同意 → 结局 8', action: () => triggerEnding(this, 8) }];
      case 10:
        return [{ label: '推开大门', action: () => openGate(this) }];
      default:
        return [{ label: '下一幕', action: () => this.next() }];
    }
  }
}
