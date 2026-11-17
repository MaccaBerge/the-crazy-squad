// Cuts a tree image's canopy into leaf clumps that sway as whole pieces (DaFluffyPotato's foliage trick, nature
// blueprint §5). The brightest leaf spots seed the clumps; the lit leaves around them grow into each clump. The darker
// leaves stay put underneath, so a moving clump uncovers shade, not holes. Pure, so tests and preview scripts can run it.

import { RAMPS } from './bladeShapes';

export interface Clump {
  pixels: number[]; // indices into the image (y * w + x)
  cx: number; // centre, image px
  cy: number;
  lum: number; // mean brightness 0–1: brighter clumps sit in front and move more
}

const LIT = 0.42; // leaf pixels at least this bright belong to a clump
const SEED = 0.5; // ... and spots at least this bright start one
const MIN_SEED = 4; // px: smaller bright specks don't start a clump of their own
const MIN_CLUMP = 12; // px: smaller clumps stay put rather than flicker
export const UNDER = [0x27, 0x59, 0x6c] as const; // teal 1: the shade a moving clump uncovers

const lum = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
/** Leaves are the green, teal and moss ramps, autumn leaves, and berries and blossoms; trunk, bark and roots are wood, shadow or stone. */
const LEAF_COLORS = new Set<number>([RAMPS.teal, RAMPS.fern, RAMPS.moss, RAMPS.autumn, RAMPS.berry, RAMPS.violet].flat());
const isLeaf = (r: number, g: number, b: number) => LEAF_COLORS.has((r << 16) | (g << 8) | b);

/** Finds the leaf clumps above row `swayFrom` of an RGBA image. Clumps come back back-to-front (dim first). */
export function findClumps(px: ArrayLike<number>, w: number, h: number, swayFrom: number): Clump[] {
  const n = w * h;
  const level = new Float32Array(n).fill(-1); // brightness of lit leaf pixels, -1 elsewhere
  for (let i = 0; i < w * Math.min(h, swayFrom); i++) {
    const [r, g, b, a] = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3]];
    if (a && isLeaf(r, g, b) && lum(r, g, b) >= LIT) level[i] = lum(r, g, b);
  }
  const owner = new Int32Array(n).fill(-1);
  const neighbours = (i: number) => {
    const x = i % w, out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < w - 1) out.push(i + 1);
    if (i >= w) out.push(i - w);
    if (i < n - w) out.push(i + w);
    return out;
  };

  // Seeds: connected bright spots big enough to matter.
  let queue: number[] = [];
  let id = 0;
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (seen[i] || level[i] < SEED) continue;
    const spot = [i];
    seen[i] = 1;
    for (let k = 0; k < spot.length; k++)
      for (const j of neighbours(spot[k])) if (!seen[j] && level[j] >= SEED) (seen[j] = 1), spot.push(j);
    if (spot.length < MIN_SEED) continue;
    for (const j of spot) owner[j] = id;
    queue.push(...spot);
    id++;
  }
  // Grow every seed at once through the lit leaves, so each lit pixel joins the nearest bright spot.
  while (queue.length) {
    const next: number[] = [];
    for (const i of queue) for (const j of neighbours(i)) if (owner[j] < 0 && level[j] >= 0) (owner[j] = owner[i]), next.push(j);
    queue = next;
  }

  const clumps: Clump[] = Array.from({ length: id }, () => ({ pixels: [], cx: 0, cy: 0, lum: 0 }));
  for (let i = 0; i < n; i++) if (owner[i] >= 0) clumps[owner[i]].pixels.push(i);
  return clumps
    .filter((c) => c.pixels.length >= MIN_CLUMP)
    .map((c) => {
      for (const i of c.pixels) (c.cx += i % w), (c.cy += Math.floor(i / w)), (c.lum += level[i]);
      const k = c.pixels.length;
      return { ...c, cx: c.cx / k, cy: c.cy / k, lum: c.lum / k };
    })
    .sort((a, b) => a.lum - b.lum);
}

const RUSTLE = 1.2; // px of each clump's own rustle at full wind; none in still air

/** How far (whole px) clump number `k` moves when the wind at it is `lean` (-1..1): higher clumps further, never past
 * `sway`. The rustle grows with the wind too, so calm weather is still and a storm thrashes. */
export function clumpOffset(c: Clump, k: number, lean: number, t: number, sway: number, swayFrom: number) {
  const height = Math.max(0, Math.min(1, (swayFrom - c.cy) / swayFrom));
  const strength = Math.abs(lean);
  const dx = lean * sway * (0.5 + 0.5 * height) + RUSTLE * strength * Math.sin(t * 2.6 + k * 2.1);
  return { dx: Math.round(Math.max(-sway, Math.min(sway, dx))), dy: Math.round(0.8 * strength * Math.sin(t * 1.9 + k * 1.3)) };
}
