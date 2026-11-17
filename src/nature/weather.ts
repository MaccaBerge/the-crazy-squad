// Weather presets, one per level (nature blueprint §2). Light tint and darkness come with build step 9.

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

export const WEATHER = {
  calm: { windBase: 0.05, windGust: 0, gustEvery: 10, windDir: 0, windVeer: 70 },
  sunny: { windBase: 0.2, windGust: 0.25, gustEvery: 9, windDir: 0, windVeer: 45 },
  breezy: { windBase: 0.4, windGust: 0.4, gustEvery: 6, windDir: 0, windVeer: 35 },
  overcast: { windBase: 0.35, windGust: 0.4, gustEvery: 6, windDir: 20, windVeer: 35 },
  storm: { windBase: 0.7, windGust: 0.6, gustEvery: 3.5, windDir: 10, windVeer: 20 },
} satisfies Record<string, WindParams>;

export type WeatherName = keyof typeof WEATHER;
export const DEFAULT_WEATHER: WeatherName = 'sunny';

export const isWeather = (name: unknown): name is WeatherName => typeof name === 'string' && name in WEATHER;
