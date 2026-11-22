import { expect, test } from 'vitest';
import type { SolidAt } from '../collision/cornerAssist';
import { clearLine, crossesRect, findPath, lineOfSight } from './path';

// A 7×5 room with a wall down the middle and a gap at the bottom:
const MAP = [
  '#######',
  '#..#..#',
  '#..#..#',
  '#.....#',
  '#######',
];
const solid = (x: number, y: number) => MAP[y]?.[x] !== '.';

test('goes round a wall through the gap', () => {
  const path = findPath(solid, { x: 1, y: 1 }, { x: 5, y: 1 })!;
  expect(path[0]).toEqual({ x: 1, y: 1 });
  expect(path.at(-1)).toEqual({ x: 5, y: 1 });
  expect(path.some((c) => c.y === 3)).toBe(true);
  expect(path.every((c) => !solid(c.x, c.y))).toBe(true);
});

test('never cuts a corner diagonally', () => {
  const path = findPath(solid, { x: 2, y: 2 }, { x: 4, y: 2 })!;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (a.x !== b.x && a.y !== b.y) expect(solid(b.x, a.y) || solid(a.x, b.y)).toBe(false);
  }
});

test('no path into a closed room', () => {
  const closed = (x: number, y: number) => solid(x, y) || (x === 3 && y === 3);
  expect(findPath(closed, { x: 1, y: 1 }, { x: 5, y: 1 })).toBeNull();
});

test('a straight line is clear in the open and blocked by the wall', () => {
  const body = { w: 12, h: 6 };
  expect(clearLine(solid, { x: 24, y: 60 }, { x: 88, y: 60 }, body)).toBe(true); // along the gap row
  expect(clearLine(solid, { x: 24, y: 28 }, { x: 88, y: 28 }, body)).toBe(false); // through the wall
});

test('sight is blocked by a solid tile between, not by open ground', () => {
  const wall: SolidAt = (x, y) => x === 2 && y === 0; // one wall tile at x 32–48, y 0–16
  expect(lineOfSight(wall, { x: 8, y: 8 }, { x: 72, y: 8 })).toBe(false);
  expect(lineOfSight(wall, { x: 8, y: 24 }, { x: 72, y: 24 })).toBe(true);
});

test('crossesRect: only a line through the trunk itself is blocked', () => {
  const trunk = { x: 352, y: 112, width: 8, height: 4 }; // the 8x4 trunk the tester found blocking a whole tile
  expect(crossesRect({ x: 345, y: 110 }, { x: 357, y: 110 }, trunk)).toBe(false); // just north of it
  expect(crossesRect({ x: 345, y: 114 }, { x: 367, y: 114 }, trunk)).toBe(true); // straight through
  expect(crossesRect({ x: 356, y: 100 }, { x: 356, y: 130 }, trunk)).toBe(true); // vertical, through
  expect(crossesRect({ x: 350, y: 100 }, { x: 350, y: 130 }, trunk)).toBe(false); // vertical, beside
  expect(crossesRect({ x: 340, y: 100 }, { x: 351, y: 111 }, trunk)).toBe(false); // stops short
  expect(crossesRect({ x: 350, y: 110 }, { x: 362, y: 118 }, { x: 355, y: 113, width: 2, height: 2 })).toBe(true); // thin, diagonal
});
