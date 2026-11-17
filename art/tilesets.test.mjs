import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decode } from './png.mjs';
import { inPalette } from './palette.mjs';

// Every tileset built from art/tilesets/ must be strictly on the palette (world-art-style.md).
const built = fs.readdirSync(new URL('./tilesets/', import.meta.url)).filter((n) => fs.statSync(new URL(`./tilesets/${n}`, import.meta.url)).isDirectory());

describe.each(built)('tileset %s', (name) => {
  it('is built, opaque or transparent, and on the palette', () => {
    const { px } = decode(fs.readFileSync(new URL(`../public/assets/tilesets/${name}.png`, import.meta.url)));
    const bad = [];
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      if (px[i + 3] !== 255 || !inPalette((px[i] << 16) | (px[i + 1] << 8) | px[i + 2])) bad.push(i / 4);
    }
    expect(bad.length, `off-palette pixels (run npm run art)`).toBe(0);
  });
});
