import * as Phaser from 'phaser';

/** Heat haze: inside a circle, rows of pixels shift sideways in 1 px steps, like hot air (shader blueprint §5.2). */
export class Shimmer extends Phaser.Filters.Controller {
  x = 0;
  y = 0;
  radius = 18;
  strength = 1; // px rows shift at most
  time = 0; // s, drives the waves

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
varying vec2 outTexCoord;
#pragma phaserTemplate(fragmentHeader)

void main() {
  vec2 px = floor(outTexCoord * resolution) + 0.5;
  vec2 p = vec2(px.x, resolution.y - px.y);
  float dist = length(p - center);
  vec2 uv = outTexCoord;
  if (dist < radius) {
    float fall = 1.0 - dist / radius;
    float row = floor(p.y / 2.0); // 2 px rows: reads as waves, not noise
    float off = floor(strength * fall * 1.5 * sin(row * 1.3 + time * 14.0) + 0.5);
    uv.x += off / resolution.x;
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
  }
}
