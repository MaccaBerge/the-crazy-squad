import { expect, test } from 'vitest';
import { mixLight, WEATHER } from './weather';

const brightness = (c: number) => ((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114;

test('the light darkens from calm to overcast to storm, and storms are cool', () => {
  expect(WEATHER.calm.light).toBe(0xffffff);
  expect(brightness(WEATHER.overcast.light)).toBeLessThan(brightness(WEATHER.sunny.light));
  expect(brightness(WEATHER.storm.light)).toBeLessThan(brightness(WEATHER.overcast.light));
  expect(WEATHER.storm.light & 255).toBeGreaterThan(WEATHER.storm.light >> 16); // more blue than red
  expect(WEATHER.sunny.light >> 16).toBeGreaterThan(WEATHER.sunny.light & 255); // sunny is warm
});

test('the light fades channel by channel between two colours', () => {
  expect(mixLight(0xffffff, 0x000000, 0)).toBe(0xffffff);
  expect(mixLight(0xffffff, 0x000000, 1)).toBe(0x000000);
  expect(mixLight(0x204060, 0x406080, 0.5)).toBe(0x305070);
});
