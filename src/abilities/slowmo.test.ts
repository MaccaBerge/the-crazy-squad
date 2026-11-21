import { expect, test } from 'vitest';
import { bolt } from './slowmo';

test('a bolt starts and ends exactly on its points and bends no further than jag', () => {
  const p = bolt({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 5, () => 1);
  expect(p).toHaveLength(11);
  expect(p[0]).toEqual({ x: 0, y: 0 });
  expect(p[10]).toEqual({ x: 100, y: 0 });
  expect(Math.max(...p.map((q) => Math.abs(q.y)))).toBeCloseTo(5);
});
