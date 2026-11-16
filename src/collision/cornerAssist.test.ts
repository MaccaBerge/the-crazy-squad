import { expect, test } from 'vitest';
import { cornerNudge, rectFree } from './cornerAssist';

// One wall tile at tile (2,1) = pixels x 32..47, y 16..31.
const solid = (tx: number, ty: number) => tx === 2 && ty === 1;
const blockedRight = { left: false, right: true, up: false, down: false };

test('rect ending exactly on a tile edge does not touch it', () => {
  expect(rectFree({ x: 22, y: 10, w: 10, h: 6 }, solid)).toBe(true); // ends at x 32, y 16
  expect(rectFree({ x: 23, y: 11, w: 10, h: 6 }, solid)).toBe(false);
});

test('clipping a corner by 3 px nudges round it', () => {
  // body right edge on the wall, bottom 3 px below the wall's top edge
  expect(cornerNudge({ x: 22, y: 13, w: 10, h: 6 }, { x: 1, y: 0 }, blockedRight, solid)).toEqual({ x: 0, y: -1 });
  // and the same from below
  expect(cornerNudge({ x: 22, y: 29, w: 10, h: 6 }, { x: 1, y: 0 }, blockedRight, solid)).toEqual({ x: 0, y: 1 });
});

test('no nudge when the wall is hit square on, or for diagonal input, or when not blocked', () => {
  expect(cornerNudge({ x: 22, y: 20, w: 10, h: 6 }, { x: 1, y: 0 }, blockedRight, solid)).toBeNull();
  expect(cornerNudge({ x: 22, y: 13, w: 10, h: 6 }, { x: 1, y: 1 }, blockedRight, solid)).toBeNull();
  expect(cornerNudge({ x: 22, y: 13, w: 10, h: 6 }, { x: 1, y: 0 }, { ...blockedRight, right: false }, solid)).toBeNull();
});

test('works vertically too', () => {
  const blockedDown = { left: false, right: false, up: false, down: true };
  // body above the wall, right edge 2 px past the wall's left edge
  expect(cornerNudge({ x: 24, y: 10, w: 10, h: 6 }, { x: 0, y: 1 }, blockedDown, solid)).toEqual({ x: -1, y: 0 });
});
