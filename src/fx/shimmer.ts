import * as Phaser from 'phaser';

/** Heat haze: inside a circle, rows of pixels shift sideways in 1 px steps, like hot air (shader blueprint §5.2). */
export class Shimmer extends Phaser.Filters.Controller {
  x = 0;
  y = 0;
  radius = 18;
  strength = 1; // px rows shift at most
  time = 0; // s, drives the waves
  keep = [0, 0, 0, 0]; // screen px box (x0, y0, x1, y1) left untouched: the runner himself, so he doesn't wobble

  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    super(camera, 'FilterShimmer');
    this.active = false;
  }
}

const FRAG = `
#pragma phaserTemplate(shaderName)
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform vec2 center;
uniform float radius;
uniform float strength;
uniform float time;
uniform vec4 keep;
varying vec2 outTexCoord;
#pragma phaserTemplate(fragmentHeader)

void main() {
  vec2 px = floor(outTexCoord * resolution) + 0.5;
  vec2 p = vec2(px.x, resolution.y - px.y);
  float dist = length(p - center);
  vec2 uv = outTexCoord;
  bool inKeep = p.x >= keep.x && p.x <= keep.z && p.y >= keep.y && p.y <= keep.w;
  if (dist < radius && !inKeep) {
    float fall = 1.0 - dist / radius;
    float row = floor(p.y / 2.0); // 2 px rows: reads as waves, not noise
    float off = floor(strength * fall * 1.5 * sin(row * 1.3 + time * 14.0) + 0.5);
    float from = p.x + off; // the screen x this pixel reads from (texture x runs the same way as screen x)
    if (from < keep.x || from > keep.z || p.y < keep.y || p.y > keep.w) uv.x += off / resolution.x; // never pull his pixels out into the haze
  }
  gl_FragColor = boundedSampler(uMainSampler, uv);
}`;

export class ShimmerNode extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super('FilterShimmer', manager, undefined, FRAG);
  }

  setupUniforms(c: Shimmer, dc: Phaser.Renderer.WebGL.DrawingContext) {
    const pm = this.programManager;
    pm.setUniform('resolution', [dc.width, dc.height]);
    pm.setUniform('center', [c.x, c.y]);
    pm.setUniform('radius', c.radius);
    pm.setUniform('strength', c.strength);
    pm.setUniform('time', c.time);
    pm.setUniform('keep', c.keep);
  }
}
