import { expect, test } from 'vitest';
import { lightning } from './slowmo';

test('a bolt starts and ends exactly on its points, with 2^depth segments', () => {
  const l = lightning({ x: 0, y: 0 }, { x: 100, y: 0 }, { depth: 4, fork: 0 }, () => 1);
  expect(l.main).toHaveLength(17);
  expect(l.main[0]).toEqual({ x: 0, y: 0 });
  expect(l.main[16]).toEqual({ x: 100, y: 0 });
  expect(l.forks).toHaveLength(0);
});

test('it stays near its line, and forks start on the main channel', () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const l = lightning({ x: 0, y: 0 }, { x: 100, y: 0 }, { depth: 4, jag: 0.22, fork: 0.5 }, rand);
  expect(Math.max(...l.main.map((p) => Math.abs(p.y)))).toBeLessThan(100 * 0.22 * 2); // spread halves each level: < 2× the first
  expect(l.forks.length).toBeGreaterThan(0);
  for (const f of l.forks) expect(l.main).toContainEqual(f[0]);
});
