import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decode, png } from './png.mjs';

describe('png', () => {
  it('decodes what it encodes', () => {
    const px = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) % 256);
    const img = decode(png(3, 2, px));
    expect([img.w, img.h]).toEqual([3, 2]);
    expect([...img.px]).toEqual([...px]);
  });

  it('decodes PixelLab exports', () => {
    const img = decode(fs.readFileSync(new URL('./pixellab/marcus/rotations/south.png', import.meta.url)));
    expect([img.w, img.h]).toEqual([32, 32]);
    expect(img.px.some((v, i) => i % 4 === 3 && v === 255)).toBe(true);
  });
});
