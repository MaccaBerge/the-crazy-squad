// Weather presets, one per level (nature blueprint §2): the wind, and the light the whole level is seen in.

/**
 * Wind settings. `windBase` and `windGust` are 0–1 shares of full strength, `windDir` is degrees (0 = blowing right,
 * 90 = down), and `windVeer` is how many degrees the wind wanders either way of it: light air wanders most.
 */
export interface WindParams {
  windBase: number;
  windGust: number;
  gustEvery: number; // seconds between gusts
  windDir: number;
  windVeer: number;
}

/** A weather preset: its wind, plus `light`, a colour the whole level is multiplied by (0xffffff leaves the art as drawn). */
export interface Weather extends WindParams {
  light: number;
}

export const WEATHER = {
  calm: { windBase: 0.05, windGust: 0, gustEvery: 10, windDir: 0, windVeer: 70, light: 0xffffff },
  sunny: { windBase: 0.2, windGust: 0.25, gustEvery: 9, windDir: 0, windVeer: 45, light: 0xfff0d8 }, // warm
  breezy: { windBase: 0.4, windGust: 0.4, gustEvery: 6, windDir: 0, windVeer: 35, light: 0xfdfcf6 },
  overcast: { windBase: 0.35, windGust: 0.4, gustEvery: 6, windDir: 20, windVeer: 35, light: 0xc6cede }, // a little darker, cool
  storm: { windBase: 0.7, windGust: 0.6, gustEvery: 3.5, windDir: 10, windVeer: 20, light: 0x8590b2 }, // dark, cool
} satisfies Record<string, Weather>;

export type WeatherName = keyof typeof WEATHER;
export const DEFAULT_WEATHER: WeatherName = 'sunny';

export const isWeather = (name: unknown): name is WeatherName => typeof name === 'string' && name in WEATHER;

/** The colour k (0..1) of the way from light `a` to light `b`, per channel: how the light fades when the weather turns. */
export function mixLight(a: number, b: number, k: number) {
  const ch = (c: number, shift: number) => (c >> shift) & 255;
  const mix = (shift: number) => Math.round(ch(a, shift) + (ch(b, shift) - ch(a, shift)) * k) << shift;
  return mix(16) | mix(8) | mix(0);
}
