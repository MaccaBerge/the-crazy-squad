// Builds each world tileset from art/tilesets/<name>/ into public/assets/tilesets/<name>.png (world-art-style.md).
// layout.json places pieces on a grid of 16×16 tiles: `at` and `size` are in tiles. A `crop` piece is trimmed to its
// pixels and placed bottom-centre in its cells, so objects stand on the bottom edge. Every pixel must be a palette
// color, or the build fails. `blocks` is how many bottom rows block movement; the rows above them go on the Above layer.
import fs from 'node:fs';
import path from 'node:path';
import { decode, png } from './png.mjs';
import { inPalette } from './palette.mjs';

const TILE = 16;
const src = path.join(import.meta.dirname, 'tilesets');
const out = path.resolve(import.meta.dirname, '../public/assets/tilesets');

for (const name of fs.readdirSync(src).filter((n) => fs.statSync(path.join(src, n)).isDirectory())) {
  const dir = path.join(src, name);
  const { columns, rows, pieces } = JSON.parse(fs.readFileSync(path.join(dir, 'layout.json'), 'utf8'));
  const W = columns * TILE, H = rows * TILE;
  const sheet = new Uint8Array(W * H * 4);
  const taken = new Set();

  for (const p of pieces) {
    const [cx, cy] = p.at, [cw, ch] = p.size;
    for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) {
      if (x >= columns || y >= rows) throw new Error(`${name}/${p.name}: cell ${x},${y} is outside the ${columns}×${rows} sheet`);
      if (taken.has(`${x},${y}`)) throw new Error(`${name}/${p.name}: cell ${x},${y} is already used`);
      taken.add(`${x},${y}`);
    }
    const img = decode(fs.readFileSync(path.join(dir, p.file)));
    let box = { x: 0, y: 0, w: img.w, h: img.h };
    if (p.crop) {
      let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    if (box.w > cw * TILE || box.h > ch * TILE) throw new Error(`${name}/${p.name}: ${box.w}×${box.h} px doesn't fit ${cw}×${ch} tiles`);
    const ox = cx * TILE + (p.crop ? Math.floor((cw * TILE - box.w) / 2) : 0);
    const oy = cy * TILE + (p.crop ? ch * TILE - box.h : 0);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
      const i = ((box.y + y) * img.w + box.x + x) * 4, a = img.px[i + 3];
      if (!a) continue;
      const rgb = (img.px[i] << 16) | (img.px[i + 1] << 8) | img.px[i + 2];
      if (a !== 255 || !inPalette(rgb)) throw new Error(`${name}/${p.file} (${box.x + x},${box.y + y}): #${rgb.toString(16).padStart(6, '0')} alpha ${a} is not in the palette`);
      sheet.set(img.px.subarray(i, i + 4), ((oy + y) * W + ox + x) * 4);
    }
  }
  fs.writeFileSync(path.join(out, `${name}.png`), png(W, H, sheet));
  console.log('built tileset', name);
}
