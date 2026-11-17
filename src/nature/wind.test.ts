import { expect, test } from 'vitest';
import { WEATHER } from './weather';
import { wind } from './wind';

const samples = (fn: (x: number, y: number, t: number) => number) => {
  const out: number[] = [];
  for (let x = -500; x <= 500; x += 37) for (let y = -300; y <= 300; y += 53) for (let t = 0; t < 30; t += 0.7) out.push(fn(x, y, t));
  return out;
};

test('same inputs give the same wind', () => {
  expect(wind(123, 45, 6.7, WEATHER.storm)).toBe(wind(123, 45, 6.7, WEATHER.storm));
});

test.each(Object.entries(WEATHER))('%s stays within -1..1 and mostly blows downwind', (_name, p) => {
  const all = samples((x, y, t) => wind(x, y, t, p));
  expect(Math.min(...all)).toBeGreaterThanOrEqual(-1);
  expect(Math.max(...all)).toBeLessThanOrEqual(1);
  expect(all.reduce((a, b) => a + b) / all.length).toBeGreaterThan(0);
});

test('stronger weather blows harder on average', () => {
  const mean = (p: (typeof WEATHER)[keyof typeof WEATHER]) => {
    const all = samples((x, y, t) => wind(x, y, t, p));
    return all.reduce((a, b) => a + b) / all.length;
  };
  expect(mean(WEATHER.calm)).toBeLessThan(mean(WEATHER.sunny));
  expect(mean(WEATHER.sunny)).toBeLessThan(mean(WEATHER.storm));
});

test('a gust travels downwind', () => {
  const p = { windBase: 0, windGust: 1, gustEvery: 10, windDir: 0 };
  // With no base wind, the gust is all there is: what x=0 feels at t, x=90 feels a second later.
  expect(wind(90, 0, 1.6, p)).toBeCloseTo(wind(0, 0, 0.6, p), 1);
  expect(wind(0, 0, 0.7, p)).toBeGreaterThan(0.3);
});
