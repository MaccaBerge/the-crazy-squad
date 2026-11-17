import { expect, test } from 'vitest';
import { bendOffset, MAX_POSE, poseFor, scatter } from './grass';

test('the same seed scatters the same grass, inside the area, back to front', () => {
  const area = { x: 16, y: 32, w: 100, h: 50 };
  const a = scatter(area, 500, 7);
  expect(a).toEqual(scatter(area, 500, 7));
  expect(a).not.toEqual(scatter(area, 500, 8));
  expect(a).toHaveLength(500);
  for (const b of a) {
    expect(b.x).toBeGreaterThanOrEqual(16);
    expect(b.x).toBeLessThan(116);
    expect(b.y).toBeGreaterThanOrEqual(32);
    expect(b.y).toBeLessThan(82);
  }
  expect(a.every((b, i) => i === 0 || a[i - 1].y <= b.y)).toBe(true);
});

test('poses stay within range and follow the wind', () => {
  expect(poseFor(0, 1, 0)).toBe(0);
  expect(poseFor(0, 1, 1)).toBe(MAX_POSE);
  expect(poseFor(0.5, 1.2, -1)).toBe(-MAX_POSE);
  expect(poseFor(0, 1, 0.4)).toBeGreaterThan(0);
});

test('a bent blade keeps its root in place and moves its tip most', () => {
  expect(bendOffset(MAX_POSE, 0, 10)).toBe(0);
  expect(bendOffset(MAX_POSE, 9, 10)).toBe(4);
  expect(bendOffset(-MAX_POSE, 9, 10)).toBe(-4);
});
