import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './core/constants';
import { EdgeBlurPipeline } from './systems/EdgeBlurPipeline';
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
  pipeline: { [EdgeBlurPipeline.KEY]: EdgeBlurPipeline } as unknown as Phaser.Types.Core.PipelineConfig,
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

/**
 * 鼠标：凡是要按空格的地方（剧情、对话、菜单、选项、打结、往下爬、标题画面），点一下左键就等于按一次空格。
 * 在房间里自由走动时（__clickMode 返回 'world'），点击交给房间场景处理：点能调查的东西会走过去调查。
 */
function pressSpace(type: 'keydown' | 'keyup'): void {
  const e = new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true, cancelable: true });
  Object.defineProperty(e, 'keyCode', { get: () => 32 });
  Object.defineProperty(e, 'which', { get: () => 32 });
  window.dispatchEvent(e);
}
game.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0) return;
  const mode = (window as unknown as { __clickMode?: () => string }).__clickMode?.() ?? 'space';
  if (mode !== 'space') return;
  pressSpace('keydown');
  setTimeout(() => pressSpace('keyup'), 40);
});
