import Phaser from 'phaser';
import { Audio, preloadAudio } from '../systems/audio';
import { preloadSprites } from '../systems/sprites';
import { SCENE } from './flow';

/** 之后在这里加载 assets/ 下的美术和音效。现在全部是代码画的占位色块。 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.boot);
  }

  preload(): void {
    preloadSprites(this);
    preloadAudio(this);
  }

  create(): void {
    Audio.init(this.game);
    this.scene.start(SCENE.title);
  }
}
