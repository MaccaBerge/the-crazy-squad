import type { WindParams } from './weather';

const GUST_SPEED = 90; // px/s a gust front travels across the level
const GUST_LENGTH = 1.4; // seconds a gust takes to pass one spot

/**
 * The wind at a world position (px) and time (s), from -1 to 1. Positive leans things in the wind's direction
 * (`windDir`); negative is the small swing back. Deterministic: same inputs, same wind (nature blueprint §3).
 */
export function wind(x: number, y: number, t: number, p: WindParams): number {
  const d = (p.windDir * Math.PI) / 180;
  const along = x * Math.cos(d) + y * Math.sin(d); // distance downwind
  const across = -x * Math.sin(d) + y * Math.cos(d);

  // Steady sway: waves rolling downwind, two speeds so it never looks like a loop.
  const sway = 0.6 * Math.sin(t * 1.9 - along * 0.045) + 0.4 * Math.sin(t * 0.8 - along * 0.018 + across * 0.01 + 1.7);
  const base = p.windBase * (0.4 + 0.6 * sway);

  return Math.max(-1, Math.min(1, base + p.windGust * gust(x, y, t, p)));
}

/** How much of a gust is passing a spot right now, 0–1: a bump that sweeps downwind every gustEvery seconds, stronger in some lanes. */
export function gust(x: number, y: number, t: number, p: WindParams): number {
  const d = (p.windDir * Math.PI) / 180;
  const along = x * Math.cos(d) + y * Math.sin(d);
  const across = -x * Math.sin(d) + y * Math.cos(d);
  const local = t - along / GUST_SPEED; // the time the gust front left x = 0
  const u = ((local % p.gustEvery) + p.gustEvery) % p.gustEvery;
  const bump = u < GUST_LENGTH ? Math.sin((Math.PI * u) / GUST_LENGTH) ** 2 : 0;
  return bump * (0.65 + 0.35 * Math.sin(across * 0.02 + Math.floor(local / p.gustEvery) * 2.3));
}
