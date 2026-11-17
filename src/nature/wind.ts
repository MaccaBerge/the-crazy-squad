import type { WindParams } from './weather';

// The one wind (nature blueprint §3): a vector field over the level, deterministic in place and time, so everything
// that sways agrees. Three layers make it feel alive:
//  1. The prevailing direction veers slowly over time, more in light air than in a storm.
//  2. Eddies: large, slow swirls bend the direction from place to place and drift downwind.
//  3. Gust puffs: each gust is a blob that grows, travels its own slightly different way across the land and dies out.

export interface WindVec { x: number; y: number } // length 0–1 (full strength); x > 0 blows right, y > 0 blows down

const DEG = Math.PI / 180;
const EDDY_DRIFT = 40; // px/s the eddies drift downwind

// Gust puffs. Every CELL × CELL square of the world releases puffs on its own clock, so they cover any size of level.
const CELL = 320;
const GUST_SPEED = 90; // px/s a puff travels
const PUFF_LIFE = 5; // s from first stir to gone
const PUFF_ALONG = 70; // px: half-length along its travel, so it takes about 1.5 s to pass a spot
const PUFF_ACROSS = 150; // px: half-width
const PUFF_SPREAD = 50 * DEG; // how far a puff's own heading strays from the prevailing wind, either way
const REACH = Math.ceil((GUST_SPEED * PUFF_LIFE + PUFF_ACROSS) / CELL); // cells away a puff can still reach

/** Deterministic 0–1 noise from integers. */
function hash(a: number, b: number, c: number) {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The prevailing wind direction (radians) at time t: the weather's `windDir`, veering up to `windVeer` degrees either way. */
export const prevailing = (t: number, p: WindParams) =>
  (p.windDir + p.windVeer * (0.6 * Math.sin(t * 0.07 + 1) + 0.4 * Math.sin(t * 0.19 + 4))) * DEG;

/** How much gust is passing a spot, 0–1, and which way the strongest puff there is heading. */
function puffs(x: number, y: number, t: number, p: WindParams) {
  const period = p.gustEvery * 1.6; // each cell's clock; neighbouring cells' puffs overlap to about one gust per gustEvery
  let sum = 0, gx = 0, gy = 0;
  const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
  for (let i = ci - REACH; i <= ci + REACH; i++)
    for (let j = cj - REACH; j <= cj + REACH; j++)
      for (let n = Math.floor((t - PUFF_LIFE) / period) - 1; n <= Math.floor(t / period); n++) {
        const born = (n + hash(i, j, n) * 0.9) * period;
        const age = t - born;
        if (age < 0 || age > PUFF_LIFE) continue;
        const heading = prevailing(born, p) + (hash(j, n, i) * 2 - 1) * PUFF_SPREAD;
        const cos = Math.cos(heading), sin = Math.sin(heading);
        const speed = GUST_SPEED * (0.8 + 0.4 * hash(n, i, j));
        const cx = (i + hash(i, n, j)) * CELL + cos * speed * age;
        const cy = (j + hash(n, j, i)) * CELL + sin * speed * age;
        const along = ((x - cx) * cos + (y - cy) * sin) / PUFF_ALONG;
        const across = (-(x - cx) * sin + (y - cy) * cos) / PUFF_ACROSS;
        if (along * along + across * across > 9) continue;
        const b = Math.sin((Math.PI * age) / PUFF_LIFE) ** 2 * Math.exp(-along * along - across * across);
        sum += b;
        gx += b * cos;
        gy += b * sin;
      }
  return { amount: Math.min(1, sum), x: gx, y: gy };
}

/** How much of a gust is passing a spot right now, 0–1 (the orange arrows in the V view). */
export const gust = (x: number, y: number, t: number, p: WindParams) => puffs(x, y, t, p).amount;

/** The wind at a world position (px) and time (s). */
export function windAt(x: number, y: number, t: number, p: WindParams): WindVec {
  const d = p.windDir * DEG; // the sway waves and eddies roll along the weather's own direction, so far-off spots don't sweep
  const along = x * Math.cos(d) + y * Math.sin(d);
  const across = -x * Math.sin(d) + y * Math.cos(d);

  // Steady sway: waves rolling downwind, two speeds so it never looks like a loop. Mostly forwards, a little back.
  const sway = 0.6 * Math.sin(t * 1.9 - along * 0.045) + 0.4 * Math.sin(t * 0.8 - along * 0.018 + across * 0.01 + 1.7);
  const strength = p.windBase * (0.4 + 0.6 * sway);
  // Eddies: a slow swirl field, about a screen across, bending the direction by up to 60% of windVeer.
  const drifted = along - EDDY_DRIFT * t;
  const eddy = 0.6 * p.windVeer * DEG * (0.6 * Math.sin(drifted * 0.007 + across * 0.004) + 0.4 * Math.sin(-drifted * 0.003 + across * 0.009 + 2.1));
  const dir = prevailing(t, p) + eddy;

  const g = puffs(x, y, t, p);
  const len = Math.hypot(g.x, g.y);
  const scale = len > 0 ? (p.windGust * g.amount) / len : 0; // gusts push the way their puffs head
  let wx = strength * Math.cos(dir) + g.x * scale;
  let wy = strength * Math.sin(dir) + g.y * scale;
  const m = Math.hypot(wx, wy);
  if (m > 1) (wx /= m), (wy /= m);
  return { x: wx, y: wy };
}
