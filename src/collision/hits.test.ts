import { expect, test } from 'vitest';
import { Health } from './hits';

test('a hit takes damage, then invincibility frames ignore hits until they run out', () => {
  const h = new Health(100);
  expect(h.take(20, 0.8)).toBe(20);
  expect(h.hp).toBe(80);
  expect(h.take(20, 0.8)).toBe(0);
  h.tick(0.79);
  expect(h.invulnerable).toBe(true);
  h.tick(0.01);
  expect(h.take(20, 0.8)).toBe(20);
  expect(h.hp).toBe(60);
});

test('health stops at 0 and a downed character takes no more hits', () => {
  const h = new Health(30);
  expect(h.take(50, 0)).toBe(30);
  expect(h.down).toBe(true);
  expect(h.take(10, 0)).toBe(0);
  expect(h.hp).toBe(0);
});

test('protection never shortens invincibility that is already running', () => {
  const h = new Health(100);
  h.take(10, 0.8);
  h.protect(0.3);
  h.tick(0.5);
  expect(h.invulnerable).toBe(true);
});
