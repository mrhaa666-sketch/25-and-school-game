import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './core/constants';
import { Act01Scene } from './scenes/Act01Scene';
import { Act02Scene } from './scenes/Act02Scene';
import { Act03Scene } from './scenes/Act03Scene';
import { Act04Scene } from './scenes/Act04Scene';
import { Act05Scene } from './scenes/Act05Scene';
import { Act06Scene } from './scenes/Act06Scene';
import { Act07Scene } from './scenes/Act07Scene';
import { Act08Scene } from './scenes/Act08Scene';
import { Act09Scene } from './scenes/Act09Scene';
import { Act10Scene } from './scenes/Act10Scene';
import { BootScene } from './scenes/BootScene';
import { FinalRunScene } from './scenes/FinalRunScene';
import { StoryScene } from './scenes/StoryScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [
    BootScene,
    TitleScene,
    StoryScene,
    Act01Scene,
    Act02Scene,
    Act03Scene,
    Act04Scene,
    Act05Scene,
    Act06Scene,
    Act07Scene,
    Act08Scene,
    Act09Scene,
    Act10Scene,
    FinalRunScene,
    UIScene,
  ],
});

// 方便在浏览器控制台里调试
(window as unknown as { game: Phaser.Game }).game = game;
