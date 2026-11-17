import * as Phaser from 'phaser';
import { type MapObject, props } from '../world/spawner';
import { TILE } from '../world/constants';
import type { Force } from './forces';
import type { WindParams } from './weather';
import { wind } from './wind';

// Moving grass (nature blueprint §4). Every blade is one member of a single SpriteGPULayer, sorted back to front.
// Bending switches the blade's frame between pre-drawn lean poses, so blades stay pixel perfect.

const TEXTURE = 'grass-blades';
const CELL = { w: 8, h: 16 };
export const MAX_POSE = 3; // poses are -3..3: three steps of lean each way
const CHUNK = 16; // px; wind is sampled once per chunk
// px; blades are drawn in horizontal strips, each at the depth of its top row, so characters sort between them
// (a blade up to STRIP-1 px below the feet can still draw behind them).
const STRIP = 4;
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

/** The pose a blade takes in a sideways wind of `w` (-1..1), plus `push` poses from bodies moving through it. */
export const poseFor = (lean: number, flex: number, w: number, push = 0) =>
  Math.max(-MAX_POSE, Math.min(MAX_POSE, Math.round(lean + w * flex * MAX_POSE + push)));

const FLAT = 0.35; // inside this share of a force's radius, blades are flattened
// Around a body, out to AURA times its radius, blades bend gently away (up to AURA_POSES), so a body in a field has presence.
export const AURA = 2.2;
const AURA_POSES = 1.2;

/**
 * How many poses a force pushes a blade rooted `dx`, `dy` px from its centre, away from the centre:
 * flat under the feet (strong enough to beat the wind), easing off to the force's edge, then a gentle bend out to AURA.
 */
export function pushFor(dx: number, dy: number, f: Pick<Force, 'rx' | 'ry'>) {
  const d = Math.hypot(dx / f.rx, dy / f.ry);
  if (d >= AURA) return 0;
  const poses =
    d < FLAT ? MAX_POSE + 1
    : d < 1 ? AURA_POSES + ((1 - d) / (1 - FLAT)) * (MAX_POSE + 1 - AURA_POSES)
    : (AURA_POSES * (AURA - d)) / (AURA - 1);
  return (dx < 0 ? -1 : 1) * poses;
}

const STIFFNESS = 220; // spring-back pull
const DAMPING = 11; // per second; a little overshoot, then still
const PUSH_IN = 30; // per second; how fast a blade gives way

/** One step of a blade's push towards `target`: quick to give way, springy on the way back. Returns [push, velocity]. */
export function springStep(push: number, vel: number, target: number, dt: number): [number, number] {
  if (Math.abs(target) > Math.abs(push) && Math.sign(target) !== -Math.sign(push))
    return [push + (target - push) * Math.min(1, PUSH_IN * dt), 0];
  vel = (vel + (target - push) * STIFFNESS * dt) * Math.exp(-DAMPING * dt);
  return [push + vel * dt, vel];
}

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
export function scatter(
  area: { x: number; y: number; w: number; h: number },
  count: number,
  seed: number,
  inside: (x: number, y: number) => boolean = () => true,
): Blade[] {
  const rnd = seeded(seed);
  const blades = Array.from({ length: count }, () => ({
    x: Math.floor(area.x + rnd() * area.w),
    y: Math.floor(area.y + rnd() * area.h),
    type: Math.floor(rnd() * TYPES.length),
    lean: (rnd() - 0.5) * 1.2,
    flex: 0.7 + rnd() * 0.5,
  }));
  return blades.filter((b) => inside(b.x, b.y)).sort((a, b) => a.y - b.y);
}

const DEFAULT_DENSITY = 6; // blades per tile

/** Even-odd rule: whether (x, y) is inside the polygon. */
function insidePolygon(pts: { x: number; y: number }[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Blades for every area on a map's `Grass` object layer (rectangles or polygons), sorted back to front.
 * Optional properties: `density` (blades per tile) and `seed` (defaults to the object's id, so each area differs).
 */
export function bladesFromMap(areas: MapObject[]): Blade[] {
  return areas
    .flatMap((o) => {
      const { density = DEFAULT_DENSITY, seed = o.id } = props(o) as { density?: number; seed?: number };
      const x = o.x ?? 0, y = o.y ?? 0;
      const poly = o.polygon?.map((p) => ({ x: x + p.x, y: y + p.y }));
      const xs = poly?.map((p) => p.x) ?? [x, x + (o.width ?? 0)];
      const ys = poly?.map((p) => p.y) ?? [y, y + (o.height ?? 0)];
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      const count = Math.round(((box.w * box.h) / TILE ** 2) * density);
      return scatter(box, count, seed, poly && ((px, py) => insidePolygon(poly, px + 0.5, py + 0.5)));
    })
    .sort((a, b) => a.y - b.y);
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
  private layers: Phaser.GameObjects.SpriteGPULayer[] = []; // one per strip that has blades
  private layerOf: Uint16Array; // per blade: its strip's layer
  private member: Uint32Array; // per blade: its index in that layer
  private pose: Int8Array;
  private frames: number[][]; // frame index per type and pose (+MAX_POSE)
  private chunks = new Map<number, number[]>(); // chunk key -> member indices
  private cols: number;
  private patch = new Uint32Array(25);
  private mask = Object.assign(new Array<number>(25).fill(0), { 24: 1 }); // member data slot 24 is the frame
  private f32 = new Float32Array(this.patch.buffer);
  // Pushed blades: how far (in poses) and how fast they're moving back. `active` holds every blade not at rest.
  private push: Float32Array;
  private vel: Float32Array;
  private target: Float32Array;
  private active = new Set<number>();

  /** `blades` must be sorted back to front (`scatter` does that). Strip depths are `depth` + their top y, like actors' feet. */
  constructor(scene: Phaser.Scene, private blades: Blade[], worldWidth: number, depth: number) {
    makeTexture(scene);
    this.layerOf = new Uint16Array(blades.length);
    this.member = new Uint32Array(blades.length);
    for (let start = 0; start < blades.length; ) {
      const strip = Math.floor(blades[start].y / STRIP);
      let end = start;
      while (end < blades.length && Math.floor(blades[end].y / STRIP) === strip) end++;
      const layer = scene.add.spriteGPULayer(TEXTURE, end - start).setDepth(depth + strip * STRIP);
      for (let i = start; i < end; i++) {
        const b = blades[i];
        // The root is the cell's middle column (CELL.w / 2), so x = b.x puts it on b.x with the quad's edges on whole pixels.
        // An edge on a half pixel snaps at a different camera scroll than the ground, and the grass jitters against it.
        layer.addMember({ x: b.x, y: b.y + 1, originX: 0.5, originY: 1, frame: `${b.type}:0` });
        this.layerOf[i] = this.layers.length;
        this.member[i] = i - start;
      }
      this.layers.push(layer);
      start = end;
    }
    const idx = (this.layers[0]?.frameDataIndices ?? {}) as Record<string, number>;
    this.frames = TYPES.map((_, type) => Array.from({ length: MAX_POSE * 2 + 1 }, (_, i) => idx[`${type}:${i - MAX_POSE}`]));
    this.pose = new Int8Array(blades.length);
    this.push = new Float32Array(blades.length);
    this.vel = new Float32Array(blades.length);
    this.target = new Float32Array(blades.length);
    this.cols = Math.ceil(worldWidth / CHUNK);
    blades.forEach((b, i) => {
      const key = Math.floor(b.y / CHUNK) * this.cols + Math.floor(b.x / CHUNK);
      (this.chunks.get(key) ?? this.chunks.set(key, []).get(key)!).push(i);
    });
  }

  /** How many blades are pushed or still springing back. */
  get pushed() {
    return this.active.size;
  }

  /** Pushes blades away from each force, and springs released ones back. */
  private applyForces(forces: readonly Force[], dt: number) {
    for (const i of this.active) this.target[i] = 0;
    for (const f of forces)
      for (let row = Math.floor((f.y - f.ry * AURA) / CHUNK); row <= Math.floor((f.y + f.ry * AURA) / CHUNK); row++)
        for (let col = Math.floor((f.x - f.rx * AURA) / CHUNK); col <= Math.floor((f.x + f.rx * AURA) / CHUNK); col++)
          for (const i of this.chunks.get(row * this.cols + col) ?? []) {
            const p = pushFor(this.blades[i].x - f.x, this.blades[i].y - f.y, f);
            if (!p) continue;
            if (Math.abs(p) > Math.abs(this.target[i])) this.target[i] = p; // where two bodies overlap, the stronger push wins
            this.active.add(i);
          }
    for (const i of this.active) {
      [this.push[i], this.vel[i]] = springStep(this.push[i], this.vel[i], this.target[i], dt);
      if (!this.target[i] && Math.abs(this.push[i]) < 0.05 && Math.abs(this.vel[i]) < 0.05) {
        this.push[i] = this.vel[i] = 0;
        this.active.delete(i);
      }
    }
  }

  /** Re-poses the blades in view whose pose changed. Returns how many changed, for the stress test readout. */
  update(view: Phaser.Geom.Rectangle, t: number, dt: number, weather: WindParams, forces: readonly Force[]) {
    this.applyForces(forces, Math.min(dt, 0.05)); // a long frame (tab in the background) would make the spring blow up
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
          const pose = poseFor(b.lean, b.flex, w, this.push[i]);
          if (pose === this.pose[i]) continue;
          this.pose[i] = pose;
          this.f32[24] = this.frames[b.type][pose + MAX_POSE];
          this.layers[this.layerOf[i]].patchMember(this.member[i], this.patch, this.mask);
          changed++;
        }
      }
    return changed;
  }
}
