import { Audio } from '../systems/audio';
import { SANITY, SANITY_COST } from '../core/constants';
import { GameState } from '../core/GameState';
import { makeFigure, PALETTE } from '../systems/figures';
import { PLAYER_HEIGHT } from '../systems/playerSprite';
import { MAFUYU_STAND_REF, poseImage } from '../systems/sprites';
import { actKey, startAct, triggerEnding } from './flow';
import { drawMemberScene } from './memberScenes';
import { RoomScene } from './RoomScene';
import { ROOMS, type RoomDef, type RoomObject } from './rooms';

/** 楼梯消失后的二楼走廊：尽头变成一扇粉色的门 */
function pinkCorridor(): RoomDef {
  const base = ROOMS.corridor2;
  return {
    ...base,
    map: base.map.map((r) => r.replace('T', 'P')),
    objects: { ...base.objects, P: { id: 'pink_door', color: 0xe39fc0 } },
  };
}

/**
 * 第六幕 · 二楼粉色的门。
 * 锁上楼梯间的铁门 → 走到走廊另一头，楼梯变成粉色的门 → 打开门，看到成员场景，站着不动
 * → 钻进管道 → 第七幕。进入房间时精神值 ≤ 25 → 结局 6。
 */
export class Act06Scene extends RoomScene {
  private transformed = false;
  private memberSeen = false;

  constructor() {
    super(actKey(6));
  }

  private t(key: string): string[] {
    return this.text(`act06.${key}`);
  }

  create(): void {
    super.create();
    this.transformed = false;
    this.memberSeen = false;
    this.loadRoom('stairs2');
    this.facing = 'down';
    this.syncPlayer();
    this.cameras.main.fadeIn(600, 0, 0, 0);
    void this.cutscene(async () => {
      await this.say(this.t('enter'));
      Audio.play('door_lock');
      for (let i = 0; i < 3; i++) {
        this.cameras.main.shake(180, 0.008);
        Audio.play('door_bang', { rate: 0.9 });
        await this.wait(450);
      }
      await this.say(this.t('bang'));
    });
  }

  protected onExit(ch: string): boolean {
    if (this.room.id === 'stairs2' && ch === '1' && this.transformed) {
      this.loadRoom(pinkCorridor(), '1');
      return true;
    }
    if (this.room.id === 'pink_room2' && ch === '1') {
      this.bounceBack();
      this.ui.say(this.t('room_door'));
      return true;
    }
    return false;
  }

  protected onEnterRoom(roomId: string): void {
    if (roomId === 'pink_room2') {
      const id = GameState.cycleDef.scenes.floor2;
      if (this.mirrorPipe()) {
        // 三、四周目：房间里没有人。衣服叠在椅子上，镜子被布盖着，管道在镜子后面
        this.objectImages.get('O')?.forEach((i) => i.setVisible(false));
        const o = this.objectCenter('O');
        this.addRoomSorted(drawMemberScene(this, id, o.x - 46, o.y + 22, 110));
      } else {
        const p = this.objectCenter('R');
        this.addRoomSorted(drawMemberScene(this, id, p.x, p.y + 10));
      }
    }
  }

  /** 管道在被布盖着的镜子后面（成员场景是「叠好的衣服」的周目） */
  private mirrorPipe(): boolean {
    return GameState.cycleDef.scenes.floor2 === 'folded_clothes';
  }

  protected onUpdate(): void {
    if (this.room.id === 'corridor2' && !this.transformed && !this.locked && this.playerTile().x >= 24) {
      void this.stairsVanish();
    }
  }

  private async stairsVanish(): Promise<void> {
    this.transformed = true;
    await this.cutscene(async () => {
      this.cameras.main.flash(300, 0, 0, 0);
      await this.wait(200);
      this.loadRoom(pinkCorridor(), undefined, this.playerTile());
      this.facing = 'right';
      this.syncPlayer();
      await this.say(this.t('stairs_gone'));
    });
  }

  protected onObject(obj: RoomObject): void {
    const material = this.materialAtSpot(obj.spot);
    if (material) {
      void this.pickup(material, this.text(`act06.${obj.spot}_material`));
      return;
    }
    switch (obj.id) {
      case 'iron_door':
        return this.ui.say(this.t('iron_door'));
      case 'steps':
        return this.ui.say(this.t('steps'));
      case 'class_door':
        return this.ui.say(this.t('class_door'));
      case 'corridor_end':
        return this.ui.say(this.t('corridor_end'));
      case 'pink_door':
        void this.enterPinkRoom();
        return;
      case 'member_scene':
        if (this.mirrorPipe()) return this.ui.say(this.t('empty_floor'));
        if (!this.memberSeen) {
          this.memberSeen = true;
          GameState.deductSanity(SANITY_COST.floor2Scene, 'floor2');
        }
        return this.ui.say(this.t('member_investigate'));
      case 'table':
        return this.ui.say(this.t('table'));
      case 'pipe':
        void this.cutscene(async () => {
          if (this.mirrorPipe()) {
            // 调查衣服和镜子也算看了成员场景
            if (!this.memberSeen) {
              this.memberSeen = true;
              GameState.deductSanity(SANITY_COST.floor2Scene, 'floor2');
            }
            await this.say(this.t('mirror_cloth'));
          }
          await this.say(this.t('pipe'));
          this.player.setVisible(false);
          startAct(this, 7);
        });
        return;
    }
  }

  private async enterPinkRoom(): Promise<void> {
    await this.cutscene(async () => {
      await this.say(this.t('pink_door'));
      Audio.play('door_open', { rate: 0.85 });
      this.loadRoom(
        this.mirrorPipe()
          ? { ...ROOMS.pink_room2, map: ROOMS.pink_room2.map.map((r) => r.replace(/R/g, '.')) } // 房间中央没有人
          : 'pink_room2',
        '1',
      );
      this.facing = 'up';
      this.syncPlayer();
      // 进入房间时精神值 ≤ 25 → 结局 6
      if (GameState.save.sanity <= SANITY.pinkRoomThreshold && !GameState.isFinal) {
        await this.ending6();
        return;
      }
      // 受诡异影响，什么都没做：站着不动几秒
      await this.wait(3000);
      await this.say(this.t('member'));
    });
  }

  /** 结局 6：不画过程，画面停在她坐下的背影，慢慢黑掉 */
  private async ending6(): Promise<void> {
    this.menusOpen = false;
    await this.wait(1800);
    const back = this.add.container(this.pos.x, this.pos.y).setDepth(101);
    back.add(poseImage(this, 'mafuyu_sit_back', PLAYER_HEIGHT, MAFUYU_STAND_REF) ?? makeFigure(this, 0, 0, { ...PALETTE.mafuyu, pose: 'sit' }));
    this.player.setVisible(false);
    await this.wait(1500);
    this.cameras.main.fadeOut(4000, 0, 0, 0);
    await this.wait(4200);
    triggerEnding(this, 6);
  }
}
