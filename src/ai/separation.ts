// Soft separation (dog AI blueprint §6): each dog steers away from packmates closer than `radius`,
// harder the closer they are, so a pack spreads round its target instead of stacking.
import type { Vec } from '../movement';

/** The push away from `others` for the dog at index `self`. Length 0 (nobody close) to about 1 per close neighbour. */
export function separation(all: readonly Vec[], self: number, radius: number): Vec {
  const me = all[self];
  let x = 0, y = 0;
  all.forEach((o, i) => {
    if (i === self) return;
    const dx = me.x - o.x, dy = me.y - o.y, d = Math.hypot(dx, dy);
    if (d >= radius) return;
    if (d < 1e-3) {
      // Exactly on top of each other: split by index, so the two pick opposite ways.
      const a = (i < self ? 0 : Math.PI) + self;
      return void ((x += Math.cos(a)), (y += Math.sin(a)));
    }
    const k = 1 - d / radius;
    x += (dx / d) * k;
    y += (dy / d) * k;
  });
  return { x, y };
}
