import { expect, test } from 'vitest';
import { facingFrame } from './dogs';

test('a dog turns to face the player: frames go clockwise from right', () => {
  expect(facingFrame(0, 0, 10, 0)).toBe(0); // right
  expect(facingFrame(0, 0, 0, 10)).toBe(2); // down
  expect(facingFrame(0, 0, -10, 0)).toBe(4); // left
  expect(facingFrame(0, 0, 0, -10)).toBe(6); // up
  expect(facingFrame(0, 0, 10, -10)).toBe(7); // up-right
});
