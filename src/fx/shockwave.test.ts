import { expect, test, vi } from 'vitest';

vi.mock('phaser', () => ({ Filters: { Controller: class {} }, Renderer: { WebGL: { RenderNodes: { BaseFilterShader: class {} } } } }));
const { shockwaveAt } = await import('./shockwave');

test('a shockwave snaps out fast, slows, and its push fades to nothing', () => {
  expect(shockwaveAt(0, 160, 4)).toEqual({ radius: 0, strength: 4 });
  expect(shockwaveAt(1, 160, 4)).toEqual({ radius: 160, strength: 0 });
  expect(shockwaveAt(0.25, 160, 4).radius).toBeGreaterThan(80); // over half way out in the first quarter
  expect(shockwaveAt(2, 160, 4)).toEqual(shockwaveAt(1, 160, 4)); // clamped
});
