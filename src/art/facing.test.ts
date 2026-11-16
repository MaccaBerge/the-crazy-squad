import { expect, test } from 'vitest';
import { sheetDir, snapDir } from './facing';

test('snaps to the stronger axis', () => {
  expect(snapDir('down', { x: 1, y: 0.3 })).toBe('right');
  expect(snapDir('down', { x: -0.2, y: -1 })).toBe('up');
});

test('exact diagonals and no input keep the previous direction', () => {
  expect(snapDir('left', { x: 1, y: 1 })).toBe('left');
  expect(snapDir('up', { x: 0, y: 0 })).toBe('up');
});

test('left and right share the side row', () => {
  expect(sheetDir('left')).toBe('side');
  expect(sheetDir('down')).toBe('down');
});
