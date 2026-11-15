import { Audio } from '../systems/audio';
import { actKey, openGate } from './flow';
import { RoomScene } from './RoomScene';
import type { RoomObject } from './rooms';

/** 第十幕 · 大门。走到大门前推开 → 第十幕判定（flow.openGate） */
export class Act10Scene extends RoomScene {
  constructor() {
    super(actKey(10));
  }

  create(): void {
    super.create();
    this.loadRoom('lobby');
    this.facing = 'down';
    this.syncPlayer();
    this.cameras.main.fadeIn(800, 0, 0, 0);
    void this.cutscene(() => this.say(this.text('act10.enter')));
  }

  protected onExit(): boolean {
    this.bounceBack();
    return true;
  }

  protected objective(): string | null {
    return '从下方的大门离开学校';
  }

  protected keyTargets(): string[] {
    return ['G'];
  }

  protected verbFor(ch: string, tile: { x: number; y: number }): string {
    if (this.room.objects[ch]?.id === 'gate') return '推开大门';
    return super.verbFor(ch, tile);
  }

  protected onObject(obj: RoomObject): void {
    switch (obj.id) {
      case 'shoe_locker':
        return this.ui.say(this.text('act10.shoe_locker'));
      case 'gate':
        void this.cutscene(async () => {
          await this.say(this.text('act10.gate'));
          Audio.play('gate_open');
          openGate(this);
        });
        return;
    }
  }
}
