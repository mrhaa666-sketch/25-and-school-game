import Phaser from 'phaser';
import { Audio, type SoundKey } from '../systems/audio';
import { SANITY_COST } from '../core/constants';
import { GameState } from '../core/GameState';
import { makeNoteMonster, PALETTE } from '../systems/figures';
import { actKey, startAct } from './flow';
import { tex } from '../systems/sprites';
import { drawMemberScene, MEMBER_ART } from './memberScenes';
import { startNoise } from './noise';
import { RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

const NEAR_PIANO = 90;
const REACH_KANADE = 64;

/**
 * 第八幕 · 一楼音乐室。到处都是刺耳的声音。
 * 走过去想看奏 → 奏四分五裂，一群由音乐组成的怪物包围了真冬 → 第九幕。
 * （四周目：奏不碎开，怪物从空白乐谱里爬出来）
 */
export class Act08Scene extends RoomScene {
  private stopNoise?: () => void;
  private pianoCharged = false;
  private triggered = false;
  private member?: Phaser.GameObjects.Container;

  constructor() {
    super(actKey(8));
  }

  create(): void {
    super.create();
    this.pianoCharged = false;
    this.triggered = false;
    this.loadRoom('music_room');
    this.facing = 'right';
    this.syncPlayer();
    this.stopNoise = startNoise(this, 1);
    this.events.once('shutdown', () => this.stopNoise?.());
    this.cameras.main.fadeIn(600, 0, 0, 0);
    void this.cutscene(() => this.say(this.text('act08.enter')));
  }

  protected ambience(): SoundKey | null {
    return 'amb_harsh';
  }

  protected onEnterRoom(): void {
    const id = GameState.cycleDef.scenes.musicRoom;
    if (this.textures.exists(tex('scn', MEMBER_ART[id] ?? ''))) {
      // 素材图里已经画了钢琴：替换掉房间里的钢琴，放在钢琴的位置
      this.objectImages.get('P')?.forEach((i) => i.setVisible(false));
      const p = this.objectCenter('P');
      this.member = drawMemberScene(this, id, p.x + 10, p.y + 44, 150);
    } else {
      const k = this.objectCenter('k');
      this.member = drawMemberScene(this, id, k.x, k.y + 14);
    }
    this.addRoomSorted(this.member);
  }

  protected objective(): string | null {
    return this.triggered ? null : '去钢琴那边看看';
  }

  protected keyTargets(): string[] {
    return this.triggered ? [] : ['k'];
  }

  protected verbFor(ch: string, tile: { x: number; y: number }): string {
    if (this.room.objects[ch]?.id === 'kanade') return '走近看看';
    return super.verbFor(ch, tile);
  }

  protected onObject(obj: RoomObject): void {
    switch (obj.id) {
      case 'kanade':
        void this.approach();
        return;
      case 'piano':
        this.chargePiano();
        return this.ui.say(this.text('act08.piano'));
      case 'chair':
        return this.ui.say(this.text('act08.chair'));
      case 'vent':
        return this.ui.say(this.text('act08.vent'));
    }
  }

  /** 靠近钢琴 / 调查成员场景：-5（每周目这一幕一次） */
  private chargePiano(): void {
    if (this.pianoCharged) return;
    this.pianoCharged = true;
    GameState.deductSanity(SANITY_COST.musicRoom, 'music');
  }

  protected onUpdate(): void {
    if (this.triggered || this.locked) return;
    const p = this.objectCenter('P');
    if (Phaser.Math.Distance.Between(p.x, p.y, this.pos.x, this.pos.y) < NEAR_PIANO) this.chargePiano();
    const k = this.objectCenter('k');
    if (Phaser.Math.Distance.Between(k.x, k.y, this.pos.x, this.pos.y) < REACH_KANADE) void this.approach();
  }

  private async approach(): Promise<void> {
    if (this.triggered) return;
    this.triggered = true;
    this.chargePiano();
    await this.cutscene(async () => {
      await this.say(this.text('act08.kanade'));
      await this.wait(700);
      const k = this.objectCenter('k');
      const shatter = GameState.cycleDef.scenes.musicRoom !== 'blank_score_kanade';
      if (shatter && this.member) {
        // 奏四分五裂：有裂开的图就先换成那张，停一下再碎
        const img = this.member.list[0];
        if (img instanceof Phaser.GameObjects.Image && this.textures.exists(tex('scn', 'music_kanade_shatter'))) {
          img.setTexture(tex('scn', 'music_kanade_shatter'));
          Audio.play('glass_crack', { volume: 0.6 });
          this.cameras.main.shake(200, 0.006);
          await this.wait(900);
        }
        this.cameras.main.flash(150, 255, 255, 255);
        Audio.play('glass_crack');
        this.member.destroy();
        for (let i = 0; i < 14; i++) {
          const piece = this.add.rectangle(k.x, k.y - 10, Phaser.Math.Between(4, 10), Phaser.Math.Between(4, 12), [PALETTE.kanade.body, PALETTE.kanade.hair, PALETTE.kanade.head][i % 3]).setDepth(120);
          this.tweens.add({
            targets: piece,
            x: k.x + Phaser.Math.Between(-90, 90),
            y: k.y + Phaser.Math.Between(-70, 50),
            angle: Phaser.Math.Between(-180, 180),
            alpha: 0,
            duration: 1300,
            onComplete: () => piece.destroy(),
          });
        }
      }
      await this.wait(900);
      // 音乐组成的怪物包围真冬
      const from = shatter ? k : this.objectCenter('P');
      for (let i = 0; i < 8; i++) {
        const n = makeNoteMonster(this, from.x, from.y).setDepth(115);
        const ang = (i / 8) * Math.PI * 2;
        this.tweens.add({ targets: n, x: this.pos.x + Math.cos(ang) * 80, y: this.pos.y + Math.sin(ang) * 50, duration: 900, delay: i * 90 });
      }
      await this.wait(1800);
      startAct(this, 9);
    });
  }
}
