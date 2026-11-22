import { expect, test } from 'vitest';
import { type BrainDef, hurt, newBrain, type Sense, staggers, think } from './dogBrain';

const def: BrainDef = { sight: 100, lose: 150, reach: 20, alert: 0.3, windup: 0.4, attack: 0.1, recover: 0.5, stagger: 0.3, search: 3, lost: 1 };

/** Runs the brain in 1/60 s steps for `seconds` at a fixed distance, in plain view unless `sense` says otherwise; returns the states it entered. */
const run = (b = newBrain(), dist: number | null, seconds: number, sense: Partial<Sense> = {}) => {
  const entered: string[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const s = think(b, def, { dist, visible: true, told: false, arrived: false, ...sense }, 1 / 60);
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

test('past the lose distance it searches where it last saw you, then gives up with a "?"', () => {
  const { b } = run(undefined, 90, 0.5);
  expect(run(b, 120, 1).b.state).toBe('chase');
  expect(run(b, 160, 0.1).entered).toEqual(['search']);
  expect(run(b, 160, 0.1, { arrived: true }).entered).toEqual(['lost']);
  expect(run(b, 160, 1.1).entered).toEqual(['idle']);
});

test('a wall hides you: it neither notices you nor keeps chasing, however close you are', () => {
  expect(run(undefined, 50, 2, { visible: false }).b.state).toBe('idle');
  const { b } = run(undefined, 90, 0.5);
  expect(run(b, 30, 0.1, { visible: false }).entered).toEqual(['search']);
  expect(run(b, 30, 0.1).entered).toEqual(['chase']); // back in view before it got there: straight on
});

test('it gives up searching after a while even if it never gets there', () => {
  const { b } = run(undefined, 90, 0.5);
  run(b, 200, 0.1);
  expect(run(b, 200, 3.1).entered).toEqual(['lost']);
});

test('seeing you again while lost gives a fresh "!"', () => {
  const { b } = run(undefined, 90, 0.5);
  run(b, 200, 0.1, { arrived: true });
  run(b, 200, 0.1, { arrived: true });
  expect(b.state).toBe('lost');
  expect(run(b, 90, 0.05).entered).toEqual(['alert']);
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

test('a dog warned by a packmate joins the hunt out of sight, and searches once the warning stops', () => {
  const { b } = run(undefined, 400, 1, { told: true, visible: false });
  expect(b.state).toBe('chase');
  expect(run(b, 400, 0.05, { visible: false }).entered).toEqual(['search']);
});

test('a hit staggers only if it pushes, at least as hard as the poise, and not while guarded', () => {
  expect(staggers(0, 0, 0)).toBe(false); // a punch with no knockback never staggers, even a 0-poise dog
  expect(staggers(120, 150, 0)).toBe(false);
  expect(staggers(200, 200, 0)).toBe(true);
  expect(staggers(200, 200, 0.5)).toBe(false); // still guarded from the last stagger
});
