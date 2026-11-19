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

/**
 * Spots on a ring round `center`, one per dog, spread evenly (dog AI blueprint §5's ring).
 * Dogs keep the order they already stand in round the center, so nobody has to cross the circle to reach its spot.
 */
export function ringSlots(center: Vec, dogs: readonly Vec[], radius: number): Vec[] {
  const angle = (p: Vec) => Math.atan2(p.y - center.y, p.x - center.x);
  const order = dogs.map((_, i) => i).sort((a, b) => angle(dogs[a]) - angle(dogs[b]));
  const slots: Vec[] = new Array(dogs.length);
  if (!dogs.length) return slots;
  // Turn the whole ring so its spots sit as close as possible to where the dogs already are.
  const step = (Math.PI * 2) / dogs.length;
  const offset = Math.atan2(
    order.reduce((s, i, k) => s + Math.sin(angle(dogs[i]) - k * step), 0),
    order.reduce((s, i, k) => s + Math.cos(angle(dogs[i]) - k * step), 0),
  );
  order.forEach((i, k) => {
    const a = offset + k * step;
    slots[i] = { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius };
  });
  return slots;
}
