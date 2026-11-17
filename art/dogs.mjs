// Packs each dog's 8 PixelLab rotations (art/dogs/sprites/<name>/rotations/) into public/assets/dogs/<name>.png:
// one 32×32 frame per direction, in src/art/facing.ts order (right, down-right, down, ... up-right).
// shortcut: no palette check yet (the squad build in build.mjs has one); add it when the dogs are snapped to the palette.
import fs from 'node:fs';
import path from 'node:path';
import { decode, png } from './png.mjs';

const ORDER = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const S = 32;
const src = path.join(import.meta.dirname, 'dogs', 'sprites');
const out = path.resolve(import.meta.dirname, '../public/assets/dogs');
fs.mkdirSync(out, { recursive: true });

for (const name of fs.readdirSync(src).filter((n) => fs.statSync(path.join(src, n)).isDirectory())) {
  const sheet = new Uint8Array(S * ORDER.length * S * 4);
  ORDER.forEach((d, k) => {
    const { w, h, px } = decode(fs.readFileSync(path.join(src, name, 'rotations', `${d}.png`)));
    if (w !== S || h !== S) throw new Error(`${name}/${d}: ${w}×${h}, expected ${S}×${S}`);
    for (let y = 0; y < S; y++) sheet.set(px.subarray(y * S * 4, (y + 1) * S * 4), (y * S * ORDER.length + k * S) * 4);
  });
  fs.writeFileSync(path.join(out, `${name}.png`), png(S * ORDER.length, S, sheet));
  console.log('built dog', name);
}
