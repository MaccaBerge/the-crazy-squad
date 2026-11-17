import { expect, test } from 'vitest';
import { swayOffset, TREE_TYPES } from './treeTypes';

test.each(Object.entries(TREE_TYPES))('%s sways at the top and keeps its trunk still', (_name, t) => {
  for (const lean of [-1, -0.5, 0, 0.3, 1])
    for (const time of [0, 0.7, 2.3]) {
      expect(swayOffset(t, lean, t.swayFrom, time)).toBe(0);
      expect(swayOffset(t, lean, t.base.y, time)).toBe(0);
      expect(Math.abs(swayOffset(t, lean, 0, time))).toBeLessThanOrEqual(t.sway + 1);
      // Rows never step more than 1 px apart, so the canopy bends instead of tearing.
      for (let y = 1; y < t.swayFrom; y++)
        expect(Math.abs(swayOffset(t, lean, y, time) - swayOffset(t, lean, y - 1, time))).toBeLessThanOrEqual(1);
    }
  expect(swayOffset(t, 1, 0, 0)).toBeGreaterThanOrEqual(t.sway - 1);
});
