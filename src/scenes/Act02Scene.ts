import { SANITY_COST } from '../core/constants';
import { GameState } from '../core/GameState';
import { tLines, tStory, tUi } from '../core/text';
import { SCENE, startAct } from './flow';
import { RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

/**
 * 第二幕 · 四楼医务室 → 走廊 → 楼梯口。
 * M1：探索部分完整可玩；楼梯口的追逐战 1 在 M2 制作，目前直接进入第三幕。
 */
export class Act02Scene extends RoomScene {
  constructor() {
    super(SCENE.act02);
  }

  private t(key: string): string[] {
    return tLines(`act02.${key}`, GameState.save.cycle);
  }

  create(): void {
    super.create();
    this.loadRoom('infirmary');
    this.locked = true;
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    this.time.delayedCall(900, () => this.ui.say(this.t('wake'), () => (this.locked = false)));
  }

  protected onEnterRoom(roomId: string, firstTime: boolean): void {
    if (roomId === 'corridor4' && firstTime) this.time.delayedCall(300, () => this.ui.say(this.t('door_out')));
  }

  protected onObject(obj: RoomObject): void {
    const material = this.materialAtSpot(obj.spot);
    if (material) {
      const intro = tStory(`act02.${obj.spot}_material`, GameState.save.cycle);
      const lines = [...(Array.isArray(intro) ? intro : [intro]), tUi('obtained').replace('{name}', material.name)];
      this.ui.say(lines);
      GameState.addMaterial(material.id);
      this.loadRoomHintsRefresh();
      return;
    }

    switch (obj.id) {
      case 'bed':
        return this.ui.say(this.t('bedhead_empty'));
      case 'bed2':
        return this.ui.say(this.t('bed'));
      case 'mirror':
        return this.mirror();
      case 'cabinet':
        return this.ui.say(this.t('cabinet'));
      case 'desk':
        return this.ui.say(this.t('desk'));
      case 'corridor_window':
        return this.ui.say(this.t('corridor_window'));
      case 'stairs':
        return this.ui.say(this.t('stairs_placeholder'), () => startAct(this, 3));
    }
  }

  /** 镜子：镜中身后站着一个人影，回头什么都没有。每周目一次 -5。 */
  private mirror(): void {
    const s = GameState.save;
    if (s.mirrorSeenThisCycle || GameState.isFinal) return this.ui.say(this.t('mirror_again'));
    GameState.patch({ mirrorSeenThisCycle: true });
    this.locked = true;
    const lines = this.t('mirror');
    this.ui.say(lines[0], () => {
      // 占位演出：身后出现一个人影，一闪即逝
      const shadow = this.add.rectangle(this.player.x, this.player.y + 30, 26, 52, 0x000000, 0.85).setDepth(99);
      this.cameras.main.flash(120, 40, 0, 0);
      GameState.deductSanity(SANITY_COST.mirror, 'mirror');
      this.time.delayedCall(260, () => shadow.destroy());
      this.time.delayedCall(500, () => this.ui.say(lines.slice(1), () => (this.locked = false)));
    });
  }

  /** 拿到材料后重画房间，去掉提示光点 */
  private loadRoomHintsRefresh(): void {
    const { x, y } = this.pos;
    const facing = this.facing;
    this.loadRoom(this.room.id);
    this.pos.set(x, y);
    this.facing = facing;
    this.syncPlayer();
  }
}
