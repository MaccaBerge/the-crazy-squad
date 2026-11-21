import * as Phaser from 'phaser';

/** Where a shockwave is `t` (0–1) through its life: the ring snaps out fast and slows (ease-out), its push fades away. */
export function shockwaveAt(t: number, maxRadius: number, maxStrength: number) {
  const u = Math.min(Math.max(t, 0), 1);
  return { radius: maxRadius * (1 - (1 - u) ** 3), strength: maxStrength * (1 - u) ** 2 };
}

/** A ring that bends the screen outward as it grows (shader blueprint §5.1). Centre and sizes in screen pixels. */
export class Shockwave extends Phaser.Filters.Controller {
  x = 0;
  y = 0;
  radius = 0;
  thickness = 10;
  strength = 0;
  edge = 0.25; // how much the ring brightens, in `color`
  color = [1, 0.45, 0.24];

  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    super(camera, 'FilterShockwave');
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
uniform float thickness;
uniform float strength;
uniform float edge;
uniform vec3 color;
varying vec2 outTexCoord;
#pragma phaserTemplate(fragmentHeader)

void main() {
  // This pixel, in whole screen pixels with y down (the texture's y runs up).
  vec2 px = floor(outTexCoord * resolution) + 0.5;
  vec2 p = vec2(px.x, resolution.y - px.y);
  vec2 d = p - center;
  float dist = length(d);
  float x = (dist - radius) / thickness;
  vec2 uv = outTexCoord;
  vec3 glow = vec3(0.0);
  if (abs(x) < 1.0 && dist > 0.0) {
    float bump = 1.0 - x * x;
    vec2 off = floor(-normalize(d) * strength * bump + 0.5); // read from further in: the picture bulges out, in whole pixels
    uv += vec2(off.x, -off.y) / resolution;
    glow = color * edge * bump;
  }
  gl_FragColor = boundedSampler(uMainSampler, uv) + vec4(glow, 0.0);
}`;

export class ShockwaveNode extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super('FilterShockwave', manager, undefined, FRAG);
  }

  setupUniforms(c: Shockwave, dc: Phaser.Renderer.WebGL.DrawingContext) {
    const pm = this.programManager;
    pm.setUniform('resolution', [dc.width, dc.height]);
    pm.setUniform('center', [c.x, c.y]);
    pm.setUniform('radius', c.radius);
    pm.setUniform('thickness', c.thickness);
    pm.setUniform('strength', c.strength);
    pm.setUniform('edge', c.edge);
    pm.setUniform('color', c.color);
  }
}
