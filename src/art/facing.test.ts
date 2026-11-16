import { expect, test } from 'vitest';
import { sheetDir, snapDir } from './facing';

test('snaps to the nearest of 8 directions', () => {
  expect(snapDir('down', { x: 1, y: 0.3 })).toBe('right');
  expect(snapDir('down', { x: -0.2, y: -1 })).toBe('up');
  expect(snapDir('down', { x: 1, y: 1 })).toBe('down-right');
  expect(snapDir('down', { x: -1, y: -1 })).toBe('up-left');
});

test('no input keeps the previous direction', () => {
  expect(snapDir('up-left', { x: 0, y: 0 })).toBe('up-left');
});

test('left-facing directions reuse the right-facing rows flipped', () => {
  expect(sheetDir('left')).toEqual({ row: 'side', flip: true });
  expect(sheetDir('down-left')).toEqual({ row: 'down-side', flip: true });
  expect(sheetDir('up-right')).toEqual({ row: 'up-side', flip: false });
  expect(sheetDir('down')).toEqual({ row: 'down', flip: false });
});
