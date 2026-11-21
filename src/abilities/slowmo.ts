import type { Vec } from '../movement';

/**
 * Slow-mo look in one place, taken from Christian's suit (sprite colours): red body, gold trim, pale highlight.
 * The first try was cold: core 0xfff6dc, glow 0xf2c846, ghost = glow, tint [0.85, 0.92, 1.1], edge 0x000000.
 */
export const SLOWMO = {
  core: 0xf1e0c6, // lightning core: the suit's pale highlight
  glow: 0xf0bc66, // lightning glow and the HUD icon: the suit's gold trim
  ghost: 0xb6201f, // afterimages: the suit's red
  zoom: 1.12, // camera zoom in while it lasts
  desaturate: 0.6, // how much colour drains from the world (0–1)
  tint: [1.1, 0.88, 0.85] as const, // RGB multipliers: a warm red cast
  vignette: 0.5, // strength of the darkening at the screen edges
  edge: 0x371116, // its colour: the suit's darkest red
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
