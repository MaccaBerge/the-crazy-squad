// How a falling leaf moves (nature blueprint §5): it drops from the canopy to the ground under it, swinging back and
// forth like a pendulum (slowest at the ends of the swing, fastest through the middle) while the wind carries it
// downwind. Pure, so it's testable; leaves.ts draws it.

import type { WindParams } from './weather';
import { wind } from './wind';

export interface Leaf {
  x: number; // world position of the ground under the leaf
  y: number;
  z: number; // height above that ground; 0 = landed
  phase: number; // where in its swing the leaf started
  age: number; // s since it landed (0 while falling)
}

const FALL = 16; // px/s straight down at the middle of a swing
const SWING = 5; // px the leaf swings to each side
const SWING_RATE = 2.4; // rad/s: about one back-and-forth every 2.6 s
const DRIFT = 45; // px/s sideways at full wind
export const LIE = 4; // s a landed leaf stays before fading
export const FADE = 1.2; // s it takes to fade

/** Swing position -1..1 at time t: the back and forth. */
export const swing = (l: Leaf, t: number) => Math.sin(l.phase + t * SWING_RATE);

/** Moves a leaf on by dt seconds. Returns false once it has faded away. */
export function stepLeaf(l: Leaf, t: number, dt: number, weather: WindParams) {
  if (l.z <= 0) return (l.age += dt) < LIE + FADE;
  const w = wind(l.x, l.y - l.z, t, weather);
  const dir = (weather.windDir * Math.PI) / 180;
  l.x += Math.cos(dir) * w * DRIFT * dt;
  l.y += Math.sin(dir) * w * DRIFT * dt;
  const s = swing(l, t);
  l.z = Math.max(0, l.z - FALL * (0.35 + 0.65 * Math.sqrt(1 - s * s)) * dt); // hangs at each end of the swing
  return true;
}

/** Where to draw the leaf: on the ground, lifted by its height, swung sideways while it's in the air. */
export const leafDrawn = (l: Leaf, t: number) => ({
  x: Math.round(l.x + (l.z > 0 ? SWING * swing(l, t) : 0)),
  y: Math.round(l.y - l.z),
});

/** Leaves per second a tree sheds: its `shed` rate in a light breeze, more as the wind picks up, a few even in calm. */
export const shedRate = (shed: number, windHere: number) => shed * (0.3 + 1.7 * Math.min(1, Math.abs(windHere)));
