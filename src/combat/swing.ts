// A melee swing (combat blueprint §3): an arc in front of the attacker that opens only during its active part.
// shortcut: plain timings until the shared ability runner exists (characters blueprint §4); fold this into it then.
import type { Vec } from '../movement';

export type Swing = {
  damage: number;
  windup: number; // s before the arc opens
  active: number; // s the arc can hit
  recovery: number; // s committed afterwards
  radius: number; // px, feet to feet
  arc: number; // degrees, centred on facing
  knockback: number; // px/s push given to whoever is hit
  heavy?: boolean; // longer hit freeze
};

export type SwingPhase = 'windup' | 'active' | 'recovery' | 'done';

export function swingPhase(s: Swing, t: number): SwingPhase {
  if (t < s.windup) return 'windup';
  if (t < s.windup + s.active) return 'active';
  return t < s.windup + s.active + s.recovery ? 'recovery' : 'done';
}

/** Whether `to` is inside the arc swung from `from` towards the unit vector `facing`. */
export function inArc(s: Swing, from: Vec, facing: Vec, to: Vec) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (d > s.radius) return false;
  return d < 1e-6 || (dx * facing.x + dy * facing.y) / d >= Math.cos(((s.arc / 2) * Math.PI) / 180);
}

/** s after a combo step ends that another press continues to the next step (combat blueprint §3). */
export const COMBO_WINDOW = 0.3;

/** Which step of a `steps`-long combo a press starts, given the last step and the s since it ended. */
export function comboStep(steps: number, last: number, since: number) {
  return last + 1 < steps && since <= COMBO_WINDOW ? last + 1 : 0;
}
