// Builds autumn versions of some trees and bushes: public/assets/trees/autumn-<name>.png from <name>.png, by swapping
// each green, teal and moss tone for the autumn tone at the same step (dark leaves turn wine red, lit ones gold).
// Trunks, shade and berries or blossoms keep their colours. Run with `npm run art`.
import fs from 'node:fs';
import path from 'node:path';
import { ramps } from '../palette.mjs';
import { decode, png } from '../png.mjs';

export const AUTUMN_OF = ['young-oak', 'slender-tree', 'round-bush', 'berry-bush', 'flowering-bush'];

const swap = new Map();
for (const r of [ramps.teal, ramps.fern, ramps.moss, ramps.leaf])
  r.colors.forEach((c, i) => swap.set(c, ramps.autumn.colors[Math.round((i / (r.colors.length - 1)) * 3)])); // top step 3: the pale gold reads as yellow, not autumn

/** RGBA pixels of a tree image recoloured to autumn. */
export function autumnize(px) {
  const out = Uint8Array.from(px);
  for (let i = 0; i < out.length; i += 4) {
    if (!out[i + 3]) continue;
    const to = swap.get((out[i] << 16) | (out[i + 1] << 8) | out[i + 2]);
    if (to !== undefined) out.set([to >> 16, (to >> 8) & 255, to & 255], i);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.resolve(import.meta.dirname, '../../public/assets/trees');
  for (const name of AUTUMN_OF) {
    const im = decode(fs.readFileSync(path.join(dir, `${name}.png`)));
    fs.writeFileSync(path.join(dir, `autumn-${name}.png`), png(im.w, im.h, autumnize(im.px)));
    console.log('built', `autumn-${name}`);
  }
}
