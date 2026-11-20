import { describe, expect, it } from 'vitest';
import { colors, ramps, inPalette, nearest, tintOutlines } from './palette.mjs';

describe('palette', () => {
  it('has no pure black, pure white or grey', () => {
    for (const c of colors) {
      const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
      expect(r === g && g === b, `#${c.toString(16)} is neutral`).toBe(false);
    }
  });

  it('every outline is a palette color', () => {
    for (const [name, r] of Object.entries(ramps)) expect(inPalette(r.outline), name).toBe(true);
  });

  it('snaps off-palette colors to the nearest palette color', () => {
    expect(nearest(0x000000)).toBe(0x241520);
    expect(nearest(0xfff4d8)).toBe(0xfff6dc);
    expect(nearest(0x3e6a38)).toBe(0x3e6a38);
  });

  it('tints each outline pixel by the ramp it borders', () => {
    const { frames, palette } = tintOutlines([['.os', '.o.', '.ol']], { o: 0x241520, s: 0xd89a6c, l: 0x3e6a38 });
    const [top, , bottom] = frames[0];
    expect(palette[top[1]]).toBe(ramps.skin.outline);
    expect(palette[bottom[1]]).toBe(ramps.leaf.outline);
    expect(frames[0][1]).toBe('.o.'); // borders nothing → keeps the fallback
  });
});
