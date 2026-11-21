import { expect, test } from 'vitest';
import { clearLine, findPath } from './path';

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
