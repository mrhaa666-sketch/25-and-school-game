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

  protected onObject(obj: RoomObject): void {
    switch (obj.id) {
      case 'shoe_locker':
        return this.ui.say(this.text('act10.shoe_locker'));
      case 'gate':
        void this.cutscene(async () => {
          await this.say(this.text('act10.gate'));
          openGate(this);
        });
        return;
    }
  }
}
