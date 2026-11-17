import { expect, test } from 'vitest';
import { MAX_SWAY_POSE, swayOffset, TREE_TYPES } from './treeTypes';

test.each(Object.entries(TREE_TYPES))('%s sways at the top and keeps its trunk still', (_name, t) => {
  for (let pose = -MAX_SWAY_POSE; pose <= MAX_SWAY_POSE; pose++) {
    expect(swayOffset(t, pose, t.swayFrom)).toBe(0);
    expect(swayOffset(t, pose, t.base.y)).toBe(0);
    expect(Math.abs(swayOffset(t, pose, 0))).toBe(Math.abs(Math.round((pose / MAX_SWAY_POSE) * t.sway)));
    // Rows never step more than 1 px apart, so the canopy bends instead of tearing.
    for (let y = 1; y < t.swayFrom; y++) expect(Math.abs(swayOffset(t, pose, y) - swayOffset(t, pose, y - 1))).toBeLessThanOrEqual(1);
  }
  expect(swayOffset(t, MAX_SWAY_POSE, 0)).toBe(-swayOffset(t, -MAX_SWAY_POSE, 0));
});
