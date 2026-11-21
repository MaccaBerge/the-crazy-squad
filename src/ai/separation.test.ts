import { expect, test } from 'vitest';
import { ringSlots, separation } from './separation';

test('a dog is pushed away from a close packmate, harder when closer', () => {
  const near = separation([{ x: 0, y: 0 }, { x: 5, y: 0 }], 0, 20);
  const far = separation([{ x: 0, y: 0 }, { x: 15, y: 0 }], 0, 20);
  expect(near.x).toBeLessThan(far.x);
  expect(far.x).toBeLessThan(0);
  expect(near.y).toBeCloseTo(0);
});

test('nobody within the radius means no push', () => {
  expect(separation([{ x: 0, y: 0 }, { x: 30, y: 0 }], 0, 20)).toEqual({ x: 0, y: 0 });
});

test('two dogs on the same spot are pushed opposite ways', () => {
  const pts = [{ x: 4, y: 4 }, { x: 4, y: 4 }];
  const a = separation(pts, 0, 20), b = separation(pts, 1, 20);
  expect(a.x * b.x + a.y * b.y).toBeLessThan(0);
});

test('ring spots are spread evenly round the center and keep each dog on its own side', () => {
  const c = { x: 0, y: 0 };
  const dogs = [{ x: 50, y: 1 }, { x: 48, y: -2 }, { x: -50, y: 0 }]; // two bunched on the right, one on the left
  const slots = ringSlots(c, dogs, 20);
  for (const s of slots) expect(Math.hypot(s.x, s.y)).toBeCloseTo(20);
  const gap = (a: number, b: number) => Math.hypot(slots[a].x - slots[b].x, slots[a].y - slots[b].y);
  expect(gap(0, 1)).toBeCloseTo(20 * Math.sqrt(3)); // 120° apart
  expect(gap(0, 2)).toBeCloseTo(20 * Math.sqrt(3));
  expect(slots[2].x).toBeLessThan(0); // the left dog keeps a left spot
});
