import Phaser from 'phaser';

/**
 * 视野边缘模糊（交接文档 2.1：档位 2 起「视野边缘模糊」）。
 * 中央保持清晰，从 inner 半径开始往外越来越模糊。
 * strength = 最外圈的采样半径（像素），0 表示关闭。
 */
const FRAG = `
#define SHADER_NAME EDGE_BLUR_FS
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uStrength;
uniform float uInner;
varying vec2 outTexCoord;

void main() {
  vec2 uv = outTexCoord;
  vec2 d = uv - 0.5;
  d.x *= uResolution.x / uResolution.y;
  float r = length(d) / 0.9;                                  // 0 中央 ~ 1 角落
  float k = smoothstep(uInner, 1.0, r) * uStrength;           // 这一点的模糊半径（像素）
  if (k < 0.25) { gl_FragColor = texture2D(uMainSampler, uv); return; }
  vec2 px = k / uResolution;
  vec4 c = texture2D(uMainSampler, uv) * 0.2;
  c += texture2D(uMainSampler, uv + vec2( px.x, 0.0)) * 0.1;
  c += texture2D(uMainSampler, uv + vec2(-px.x, 0.0)) * 0.1;
  c += texture2D(uMainSampler, uv + vec2(0.0,  px.y)) * 0.1;
  c += texture2D(uMainSampler, uv + vec2(0.0, -px.y)) * 0.1;
  c += texture2D(uMainSampler, uv + px * 0.7) * 0.1;
  c += texture2D(uMainSampler, uv - px * 0.7) * 0.1;
  c += texture2D(uMainSampler, uv + vec2(px.x, -px.y) * 0.7) * 0.1;
  c += texture2D(uMainSampler, uv + vec2(-px.x, px.y) * 0.7) * 0.1;
  gl_FragColor = c;
}
`;

export class EdgeBlurPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly KEY = 'EdgeBlur';
  strength = 0;
  inner = 0.45;

  constructor(game: Phaser.Game) {
    super({ game, name: EdgeBlurPipeline.KEY, fragShader: FRAG });
  }

  onPreRender(): void {
    this.set1f('uStrength', this.strength);
    this.set1f('uInner', this.inner);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
  }
}
