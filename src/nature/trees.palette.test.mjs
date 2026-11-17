// Every tree image must be on the palette with fully opaque or fully clear pixels, like the characters and tilesets.
import fs from 'node:fs';
import { expect, test } from 'vitest';
import { inPalette } from '../../art/palette.mjs';
import { decode } from '../../art/png.mjs';
import { TREE_TYPES } from './treeTypes.ts';

test.each(Object.keys(TREE_TYPES))('tree %s is on the palette', (name) => {
  const im = decode(fs.readFileSync(`public/assets/trees/${name}.png`));
  const bad = [];
  for (let i = 0; i < im.w * im.h; i++) {
    const a = im.px[i * 4 + 3];
    const rgb = (im.px[i * 4] << 16) | (im.px[i * 4 + 1] << 8) | im.px[i * 4 + 2];
    if (a && (a < 255 || !inPalette(rgb))) bad.push(`${i % im.w},${Math.floor(i / im.w)}`);
  }
  expect(bad.slice(0, 5), `${bad.length} bad pixels`).toEqual([]);
});
