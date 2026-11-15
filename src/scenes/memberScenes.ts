import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { makeFigure, PALETTE } from '../systems/figures';
import { fitImage, officialFrames, poseImage, tex } from '../systems/sprites';
import { textStyle } from '../systems/style';

/**
 * 成员场景的占位画面（交接文档 4.2）。id 来自 cycles/*.json 的 scenes 字段。
 * 克制处理：只画轮廓和关键物件，不画细节。M6 替换为作者准备的立绘。
 */
/** 成员场景 id（cycles/*.json 的 scenes 字段）→ 素材文件名 */
export const MEMBER_ART: Record<string, string> = {
  hanged_ena: 'floor3_hanged',
  canvas_ena: 'floor3_canvas',
  drained_mizuki: 'floor2_lying',
  folded_clothes: 'floor2_clothes',
  shattering_kanade: 'music_kanade_play',
  blank_score_kanade: 'music_kanade_blank',
};

/**
 * size：素材图在游戏里的最大宽高（像素）。原点在底边中央。
 */
/**
 * 这些成员场景的素材是一整幅画面（房间一角），不适合直接摆在地图里：
 * 房间里只放一个克制的痕迹，真冬「看到」时再把整幅画面浮现出来（showMemberOverlay）。
 */
const OVERLAY_ONLY = new Set(['hanged_ena']);

export function hasMemberOverlay(scene: Phaser.Scene, id: string): boolean {
  return OVERLAY_ONLY.has(id) && scene.textures.exists(tex('scn', MEMBER_ART[id]));
}

/** 画面中央浮现成员场景的整幅图。返回关闭函数 */
export function showMemberOverlay(scene: Phaser.Scene, id: string): () => Promise<void> {
  const key = tex('scn', MEMBER_ART[id]);
  const img = fitImage(scene, key, { x: GAME_WIDTH / 2 - 230, y: GAME_HEIGHT / 2 - 270, w: 460, h: 460 });
  if (!img) return async () => {};
  img.setScrollFactor(0).setDepth(880).setAlpha(0).setTint(0xb8b8b8);
  scene.tweens.add({ targets: img, alpha: 1, duration: 900 });
  return () =>
    new Promise((resolve) =>
      scene.tweens.add({ targets: img, alpha: 0, duration: 700, onComplete: () => (img.destroy(), resolve()) }),
    );
}

export function drawMemberScene(scene: Phaser.Scene, id: string, x: number, y: number, size = 120): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(95);
  if (id === 'hanged_ena') {
    // 绘名吊在绳子下面：用她的小人，压暗，轻轻晃；不画任何伤口
    const frames = officialFrames('ena', 'blink');
    const body = poseImage(scene, frames[0], 66, frames);
    const sway = scene.add.container(0, -150);
    sway.add(scene.add.line(0, 0, 0, 0, 0, 92, 0x8a7e66).setOrigin(0).setLineWidth(2));
    if (body) sway.add(body.setPosition(0, 150 - 20).setTint(0x6a6a78));
    else sway.add(makeFigure(scene, 0, 150 - 20, { ...PALETTE.ena, pose: 'hang', label: '绘名' }));
    c.add(sway);
    c.add(scene.add.ellipse(0, -2, 26, 7, 0x000000, 0.35)); // 地上的影子
    scene.tweens.add({ targets: sway, angle: { from: -2.5, to: 2.5 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  }
  if (hasMemberOverlay(scene, id) && scene.textures.exists(tex('obj', 'ropes'))) {
    // 房间里只有一根空着的绳圈（从绳子素材里裁出一根）
    const ROPE = { x: 233, y: 36, w: 58, h: 440 };
    const sc = 110 / ROPE.h;
    const rope = scene.add
      .image(-(ROPE.x + ROPE.w / 2) * sc, -(ROPE.y + ROPE.h) * sc, tex('obj', 'ropes'))
      .setOrigin(0)
      .setScale(sc)
      .setCrop(ROPE.x, ROPE.y, ROPE.w, ROPE.h)
      .setTint(0xa8a8a8);
    c.add(rope);
    scene.tweens.add({ targets: rope, angle: { from: -1.5, to: 1.5 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  }
  const art = MEMBER_ART[id];
  const img = art ? fitImage(scene, tex('scn', art), { x: -size / 2, y: -size, w: size, h: size }) : null;
  if (img) {
    c.add(img.setTint(0xc0c0c0)).setName(art);
    return c;
  }
  switch (id) {
    case 'hanged_ena':
      c.add(makeFigure(scene, 0, 10, { ...PALETTE.ena, pose: 'hang', label: '绘名' }));
      break;
    case 'canvas_ena': {
      // 一幅巨大的画布，画着绘名，画中的绳子垂在画框外
      const frame = scene.add.rectangle(0, -30, 90, 110, 0xd8d2c4).setStrokeStyle(4, 0x5a4a3a);
      const fig = makeFigure(scene, 0, -6, { ...PALETTE.ena, pose: 'hang' }).setScale(0.8);
      const rope = scene.add.line(0, 0, 0, 25, 0, 60, 0xc8c0b0).setOrigin(0).setLineWidth(1.5);
      c.add([frame, fig, rope, scene.add.text(0, 30, '画布', textStyle(11, '#8a867e')).setOrigin(0.5, 0)]);
      break;
    }
    case 'drained_mizuki':
      c.add(makeFigure(scene, 0, 0, { ...PALETTE.mizuki, pose: 'lie', label: '瑞希', alpha: 0.85 }));
      c.add(scene.add.ellipse(4, -2, 54, 18, 0x2a0a0a, 0.5));
      break;
    case 'folded_clothes': {
      // 没有人。衣服叠在椅子上，旁边的镜子被布盖着
      const chair = scene.add.rectangle(-20, -10, 26, 26, 0x4a3a32);
      const clothes = scene.add.rectangle(-20, -16, 20, 10, PALETTE.mizuki.body);
      const mirror = scene.add.rectangle(26, -30, 30, 56, 0xd8d0d4);
      c.add([chair, clothes, mirror, scene.add.text(0, 8, '叠好的衣服 / 盖着布的镜子', textStyle(11, '#8a867e')).setOrigin(0.5, 0)]);
      break;
    }
    case 'shattering_kanade':
    case 'blank_score_kanade':
      c.add(makeFigure(scene, 0, 0, { ...PALETTE.kanade, pose: id === 'blank_score_kanade' ? 'away' : 'sit', label: '奏' }));
      break;
    default:
      c.add(scene.add.text(0, 0, id, textStyle(12, '#8a867e')).setOrigin(0.5));
  }
  return c;
}
