// The real tree images cut into clumps the way the game cuts them.
import fs from 'node:fs';
import { expect, test } from 'vitest';
import { decode } from '../../art/png.mjs';
import { clumpOffset, findClumps } from './leafClumps.ts';
import { TREE_TYPES } from './treeTypes.ts';

test.each(Object.entries(TREE_TYPES))('%s cuts into separate leaf clumps above the trunk', (name, t) => {
  const im = decode(fs.readFileSync(`public/assets/trees/${name}.png`));
  const clumps = findClumps(im.px, im.w, im.h, t.swayFrom);
  expect(clumps.length).toBeGreaterThanOrEqual(8);
  const seen = new Set();
  for (const c of clumps) {
    expect(c.pixels.length).toBeGreaterThanOrEqual(12);
    for (const i of c.pixels) {
      expect(seen.has(i)).toBe(false);
      seen.add(i);
      expect(Math.floor(i / im.w)).toBeLessThan(t.swayFrom);
      expect(im.px[i * 4 + 1]).toBeGreaterThan(im.px[i * 4]); // leaves only, never bark
    }
  }
  for (let k = 1; k < clumps.length; k++) expect(clumps[k].lum).toBeGreaterThanOrEqual(clumps[k - 1].lum);
});

test('clumps never move further than the tree allows, and higher ones lean further', () => {
  const at = (cy) => ({ pixels: [], cx: 0, cy, lum: 0.5 });
  for (const lean of [-1, -0.3, 0, 0.6, 1])
    for (const t of [0, 0.4, 1.7, 5]) {
      const { dx, dy } = clumpOffset(at(10), 3, lean, t, 3, 100);
      expect(Math.abs(dx)).toBeLessThanOrEqual(3);
      expect(Math.abs(dy)).toBeLessThanOrEqual(1);
    }
  expect(clumpOffset(at(0), 0, 1, 0, 3, 100).dx).toBeGreaterThanOrEqual(clumpOffset(at(90), 0, 1, 0, 3, 100).dx);
});
