export type Vec = { x: number; y: number };

export type MoveParams = {
  maxSpeed: number; // px/s
  accel: number; // px/s² while a direction is held
  decel: number; // px/s² when no direction is held
};

// Tight and precise: ~0.04 s to top speed, ~0.05 s to stop.
export const defaultMove: MoveParams = { maxSpeed: 100, accel: 2400, decel: 2200 };

/**
 * Moves velocity straight toward input × maxSpeed, without overshooting.
 * Input longer than 1 (keyboard diagonals) is capped to 1; shorter input (a half-pushed stick) moves slower.
 */
export function stepVelocity(vel: Vec, input: Vec, dt: number, p: MoveParams): Vec {
  const len = Math.hypot(input.x, input.y);
  const scale = (len > 1 ? 1 / len : 1) * p.maxSpeed;
  const target = { x: input.x * scale, y: input.y * scale };
  const dx = target.x - vel.x;
  const dy = target.y - vel.y;
  const dist = Math.hypot(dx, dy);
  const step = (len > 0 ? p.accel : p.decel) * dt;
  if (dist <= step) return target;
  return { x: vel.x + (dx / dist) * step, y: vel.y + (dy / dist) * step };
}
