// The blade ramps are copied into bladeShapes.ts so the game doesn't import art/; this keeps the copy on the palette.
import { expect, test } from 'vitest';
import { ramps } from '../../art/palette.mjs';
import { RAMPS } from './bladeShapes.ts';

test.each(Object.entries(RAMPS))('blade ramp %s matches the palette', (name, colors) => {
  expect(colors).toEqual(ramps[name].colors);
});
