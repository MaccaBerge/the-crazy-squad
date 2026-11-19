import { expect, test } from 'vitest';
import { separation } from './separation';

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
