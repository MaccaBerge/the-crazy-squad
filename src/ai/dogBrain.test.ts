import { expect, test } from 'vitest';
import { type BrainDef, hurt, newBrain, think } from './dogBrain';

const def: BrainDef = { sight: 100, lose: 150, reach: 20, alert: 0.3, windup: 0.4, attack: 0.1, recover: 0.5, stagger: 0.3 };

/** Runs the brain in 1/60 s steps for `seconds` at a fixed distance; returns the states it entered. */
const run = (b = newBrain(), dist: number | null, seconds: number) => {
  const entered: string[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const s = think(b, def, dist, 1 / 60);
    if (s) entered.push(s);
  }
  return { b, entered };
};

test('a dog stays idle until the target comes within sight', () => {
  expect(run(undefined, 120, 2).b.state).toBe('idle');
  expect(run(undefined, null, 2).b.state).toBe('idle');
  expect(run(undefined, 90, 0.1).b.state).toBe('alert');
});

test('it pauses on alert before chasing, giving the player a moment', () => {
  const { b } = run(undefined, 90, 0.2);
  expect(b.state).toBe('alert');
  expect(run(b, 90, 0.2).b.state).toBe('chase');
});

test('in reach it winds up, attacks, recovers, then chases again', () => {
  const { b } = run(undefined, 90, 0.5);
  expect(run(b, 10, 2).entered).toEqual(['windup', 'attack', 'recover', 'chase', 'windup', 'attack', 'recover']);
});

test('the windup always plays out, even if the target steps away', () => {
  const { b } = run(undefined, 90, 0.5);
  run(b, 10, 0.05);
  expect(b.state).toBe('windup');
  expect(run(b, 200, 0.4).entered).toEqual(['attack']);
});

test('it gives up once the target is past the lose distance, not at the sight edge', () => {
  const { b } = run(undefined, 90, 0.5);
  expect(run(b, 120, 1).b.state).toBe('chase');
  expect(run(b, 160, 0.1).entered).toEqual(['idle']);
});

test('a hard hit cancels a windup; any hit wakes a sleeping dog', () => {
  const { b } = run(undefined, 90, 0.5);
  run(b, 10, 0.1); // winding up
  hurt(b, true);
  expect(b.state).toBe('stagger');
  expect(run(b, 10, 0.4).entered).toEqual(['chase', 'windup']);
  const idle = newBrain();
  hurt(idle, false);
  expect(idle.state).toBe('chase');
});

test('a dog warned by a packmate joins the hunt out of sight, and gives up once the warning stops', () => {
  const b = newBrain();
  for (let i = 0; i < 60; i++) think(b, def, 400, 1 / 60, true);
  expect(b.state).toBe('chase');
  think(b, def, 400, 1 / 60, false);
  expect(b.state).toBe('idle');
});
