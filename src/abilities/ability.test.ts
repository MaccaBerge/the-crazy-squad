import { expect, test } from 'vitest';
import { Ability } from './ability';

const run = (a: Ability, s: number) => { for (let t = 0; t < s - 1e-9; t += 1 / 60) a.tick(1 / 60); };

test('runs for its duration, then cools down, then is ready again', () => {
  const a = new Ability({ id: 'slowmo', cooldown: 15, duration: 4 });
  expect(a.start()).toBe(true);
  expect(a.start()).toBe(false); // already running
  run(a, 3.9);
  expect(a.active).toBe(true);
  run(a, 0.2);
  expect(a.active).toBe(false);
  expect(a.cooldownFraction).toBeGreaterThan(0.95);
  expect(a.start()).toBe(false);
  run(a, 15);
  expect(a.ready).toBe(true);
});

test('ending it early starts the full cooldown', () => {
  const a = new Ability({ id: 'slowmo', cooldown: 15, duration: 4 });
  a.start();
  run(a, 1);
  a.end();
  expect(a.active).toBe(false);
  expect(a.cooldownLeft).toBe(15);
});
