import { expect, test } from 'vitest';
import { grown, lightning } from './slowmo';

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

test('a growing bolt reaches out from its start, and forks only sprout once the channel passes them', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const l = lightning({ x: 0, y: 0 }, { x: 100, y: 0 }, { depth: 4, fork: 0.6 }, rand);
  const half = grown(l, 0.5);
  expect(half.main).toHaveLength(9); // 8 of 16 segments
  expect(half.main.at(-1)).toEqual(l.main[8]);
  for (const f of half.forks) expect(l.main.indexOf(l.forks.find((o) => o[0] === f[0])![0])).toBeLessThan(8);
  expect(grown(l, 0.25).main.at(-1)).toEqual(l.main[4]);
  expect(grown(l, 1)).toBe(l);
});
