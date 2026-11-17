// Hanging things (nature blueprint §6): signs, flags and washing lines, drawn by code on the palette and moved by the
// wind. Pure (no Phaser), so tests and preview scripts can draw them. hanging.ts puts them in the level.
//
// Every drawing is a list of pixels around the object's anchor: (0, 0) is where its post meets the ground, -y is up.

import { RAMPS } from './bladeShapes';

export type HangingKind = 'sign' | 'flag' | 'line';
export const HANGING_KINDS: readonly HangingKind[] = ['sign', 'flag', 'line'];
export const isHangingKind = (k: unknown): k is HangingKind => HANGING_KINDS.includes(k as HangingKind);

export interface Px { x: number; y: number; color: number }

// ---- Swinging -------------------------------------------------------------------------------------------------------

/** A hanging piece's swing: angle (radians, + = towards +x) and its speed. */
export interface Pendulum { a: number; v: number }

const STIFF = 22; // how hard it swings back (1/s²): about one swing a second
const DAMP = 1.6; // 1/s: low, so it keeps swinging back and forth after a gust
export const MAX_ANGLE = 0.55; // radians at full wind

/** Moves a pendulum on by dt towards `lean` (-1..1, the sideways wind), overshooting and swinging back like the real thing. */
export function swingStep(p: Pendulum, lean: number, dt: number, flex = 1) {
  const target = lean * MAX_ANGLE * flex;
  p.v += ((target - p.a) * STIFF - p.v * DAMP) * dt;
  p.a = Math.max(-1.2, Math.min(1.2, p.a + p.v * dt));
}

/** Pixel rows hanging from a pivot shear sideways by whole px as they swing: further the lower they hang. */
export const shear = (angle: number, below: number) => Math.round(Math.sin(angle) * below);

// ---- Drawings -------------------------------------------------------------------------------------------------------

type Ramp = readonly number[];

/** Typed pixel rows: `.` empty, a digit is a step of the ramp (0 = darkest). */
function rows(art: string[], ramp: Ramp, ox: number, oy: number, shift: (row: number) => number = () => 0): Px[] {
  const out: Px[] = [];
  art.forEach((row, r) => [...row].forEach((c, x) => c !== '.' && out.push({ x: ox + x + shift(r), y: oy + r, color: ramp[+c] })));
  return out;
}

const post = (x: number, height: number): Px[] =>
  Array.from({ length: height }, (_, i) => [
    { x, y: -1 - i, color: RAMPS.wood[2] },
    { x: x + 1, y: -1 - i, color: RAMPS.wood[1] }, // shaded right side, light from the top-left
  ]).flat();

// Sign: a post with an arm, a plank hanging from it on two short chains.
const SIGN_POST = 22;
const CHAIN = 3; // px of chain between the arm and the plank
const PLANK = ['0000000000', '0333333330', '0321131230', '0322222230', '0322222220', '0000000000'];

/** A sign swung `angle` radians. The plank hangs from the arm at the top of the post. */
export function signPixels(angle: number): Px[] {
  const arm = -SIGN_POST; // row of the arm
  const out = post(0, SIGN_POST);
  for (let x = 2; x <= 12; x++) out.push({ x, y: arm, color: RAMPS.wood[x === 12 ? 1 : 2] });
  // The plank is stiff, so it moves as one piece, as far as its middle swings (chains plus half the plank below the arm).
  const swing = shear(angle, CHAIN + PLANK.length / 2);
  for (const cx of [3, 10])
    for (let r = 1; r <= CHAIN; r++) out.push({ x: cx + Math.round((swing * r) / (CHAIN + 1)), y: arm + r, color: RAMPS.violet[0] });
  return out.concat(rows(PLANK, RAMPS.wood, 2 + swing, arm + CHAIN + 1));
}

// Flag: a tall pole with cloth at the top that streams out with the wind and hangs limp without it.
const FLAG_POLE = 30;
const CLOTH = { w: 12, h: 7 };

/** A flag in wind of `strength` 0..1 blowing to `side` (+1 right, -1 left), at time t (the ripple runs along it). */
export function flagPixels(strength: number, side: number, t: number): Px[] {
  const out = post(0, FLAG_POLE);
  out.push({ x: 0, y: -FLAG_POLE - 1, color: RAMPS.autumn[3] }, { x: 1, y: -FLAG_POLE - 1, color: RAMPS.autumn[2] }); // knob
  const s = Math.max(0, Math.min(1, strength));
  const drop = (c: number) => // how far column c (1 = at the pole) hangs below the top of the pole
    Math.round((1 - s) * c * 0.7 + (0.6 + 0.6 * s) * (c / CLOTH.w) * Math.sin(c * 0.5 - t * (3.5 + 2.5 * s))); // a slow, low ripple: faster or higher flickers
  for (let c = 1; c <= CLOTH.w; c++) {
    const dy = drop(c), slope = drop(c + 1) - dy;
    const x = side > 0 ? 1 + c : -c; // out from the pole's downwind side
    for (let r = 0; r < CLOTH.h; r++) {
      const edge = r === 0 || r === CLOTH.h - 1 || c === CLOTH.w;
      const step = edge ? 1 : Math.max(1, Math.min(3, 2 - slope)); // facing up the ripple catches light
      out.push({ x, y: -FLAG_POLE + dy + r, color: RAMPS.berry[step] });
    }
  }
  return out;
}

// Washing line: two posts, a sagging rope and clothes pegged along it, each swinging on its own.
const LINE_POST = 18;
const CLOTHES: { art: string[]; ramp: Ramp }[] = [
  { art: ['.22.22.', '2233322', '2.333.2', '..332..', '..332..', '..221..'], ramp: RAMPS.berry }, // shirt
  { art: ['33', '33', '33', '32', '322', '.11'], ramp: RAMPS.autumn }, // sock
  { art: ['34443', '34443', '33443', '33332', '33332', '33332', '22221'], ramp: RAMPS.teal }, // towel
  { art: ['44444443', '44444443', '44444433', '44444433', '44444433', '44443333', '33333332'], ramp: RAMPS.autumn }, // sheet
];
const GAP = 3; // px between pegged clothes

/** The clothes along a line `width` px wide: which piece, and the x it's pegged at. */
export function lineClothes(width: number) {
  const out: { piece: number; x: number }[] = [];
  for (let x = 4, i = 0; x + CLOTHES[i % CLOTHES.length].art[0].length <= width - 3; i++) {
    out.push({ piece: i % CLOTHES.length, x });
    x += CLOTHES[i % CLOTHES.length].art[0].length + GAP;
  }
  return out;
}

/** Rope height (px below the post tops) at x along a line `width` wide: a gentle sag, deepest in the middle. */
const sag = (x: number, width: number) => Math.round(3 * (1 - ((2 * x) / width - 1) ** 2) + width / 60);

/** A washing line `width` px between its posts, each piece of clothing swung by its own angle in `angles`. */
export function linePixels(width: number, angles: number[]): Px[] {
  const top = -LINE_POST;
  const out = [...post(0, LINE_POST), ...post(width, LINE_POST)];
  for (let x = 2; x < width; x++) out.push({ x, y: top + sag(x, width), color: RAMPS.wood[3] });
  lineClothes(width).forEach(({ piece, x }, i) => {
    const { art, ramp } = CLOTHES[piece];
    const pegY = top + sag(x + art[0].length / 2, width) + 1;
    out.push(...rows(art, ramp, x, pegY, (r) => shear(angles[i] ?? 0, r)));
  });
  return out;
}
