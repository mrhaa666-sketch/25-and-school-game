import type Phaser from 'phaser';
import { makeFigure, PALETTE } from '../systems/figures';
import { textStyle } from '../systems/style';

/**
 * 成员场景的占位画面（交接文档 4.2）。id 来自 cycles/*.json 的 scenes 字段。
 * 克制处理：只画轮廓和关键物件，不画细节。M6 替换为作者准备的立绘。
 */
export function drawMemberScene(scene: Phaser.Scene, id: string, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(95);
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
