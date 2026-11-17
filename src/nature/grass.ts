import * as Phaser from 'phaser';
import type { WindParams } from './weather';
import { wind } from './wind';

// Moving grass (nature blueprint §4). Every blade is one member of a single SpriteGPULayer, sorted back to front.
// Bending switches the blade's frame between pre-drawn lean poses, so blades stay pixel perfect.

const TEXTURE = 'grass-blades';
const CELL = { w: 8, h: 16 };
export const MAX_POSE = 3; // poses are -3..3: three steps of lean each way
const CHUNK = 16; // px; wind is sampled once per chunk
const VIEW_MARGIN = 8; // px; blades just outside the view still update, so leaning ones don't pop at the edge

/** Placeholder blade types: height and ramp tones from root to tip. Real blade art replaces these in step 5. */
// Tones are from the cool ramps in art/palette.mjs (fern, moss, teal).
const TYPES = [
  { h: 6, tones: [0x3f7a2e, 0x629f54, 0xa1b875] },
  { h: 10, tones: [0x1d5217, 0x3f7a2e, 0x629f54] },
  { h: 8, tones: [0x6b6324, 0x818634, 0xb3b85a] },
  { h: 12, tones: [0x27596c, 0x368578, 0x549e9f] },
];

export interface Blade { x: number; y: number; type: number; lean: number; flex: number }

/** Sideways offset (px) of row `r` (0 = root) of a blade `h` tall, in lean pose `pose`: the tip moves most. */
export const bendOffset = (pose: number, r: number, h: number) => Math.round(pose * 1.3 * (r / (h - 1)) ** 2);

/** The pose a blade takes in a sideways wind of `w` (-1..1). */
export const poseFor = (lean: number, flex: number, w: number) =>
  Math.max(-MAX_POSE, Math.min(MAX_POSE, Math.round(lean + w * flex * MAX_POSE)));

/** Seeded random numbers in 0..1 (mulberry32), so the same seed always scatters the same grass. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` blades scattered evenly at random over a rectangle, sorted back to front. */
export function scatter(area: { x: number; y: number; w: number; h: number }, count: number, seed: number): Blade[] {
  const rnd = seeded(seed);
  const blades = Array.from({ length: count }, () => ({
    x: Math.floor(area.x + rnd() * area.w),
    y: Math.floor(area.y + rnd() * area.h),
    type: Math.floor(rnd() * TYPES.length),
    lean: (rnd() - 0.5) * 1.2,
    flex: 0.7 + rnd() * 0.5,
  }));
  return blades.sort((a, b) => a.y - b.y);
}

/** Draws every blade type in every pose onto one canvas texture: a row per type, a column per pose. */
function makeTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(TEXTURE)) return;
  const poses = MAX_POSE * 2 + 1;
  const tex = scene.textures.createCanvas(TEXTURE, 64, 64)!; // power of two, so frames don't bleed into each other
  const ctx = tex.getContext();
  TYPES.forEach(({ h, tones }, type) =>
    Array.from({ length: poses }, (_, i) => {
      const pose = i - MAX_POSE;
      const x0 = i * CELL.w, y0 = type * CELL.h;
      for (let r = 0; r < h; r++) {
        // Leaning far shows the blade's shaded side: one tone darker.
        const tone = Math.max(0, Math.min(tones.length - 1, Math.floor((r / h) * tones.length)) - (Math.abs(pose) >= 2 ? 1 : 0));
        ctx.fillStyle = `#${tones[tone].toString(16).padStart(6, '0')}`;
        const x = Math.max(0, Math.min(CELL.w - 1, CELL.w / 2 + bendOffset(pose, r, h)));
        ctx.fillRect(x0 + x, y0 + CELL.h - 1 - r, 1, 1);
      }
      tex.add(`${type}:${pose}`, 0, x0, y0, CELL.w, CELL.h);
    }),
  );
  tex.refresh();
}

export class Grass {
  readonly layer: Phaser.GameObjects.SpriteGPULayer;
  private pose: Int8Array;
  private frames: number[][]; // frame index per type and pose (+MAX_POSE)
  private chunks = new Map<number, number[]>(); // chunk key -> member indices
  private cols: number;
  private patch = new Uint32Array(25);
  private mask = Object.assign(new Array<number>(25).fill(0), { 24: 1 }); // member data slot 24 is the frame
  private f32 = new Float32Array(this.patch.buffer);

  constructor(scene: Phaser.Scene, private blades: Blade[], worldWidth: number, depth: number) {
    makeTexture(scene);
    this.layer = scene.add.spriteGPULayer(TEXTURE, blades.length).setDepth(depth);
    const idx = this.layer.frameDataIndices as Record<string, number>;
    this.frames = TYPES.map((_, type) => Array.from({ length: MAX_POSE * 2 + 1 }, (_, i) => idx[`${type}:${i - MAX_POSE}`]));
    this.pose = new Int8Array(blades.length);
    this.cols = Math.ceil(worldWidth / CHUNK);
    blades.forEach((b, i) => {
      this.layer.addMember({ x: b.x + 0.5, y: b.y + 1, originX: 0.5, originY: 1, frame: `${b.type}:0` });
      const key = Math.floor(b.y / CHUNK) * this.cols + Math.floor(b.x / CHUNK);
      (this.chunks.get(key) ?? this.chunks.set(key, []).get(key)!).push(i);
    });
  }

  /** Re-poses the blades in view whose pose changed. Returns how many changed, for the stress test readout. */
  update(view: Phaser.Geom.Rectangle, t: number, weather: WindParams) {
    const side = Math.cos((weather.windDir * Math.PI) / 180); // blades lean left/right only
    let changed = 0;
    const c0 = Math.max(0, Math.floor((view.x - VIEW_MARGIN) / CHUNK)), c1 = Math.min(this.cols - 1, Math.floor((view.right + VIEW_MARGIN) / CHUNK));
    const r0 = Math.max(0, Math.floor((view.y - VIEW_MARGIN) / CHUNK)), r1 = Math.floor((view.bottom + CELL.h) / CHUNK);
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++) {
        const members = this.chunks.get(row * this.cols + col);
        if (!members) continue;
        const w = wind(col * CHUNK + CHUNK / 2, row * CHUNK + CHUNK / 2, t, weather) * side;
        for (const i of members) {
          const b = this.blades[i];
          const pose = poseFor(b.lean, b.flex, w);
          if (pose === this.pose[i]) continue;
          this.pose[i] = pose;
          this.f32[24] = this.frames[b.type][pose + MAX_POSE];
          this.layer.patchMember(i, this.patch, this.mask);
          changed++;
        }
      }
    return changed;
  }
}
