// Aim help (combat blueprint §3): attacks snap to a dog roughly in front of you, so 8-direction aiming doesn't miss.
import type { Vec } from '../movement';

/** px from a dog's feet to the edge of its body: half its 12 px feet box. Hits count to here, not its middle. */
export const BODY_PAD = 6;

export type AimHelp = { cone: number; range: number }; // degrees either side of facing; px a dog may be from your feet

/**
 * The dog an attack should go for: inside `cone`° either side of `facing` and within `range`, the best one by distance
 * and angle (a dog dead ahead beats a slightly closer one off to the side). Returns its index, or -1.
 */
export function pickTarget(from: Vec, facing: Vec, dogs: Vec[], { cone, range }: AimHelp) {
  const cos = Math.cos((cone * Math.PI) / 180);
  let best = -1, bestScore = Infinity;
  dogs.forEach((p, i) => {
    const dx = p.x - from.x, dy = p.y - from.y, d = Math.hypot(dx, dy);
    if (d > range) return;
    const along = d < 1e-6 ? 1 : (dx * facing.x + dy * facing.y) / d;
    if (along < cos) return;
    const score = d * (2 - along); // straight ahead counts as its distance; at the cone's edge, a bit further
    if (score < bestScore) (best = i), (bestScore = score);
  });
  return best;
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
