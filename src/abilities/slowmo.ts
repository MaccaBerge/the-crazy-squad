import type { Vec } from '../movement';

/** Slow-mo look in one place, so other colours (Christian's suit) are a one-line try. */
export const SLOWMO = {
  core: 0xfff6dc, // lightning core
  glow: 0xf2c846, // lightning glow, afterimages, the HUD icon
  zoom: 1.12, // camera zoom in while it lasts
  desaturate: 0.6, // how much colour drains from the world (0–1)
  tint: [0.85, 0.92, 1.1] as const, // RGB multipliers: a cold blue cast
  vignette: 0.45, // darkness at the screen edges
};

/**
 * A jagged lightning bolt from a to b: `n` segments, each bend pushed sideways up to `jag` px. Ends stay exact.
 * `rand` returns 0–1 (Math.random in the game, fixed in tests).
 */
export function bolt(a: Vec, b: Vec, n: number, jag: number, rand: () => number = Math.random): Vec[] {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, off = i === 0 || i === n ? 0 : (rand() * 2 - 1) * jag;
    return { x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off };
  });
}
