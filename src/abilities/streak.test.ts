import { expect, test } from 'vitest';
import { SLOWMO, streakColor } from './slowmo';

test('the streak runs gold → orange → red and fades to black (see-through) at its tail', () => {
  expect(streakColor(0)).toBe(SLOWMO.gold);
  expect(streakColor(1)).toBe(0);
  const mid = streakColor(0.5), r = mid >> 16, g = (mid >> 8) & 255;
  expect(r).toBe(Math.round((SLOWMO.orange >> 16) * 0.5));
  expect(g).toBe(Math.round(((SLOWMO.orange >> 8) & 255) * 0.5));
});
