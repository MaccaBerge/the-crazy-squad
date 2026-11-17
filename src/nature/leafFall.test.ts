import { expect, test } from 'vitest';
import { FADE, LIE, type Leaf, leafDrawn, shedRate, stepLeaf, swing } from './leafFall';
import { WEATHER } from './weather';

const drop = (weather = WEATHER.sunny) => {
  const l: Leaf = { x: 0, y: 0, z: 60, phase: 0, age: 0 };
  const xs: number[] = [];
  let t = 0;
  while (l.z > 0 && t < 60) stepLeaf(l, t, 1 / 60, weather), xs.push(leafDrawn(l, t).x), (t += 1 / 60);
  return { l, xs, t };
};

test('a leaf falls to the ground in a few seconds, then lies there and fades', () => {
  const { l, t } = drop();
  expect(l.z).toBe(0);
  expect(t).toBeGreaterThan(2);
  expect(t).toBeLessThan(10);
  let alive = 0;
  while (stepLeaf(l, t, 0.1, WEATHER.sunny)) alive += 0.1;
  expect(alive).toBeCloseTo(LIE + FADE, 0);
});

test('in still air it swings back and forth without drifting', () => {
  const still = { windBase: 0, windGust: 0, gustEvery: 10, windDir: 0 };
  const { l, xs } = drop(still);
  expect(l.x).toBe(0);
  const turns = xs.filter((x, i) => i > 1 && Math.sign(x - xs[i - 1]) !== Math.sign(xs[i - 1] - xs[i - 2]) && x !== xs[i - 1]).length;
  expect(turns).toBeGreaterThanOrEqual(2);
});

test('the wind carries it downwind, further in a storm', () => {
  expect(drop(WEATHER.sunny).l.x).toBeGreaterThan(5);
  expect(drop(WEATHER.storm).l.x).toBeGreaterThan(drop(WEATHER.sunny).l.x);
  expect(drop({ ...WEATHER.breezy, windDir: 180 }).l.x).toBeLessThan(-5);
});

test('it hangs at the ends of its swing and falls fastest through the middle', () => {
  const l: Leaf = { x: 0, y: 0, z: 50, phase: Math.PI / 2, age: 0 }; // starts at the end of a swing
  const still = { windBase: 0, windGust: 0, gustEvery: 10, windDir: 0 };
  expect(Math.abs(swing(l, 0))).toBeCloseTo(1);
  stepLeaf(l, 0, 0.1, still);
  const atEnd = 50 - l.z;
  l.phase = 0;
  const z = l.z;
  stepLeaf(l, 0, 0.1, still);
  expect(z - l.z).toBeGreaterThan(atEnd * 2);
});

test('trees shed more as the wind rises, and a bigger shed rate sheds more', () => {
  expect(shedRate(1, 0)).toBeGreaterThan(0);
  expect(shedRate(1, 0.8)).toBeGreaterThan(shedRate(1, 0.2));
  expect(shedRate(1, -0.8)).toBe(shedRate(1, 0.8));
  expect(shedRate(2, 0.5)).toBe(2 * shedRate(1, 0.5));
});
