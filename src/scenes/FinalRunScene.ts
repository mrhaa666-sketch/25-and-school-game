import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { GameState } from '../core/GameState';
import { MATERIALS } from '../core/progress';
import { tex } from '../systems/sprites';
import { SCENE, triggerEnding } from './flow';
import { RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

/** 第一次走进这些房间时的一句话 */
const ENTER_TEXT: Record<string, string> = {
  corridor4: 'corridor4',
  classroom4_final: 'classroom4',
  classroom3_final: 'classroom3',
  corridor3_final: 'corridor3',
  exam_room_final: 'exam_room',
  stairs2: 'stairs2',
  lobby_final: 'lobby',
};

/**
 * 终周目（交接文档第 5 节）。
 * 全程没有追逐、精神值和屏幕文字。灯是关着的，只有月光。
 * 从四楼医务室一层一层往下走到大门；经过材料所在的地方时，背包里的材料亮一下。
 * 推开大门：三个人在校门口等她 → 通讯录的名字一个一个变回来 →「……嗯。」→ 结局 10。
 */
export class FinalRunScene extends RoomScene {
  private flashed = new Set<string>();
  private pinkGoneSaid = false;
  private moon?: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SCENE.finalRun);
  }

  private t(key: string): string[] {
    return this.text(`finalrun.${key}`);
  }

  create(): void {
    super.create();
    this.flashed = new Set();
    this.pinkGoneSaid = false;
    this.allowRun = false; // 慢一点
    // 月光：整体压暗、偏冷
    this.moon = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a1430, 0.42).setOrigin(0).setScrollFactor(0).setDepth(440);
    this.loadRoom('infirmary');
    this.locked = true;
    this.cameras.main.fadeIn(2400, 0, 0, 0);
    this.time.delayedCall(1800, () => this.ui.say(this.t('wake'), () => (this.locked = false)));
  }

  protected moveSpeed(): number {
    return 130;
  }

  // ------------------------------------------------------------ 材料亮一下

  /** 某个房间里的材料（终周目的变体房间按原房间算） */
  private materialsIn(roomId: string): string[] {
    return MATERIALS.filter((m) => m.room === roomId && GameState.hasMaterial(m.id)).map((m) => m.id);
  }

  private flash(place: string): void {
    if (this.flashed.has(place)) return;
    this.flashed.add(place);
    const ids = this.materialsIn(place);
    if (ids.length) this.ui.flashMaterials(ids);
  }

  protected onEnterRoom(roomId: string, firstTime: boolean): void {
    this.flash(this.room.alias ?? roomId);
    if (firstTime && ENTER_TEXT[roomId]) this.time.delayedCall(400, () => this.ui.say(this.t(`enter_${ENTER_TEXT[roomId]}`)));
  }

  protected onUpdate(): void {
    // 经过门口：门后房间里的材料亮一下
    for (const [ch, dest] of Object.entries(this.room.doors ?? {})) {
      if (this.flashed.has(dest)) continue;
      const t = this.findTile(ch);
      if (!t) continue;
      const c = this.tileCenter(t.x, t.y);
      if (Phaser.Math.Distance.Between(c.x, c.y, this.pos.x, this.pos.y) < 80) this.flash(dest);
    }
    // 二楼走廊尽头：粉色的门不见了，楼梯在原来的位置
    if (this.room.id === 'corridor2' && !this.pinkGoneSaid && this.playerTile().x >= 24 && !this.locked) {
      this.pinkGoneSaid = true;
      this.ui.say(this.t('pink_gone'));
    }
  }

  // ------------------------------------------------------------ 移动

  protected onExit(ch: string): boolean {
    if (this.room.id === 'corridor4') {
      if (ch === '2') {
        this.changeRoom('classroom4_final', '1');
        return true;
      }
      if (ch === '3' || ch === '4' || ch === '5') {
        this.bounceBack();
        this.ui.say(this.t('locked'));
        return true;
      }
    }
    return false;
  }

  /** 走下楼梯：换到下一层 */
  private downstairs(roomId: string, arriveAt?: string): void {
    void this.cutscene(async () => {
      await this.say(this.t('downstairs'));
      this.changeRoom(roomId, arriveAt);
      await this.wait(600);
    });
  }

  protected onObject(obj: RoomObject): void {
    switch (obj.id) {
      case 'stairs': // 四楼 → 三楼
        return this.downstairs('corridor3_final');
      case 'stairs_final': // 三楼 → 二楼
        return this.downstairs('stairs2');
      case 'stairs_down': // 二楼 → 一楼
        return this.downstairs('lobby_final');
      case 'gate':
        return void this.openGate();
      case 'music_door':
        return this.ui.say(this.t('music_door'));
      case 'quiet_door':
        return this.ui.say(this.t('quiet_door'));
      case 'mirror':
        return this.ui.say(this.t('mirror'));
      case 'iron_door':
        return this.ui.say(this.t('iron_door'));
      case 'corridor_window':
      case 'window':
        return this.ui.say(this.t('window'));
      default:
        return this.ui.say(this.t('quiet'));
    }
  }

  // ------------------------------------------------------------ 大门

  private async openGate(): Promise<void> {
    await this.cutscene(async () => {
      this.menusOpen = false;
      await this.say(this.t('gate'));
      const cam = this.cameras.main;
      cam.fadeOut(1600, 0, 0, 0);
      await this.wait(1800);
      // 门外：校门口，凌晨
      this.moon?.setVisible(false);
      const key = tex('bg', 'final_gate');
      if (this.textures.exists(key)) {
        this.add.image(0, 0, key).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setScrollFactor(0).setDepth(860).setTint(0xa0a0a0);
      } else {
        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0c12).setOrigin(0).setScrollFactor(0).setDepth(860);
      }
      this.player.setVisible(false);
      cam.fadeIn(2400, 0, 0, 0);
      await this.wait(2600);
      await this.say(this.t('outside'));
      // 通讯录里的名字一个一个变回来
      await this.ui.restoreContacts();
      await this.wait(600);
      await this.say(this.t('answer'));
      await this.wait(1200);
      cam.fadeOut(2200, 0, 0, 0);
      await this.wait(2400);
      triggerEnding(this, 10);
    });
  }
}
