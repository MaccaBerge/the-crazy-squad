import { expect, test } from 'vitest';
import { animDir, BREEDS } from './breeds';

test('left-facing directions play the right-facing animation mirrored', () => {
  expect(animDir('left')).toEqual({ dir: 'east', flip: true });
  expect(animDir('down-left')).toEqual({ dir: 'south-east', flip: true });
  expect(animDir('up-left')).toEqual({ dir: 'north-east', flip: true });
  expect(animDir('up')).toEqual({ dir: 'north', flip: false });
});

test('every breed gives the player a fair chance: a readable windup and a chase that does not flicker', () => {
  for (const [kind, b] of Object.entries(BREEDS)) {
    expect(b.brain.windup, kind).toBeGreaterThanOrEqual(0.3);
    expect(b.brain.alert, kind).toBeGreaterThanOrEqual(0.2);
    expect(b.brain.lose, kind).toBeGreaterThan(b.brain.sight);
    expect(b.brain.reach, kind).toBeLessThan(b.brain.sight);
  }
});
