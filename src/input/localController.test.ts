import { expect, test } from 'vitest';
import { BUFFER_MS, LocalController } from './localController';

test('movement comes from held keys, opposite keys cancel', () => {
  const c = new LocalController();
  c.keyDown('KeyD', false, 0);
  c.keyDown('ArrowUp', false, 0);
  expect(c.getIntent(0).move).toEqual({ x: 1, y: -1 });
  c.keyDown('KeyA', false, 0);
  expect(c.getIntent(0).move).toEqual({ x: 0, y: -1 });
  c.keyUp('ArrowUp');
  expect(c.getIntent(0).move).toEqual({ x: 0, y: 0 });
});

test('presses are buffered, expire, and fire once when consumed', () => {
  const c = new LocalController();
  c.keyDown('KeyJ', false, 1000);
  expect(c.getIntent(1000 + BUFFER_MS).pressed.has('attack')).toBe(true);
  expect(c.getIntent(1001 + BUFFER_MS).pressed.has('attack')).toBe(false);
  c.keyDown('Digit3', false, 2000);
  c.consume('swap3');
  expect(c.getIntent(2000).pressed.has('swap3')).toBe(false);
});

test('Shift+Tab swaps back, Tab swaps forward', () => {
  const c = new LocalController();
  c.keyDown('Tab', true, 0);
  c.keyDown('Tab', false, 0);
  expect([...c.getIntent(0).pressed].sort()).toEqual(['swapNext', 'swapPrev']);
});

test('clear releases everything (window lost focus)', () => {
  const c = new LocalController();
  c.keyDown('KeyW', false, 0);
  c.keyDown('KeyE', false, 0);
  c.keyDown('ShiftLeft', true, 0);
  c.clear();
  expect(c.getIntent(0)).toEqual({ move: { x: 0, y: 0 }, sprint: false, pressed: new Set() });
});

test('sprint is on while either Shift key is held', () => {
  const c = new LocalController();
  expect(c.getIntent(0).sprint).toBe(false);
  c.keyDown('ShiftLeft', true, 0);
  expect(c.getIntent(0).sprint).toBe(true);
  c.keyUp('ShiftLeft');
  c.keyDown('ShiftRight', true, 0);
  expect(c.getIntent(0).sprint).toBe(true);
  c.keyUp('ShiftRight');
  expect(c.getIntent(0).sprint).toBe(false);
});
