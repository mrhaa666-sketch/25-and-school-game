import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SANITY_COST } from '../core/constants';
import { GameState } from '../core/GameState';
import { getMaterial, hintLevel } from '../core/progress';
import { tUi } from '../core/text';
import { ExamUI } from '../systems/ExamUI';
import { makeFigure, PALETTE } from '../systems/figures';
import { textStyle } from '../systems/style';
import { actKey, startAct, triggerEnding } from './flow';
import { RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

const BLANK_PAPER = 'mafuyu_blank_paper';

/**
 * 第五幕 · 三楼考场。
 * 坐到空着的位子上 → 试卷。任何时候选一个选项交卷 → 门开，精神值 -10。
 * 10 秒不选 →「交白卷吗？」：交 → 门开，精神值不变（一周目拿到「白卷」）；不交 → 结局 5。
 */
export class Act05Scene extends RoomScene {
  private exam?: ExamUI;
  private submitted = false;
  private papers: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super(actKey(5));
  }

  private t(key: string): string[] {
    return this.text(`act05.${key}`);
  }

  create(): void {
    super.create();
    this.submitted = false;
    this.papers = [];
    this.loadRoom('exam_room');
    this.facing = 'up';
    this.syncPlayer();
    this.decorate();
    const def = GameState.cycleDef.exam;
    // 补充周目的提示：「白卷」还没拿到时，挂钟的 10 秒倒计时清楚可见
    const countdown = GameState.save.cycle === 1 && hintLevel(GameState.save) >= 1 && !GameState.hasMaterial(BLANK_PAPER);
    this.exam = new ExamUI(
      this,
      {
        question: def.question,
        options: def.options,
        blankPrompt: this.textOne('act05.blank_prompt'),
        yes: this.textOne('act05.blank_yes'),
        no: this.textOne('act05.blank_no'),
      },
      countdown,
    );
    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (!this.exam?.isOpen || this.ui.isBlocking()) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.exam.handle('up');
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.exam.handle('down');
    });
    this.cameras.main.fadeIn(600, 0, 0, 0);
    void this.cutscene(() => this.say(this.t('enter')));
  }

  /** 每张桌上一份试卷；黑板上的字 */
  private decorate(): void {
    this.room.map.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== 'd' && ch !== 'X') return;
        const c = this.tileCenter(x, y);
        if (ch === 'd') {
          const p = this.add.rectangle(c.x, c.y - 2, 22, 16, 0xe0dacb).setDepth(5);
          this.roomLayer.add(p);
          this.papers.push(p);
        }
      }),
    );
    const k = this.objectCenter('K');
    this.roomLayer.add(this.add.text(k.x, k.y - 4, '考试时间：三分钟', textStyle(14, '#c8c4b8')).setOrigin(0.5));
  }

  onInteract(): void {
    if (this.exam?.isOpen) {
      if (!this.ui.isBlocking()) this.exam.handle('confirm');
      return;
    }
    super.onInteract();
  }

  protected onObject(obj: RoomObject): void {
    switch (obj.id) {
      case 'own_desk':
        if (this.submitted) return this.ui.say(this.t('own_desk'));
        void this.takeExam();
        return;
      case 'exam_desk':
        return this.ui.say(this.t('exam_desk'));
      case 'blackboard':
        return this.ui.say(this.t('blackboard'));
      case 'clock':
        return this.ui.say(this.t('clock'));
      case 'lectern':
        return this.ui.say(this.t('lectern'));
    }
  }

  protected onExit(ch: string): boolean {
    if (ch !== '1') return false;
    if (!this.submitted) {
      this.bounceBack();
      this.ui.say(this.t('door_locked'));
      return true;
    }
    // 考场出来，楼梯就在门外
    this.player.setVisible(false);
    startAct(this, 6);
    return true;
  }

  private async takeExam(): Promise<void> {
    // 坐到位子上
    const seat = this.findTile('X')!;
    const c = this.tileCenter(seat.x, seat.y);
    this.locked = true;
    this.pos.set(c.x, c.y + 26);
    this.facing = 'up';
    this.syncPlayer();
    const result = await this.exam!.open();

    if (result.kind === 'answer') {
      GameState.deductSanity(SANITY_COST.examAnswer, 'exam');
      return this.finishExam('answer');
    }
    if (result.kind === 'blank') {
      GameState.patch({ blankPaperThisCycle: true });
      // 「白卷」只有交白卷才能拿到（真冬主题）
      const m = getMaterial(BLANK_PAPER);
      if (GameState.save.cycle === 1 && m && !GameState.hasMaterial(m.id)) {
        GameState.addMaterial(m.id);
        await this.say([this.textOne('act05.blank_material'), tUi('obtained').replace('{name}', m.name), ...this.materialComment(m.id)]);
      }
      return this.finishExam('blank');
    }
    await this.ending5();
  }

  private async finishExam(kind: 'answer' | 'blank'): Promise<void> {
    this.submitted = true;
    await this.say([...this.t('submitted'), ...this.t(`submitted_${kind}`)]);
    this.cameras.main.shake(120, 0.003);
    await this.say(this.t('door_open'));
    this.locked = false;
  }

  /** 结局 5：其他课桌上的试卷一张一张自己写满，最后她自己的卷子也写满了 */
  private async ending5(): Promise<void> {
    this.locked = true;
    this.menusOpen = false;
    const self = makeFigure(this, this.pos.x, this.pos.y, { ...PALETTE.mafuyu, pose: 'sit' }).setDepth(101);
    this.player.setVisible(false);
    await this.wait(1200);
    for (const p of Phaser.Utils.Array.Shuffle([...this.papers])) {
      const g = this.add.graphics().setDepth(6);
      g.lineStyle(1, 0x2a2620, 0.9);
      for (let i = 0; i < 4; i++) g.lineBetween(p.x - 9, p.y - 5 + i * 3.5, p.x - 9 + Phaser.Math.Between(10, 18), p.y - 5 + i * 3.5);
      g.setAlpha(0);
      this.tween({ targets: g, alpha: 1, duration: 300 });
      await this.wait(260);
    }
    await this.wait(900);
    // 她低头看自己的卷子
    const paper = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 600, 0xe9e4d8).setDepth(990).setAlpha(0);
    const hand = this.add.graphics().setDepth(991).setAlpha(0);
    hand.lineStyle(2, 0x2a2620, 1);
    for (let y = GAME_HEIGHT / 2 - 250; y < GAME_HEIGHT / 2 + 270; y += 30) {
      let x = GAME_WIDTH / 2 - 230;
      while (x < GAME_WIDTH / 2 + 220) {
        const w = Phaser.Math.Between(8, 26);
        hand.lineBetween(x, y + Phaser.Math.Between(-2, 2), x + w, y + Phaser.Math.Between(-2, 2));
        x += w + Phaser.Math.Between(4, 9);
      }
    }
    await this.tween({ targets: [paper, hand], alpha: 1, duration: 1400 });
    await this.wait(1800);
    self.destroy();
    this.cameras.main.fadeOut(1200, 0, 0, 0);
    await this.wait(1300);
    triggerEnding(this, 5);
  }
}
