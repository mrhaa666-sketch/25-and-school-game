import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './core/constants';
import { Act02Scene } from './scenes/Act02Scene';
import { ActPlaceholderScene } from './scenes/ActPlaceholderScene';
import { BootScene } from './scenes/BootScene';
import { StoryScene } from './scenes/StoryScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, StoryScene, Act02Scene, ActPlaceholderScene, UIScene],
});

// 方便在浏览器控制台里调试
(window as unknown as { game: Phaser.Game }).game = game;
