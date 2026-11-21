import type * as Phaser from 'phaser';
import type { Vec } from '../movement';

/**
 * Slow-mo look in one place, from Christian's suit (sprite colours): a ramp from the suit's red through orange and
 * the gold trim to the pale highlight. Lightning is drawn as that ramp, outside in; the world gets warm light, not a tint.
 */
export const SLOWMO = {
  core: 0xf1e0c6, // the hottest middle of a bolt: the suit's pale highlight
  gold: 0xf0bc66, // the suit's gold trim: inner glow, the HUD icon
  orange: 0xe3723c, // outer glow, the light round him, the glowing screen edges
  red: 0xb6201f, // the widest, faintest glow: the suit's red
  zoom: 1.12, // camera zoom in while it lasts
  shade: 0x8c5f55, // the world is multiplied by this (warm and dark) under the lightning, so the light blazes
  edgeGlow: 0.35, // strength of the orange glow at the screen edges
};

/** A lightning bolt: the main channel and the forks off it. */
export type Lightning = { main: Vec[]; forks: Vec[][] };

/** Midpoint displacement: split the line, push the middle sideways, repeat. Gives the uneven, natural jag of real lightning. */
function channel(a: Vec, b: Vec, depth: number, spread: number, rand: () => number): Vec[] {
  if (depth === 0) return [a, b];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, off = (rand() * 2 - 1) * spread;
  const mid = { x: (a.x + b.x) / 2 - (dy / len) * off, y: (a.y + b.y) / 2 + (dx / len) * off };
  return [...channel(a, mid, depth - 1, spread / 2, rand), ...channel(mid, b, depth - 1, spread / 2, rand).slice(1)];
}

/**
 * A bolt from a to b with 2^depth segments. `jag` is how far it may wander (share of its length), `fork` the chance
 * each bend sends off a shorter, thinner fork. `rand` returns 0–1 (Math.random in the game, fixed in tests).
 */
export function lightning(a: Vec, b: Vec, { depth = 4, jag = 0.22, fork = 0.15 } = {}, rand: () => number = Math.random): Lightning {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const main = channel(a, b, depth, len * jag, rand);
  const forks: Vec[][] = [];
  for (let i = 1; i < main.length - 2; i++) {
    if (rand() >= fork) continue;
    const p = main[i], q = main[i + 1], ang = Math.atan2(q.y - p.y, q.x - p.x) + (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.5);
    const l = len * (1 - i / main.length) * (0.3 + rand() * 0.3);
    forks.push(channel(p, { x: p.x + Math.cos(ang) * l, y: p.y + Math.sin(ang) * l }, Math.max(1, depth - 2), l * jag, rand));
  }
  return { main, forks };
}

type G = Phaser.GameObjects.Graphics;
const px = (ps: Vec[], o: Vec) => ps.map((p) => ({ x: Math.round(p.x + o.x), y: Math.round(p.y + o.y) })) as Phaser.Math.Vector2[]; // strokePoints only reads x and y

/**
 * Draws a bolt as the suit ramp, outside in: wide faint red, orange, gold, then a 1 px pale core. `glow` should be an
 * additive (ADD) graphics, so overlapping bolts get brighter like real light; `core` a normal one on top.
 * Points snap to whole pixels, so it stays pixel art at the game's resolution. `thin` halves the glow round the core.
 */
export function drawLightning(glow: G, core: G, l: Lightning, alpha: number, { thick = 1, thin = false, at = { x: 0, y: 0 } } = {}) {
  const main = px(l.main, at), forks = l.forks.map((f) => px(f, at)), spread = thin ? 1 : 2;
  glow.lineStyle(thick + spread * 2, SLOWMO.red, 0.22 * alpha).strokePoints(main);
  glow.lineStyle(thick + spread, SLOWMO.orange, 0.45 * alpha).strokePoints(main);
  if (!thin) for (const f of forks) glow.lineStyle(thick + 1, SLOWMO.orange, 0.4 * alpha).strokePoints(f);
  if (!thin) glow.lineStyle(thick + 1, SLOWMO.gold, 0.7 * alpha).strokePoints(main);
  core.lineStyle(thick, SLOWMO.core, alpha).strokePoints(main);
  for (const f of forks) core.lineStyle(1, SLOWMO.gold, 0.85 * alpha).strokePoints(f);
}
