import { expect, test } from 'vitest';
import { Stamina } from './stamina';

const T = { drainTime: 2, regenTime: 4, regenDelay: 0.5, recoverAt: 0.5, exhaustTime: 1, exhaustSlow: 0.6 };
const run = (s: Stamina, seconds: number, sprinting: boolean) => {
  let sprinted = false;
  for (let i = 0; i < Math.round(seconds * 100); i++) sprinted = s.tick(0.01, sprinting);
  return sprinted;
};

test('sprinting drains the bar in drainTime, then the character is winded', () => {
  const s = new Stamina(T);
  expect(run(s, 1, true)).toBe(true);
  expect(s.value).toBeCloseTo(0.5);
  run(s, 1, true);
  expect(s.value).toBe(0);
  expect(s.winded).toBe(true);
  expect(s.tick(0.01, true)).toBe(false); // can't sprint on an empty bar
});

test('refilling waits regenDelay after the last sprint step', () => {
  const s = new Stamina(T);
  run(s, 1, true);
  run(s, 0.4, false);
  expect(s.value).toBeCloseTo(0.5);
  run(s, 0.1 + 1, false);
  expect(s.value).toBeCloseTo(0.75, 1);
});

test('a winded character sprints again only once the bar is back to recoverAt', () => {
  const s = new Stamina(T);
  run(s, 2, true);
  run(s, 0.5 + 1.9, false); // 0.475 of the bar
  expect(s.winded).toBe(true);
  expect(s.tick(0.01, true)).toBe(false);
  run(s, 0.2, false);
  expect(s.winded).toBe(false);
  expect(s.tick(0.01, true)).toBe(true);
});

test('holding sprint while winded does not reset the refill delay', () => {
  const s = new Stamina(T);
  run(s, 2, true);
  run(s, 1, true); // still holding Shift
  expect(s.value).toBeGreaterThan(0);
});

test('running dry exhausts the character for exhaustTime, walking at exhaustSlow', () => {
  const s = new Stamina(T);
  expect(s.speedFactor).toBe(1);
  run(s, 2, true);
  expect(s.exhausted).toBe(true);
  expect(s.speedFactor).toBe(0.6);
  run(s, 0.95, false);
  expect(s.exhausted).toBe(true);
  run(s, 0.1, false);
  expect(s.exhausted).toBe(false);
  expect(s.speedFactor).toBe(1);
  expect(s.winded).toBe(true); // still can't sprint until recoverAt
});
