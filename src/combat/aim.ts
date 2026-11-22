// Aim help (combat blueprint §3): attacks snap to a dog roughly in front of you, so 8-direction aiming doesn't miss.
import type { Vec } from '../movement';

/** px from a dog's feet to the edge of its body: half its 12 px feet box. Hits count to here, not its middle. */
export const BODY_PAD = 6;

export type AimHelp = { cone: number; range: number }; // degrees either side of facing; px a dog may be from your feet

/**
 * The dog an attack should go for: inside `cone`° either side of `facing` and within `range`, the best one by distance
 * and angle (a dog dead ahead beats a slightly closer one off to the side). Returns its index, or -1.
 */
export function pickTarget(from: Vec, facing: Vec, dogs: Vec[], help: AimHelp) {
  let best = -1, bestScore = Infinity;
  dogs.forEach((p, i) => {
    if (!inCone(from, facing, p, help)) return;
    const d = Math.hypot(p.x - from.x, p.y - from.y), along = d < 1e-6 ? 1 : ((p.x - from.x) * facing.x + (p.y - from.y) * facing.y) / d;
    const score = d * (2 - along); // straight ahead counts as its distance; at the cone's edge, a bit further
    if (score < bestScore) (best = i), (bestScore = score);
  });
  return best;
}

/** Whether `to` is within `range` of `from` and `cone`° either side of `facing`. */
export function inCone(from: Vec, facing: Vec, to: Vec, { cone, range }: AimHelp) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  return d <= range && (d < 1e-6 || (dx * facing.x + dy * facing.y) / d >= Math.cos((cone * Math.PI) / 180));
}

/** The unit vector from `from` to `to`, or `fallback` if they're on top of each other. */
export function toward(from: Vec, to: Vec, fallback: Vec): Vec {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  return d < 1e-6 ? fallback : { x: dx / d, y: dy / d };
}

/** How far to step in before a swing to close a `gap` px to its target: none if it's already in reach, at most `pull`. */
export function aimPull(gap: number, pull: number) {
  return Math.min(Math.max(gap, 0), pull);
}
