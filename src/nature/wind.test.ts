import { expect, test } from 'vitest';
import { WEATHER } from './weather';
import { gust, prevailing, windAt } from './wind';

const DEG = Math.PI / 180;
const samples = (fn: (x: number, y: number, t: number) => { x: number; y: number }) => {
  const out: { x: number; y: number }[] = [];
  for (let x = -500; x <= 500; x += 97) for (let y = -300; y <= 300; y += 113) for (let t = 0; t < 60; t += 1.3) out.push(fn(x, y, t));
  return out;
};
const mean = (vs: { x: number; y: number }[]) => ({ x: vs.reduce((a, v) => a + v.x, 0) / vs.length, y: vs.reduce((a, v) => a + v.y, 0) / vs.length });
const angleOf = (v: { x: number; y: number }) => Math.atan2(v.y, v.x);
const turn = (a: number, b: number) => Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); // radians between two headings

test('same inputs give the same wind', () => {
  expect(windAt(123, 45, 6.7, WEATHER.storm)).toEqual(windAt(123, 45, 6.7, WEATHER.storm));
});

test.each(Object.entries(WEATHER))('%s never exceeds full strength and mostly blows its way', (_name, p) => {
  const all = samples((x, y, t) => windAt(x, y, t, p));
  for (const v of all) expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(1 + 1e-9);
  expect(turn(angleOf(mean(all)), p.windDir * DEG)).toBeLessThan(p.windVeer * DEG);
});

test('stronger weather blows harder on average', () => {
  const strength = (p: (typeof WEATHER)[keyof typeof WEATHER]) => {
    const all = samples((x, y, t) => windAt(x, y, t, p));
    return all.reduce((a, v) => a + Math.hypot(v.x, v.y), 0) / all.length;
  };
  expect(strength(WEATHER.calm)).toBeLessThan(strength(WEATHER.sunny));
  expect(strength(WEATHER.sunny)).toBeLessThan(strength(WEATHER.storm));
});

test('the prevailing direction veers over time, within windVeer', () => {
  const p = WEATHER.sunny;
  const dirs = Array.from({ length: 600 }, (_, i) => prevailing(i, p) / DEG - p.windDir);
  expect(Math.max(...dirs) - Math.min(...dirs)).toBeGreaterThan(p.windVeer);
  for (const d of dirs) expect(Math.abs(d)).toBeLessThanOrEqual(p.windVeer);
});

test('eddies bend the wind differently across the land at the same moment', () => {
  const p = { ...WEATHER.sunny, windGust: 0 };
  const headings = [];
  for (let x = 0; x < 1600; x += 200) for (let y = 0; y < 1200; y += 200) headings.push(angleOf(windAt(x, y, 10, p)));
  expect((Math.max(...headings) - Math.min(...headings)) / DEG).toBeGreaterThan(15);
});

test('gusts come and go, about once every gustEvery seconds', () => {
  const p = WEATHER.breezy;
  for (const [x, y] of [[0, 0], [700, -300], [-1200, 900]]) {
    let peaks = 0, above = false, quiet = false;
    for (let t = 0; t < 120; t += 0.1) {
      const g = gust(x, y, t, p);
      if (g < 0.05) quiet = true;
      if (!above && g > 0.3) peaks++;
      above = g > 0.3 ? true : g < 0.15 ? false : above;
    }
    expect(quiet).toBe(true);
    expect(peaks).toBeGreaterThan(120 / p.gustEvery / 3);
    expect(peaks).toBeLessThan((120 / p.gustEvery) * 3);
  }
});

test('a gust travels on downwind, and gusts don\'t all head the same way', () => {
  const p = { ...WEATHER.breezy, windBase: 0 };
  const headings: number[] = [];
  let checked = 0;
  for (let t = 0; t < 120; t += 0.1) {
    const g = gust(0, 0, t, p);
    if (g < 0.6 || gust(0, 0, t - 0.1, p) > g || gust(0, 0, t + 0.1, p) > g) continue; // a gust peaking here
    const v = windAt(0, 0, t, p);
    const a = angleOf(v);
    headings.push(a);
    // A second later the gust has moved on along its heading, not back where it came from.
    expect(gust(Math.cos(a) * 90, Math.sin(a) * 90, t + 1, p)).toBeGreaterThan(gust(-Math.cos(a) * 90, -Math.sin(a) * 90, t + 1, p));
    checked++;
  }
  expect(checked).toBeGreaterThan(5);
  expect((Math.max(...headings) - Math.min(...headings)) / DEG).toBeGreaterThan(20);
});
