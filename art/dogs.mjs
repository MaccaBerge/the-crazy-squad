// Packs each dog (art/dogs/sprites/<name>/) into public/assets/dogs/<name>.png plus <name>.anims.json.
// Frames are 32×32 on a 16-column grid. Frames 0–7 are the rotations in src/art/facing.ts order (right, down-right,
// down, ... up-right). Then every animation in animations/<anim>/<pixellab direction>/frame_NNN.png, listed in the
// JSON as "<anim>-<direction>": [frame numbers]. Custom PixelLab animations come on a bigger canvas; they're cut back
// to 32×32, centred, with the lowest pixel (the feet) on the same row as in the rotation.
// shortcut: no palette check yet (the squad build in build.mjs has one); add it when the dogs are snapped to the palette.
import fs from 'node:fs';
import path from 'node:path';
import { decode, png } from './png.mjs';

const ORDER = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const S = 32, COLS = 16;
const src = path.join(import.meta.dirname, 'dogs', 'sprites');
const out = path.resolve(import.meta.dirname, '../public/assets/dogs');
fs.mkdirSync(out, { recursive: true });

/** Lowest row with an opaque pixel, over all frames. */
const feet = (frames) => Math.max(...frames.map(({ w, h, px }) => {
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3]) return y;
  return -1;
}));

/** Cuts a frame to 32×32: centred, with its feet row moved to `footRow`. */
function cut({ w, h, px }, footFrom, footRow) {
  const out = new Uint8Array(S * S * 4), ox = Math.floor((w - S) / 2), oy = footFrom - footRow;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const sx = x + ox, sy = y + oy;
    if (sx >= 0 && sy >= 0 && sx < w && sy < h) out.set(px.subarray((sy * w + sx) * 4, (sy * w + sx) * 4 + 4), (y * S + x) * 4);
  }
  return out;
}

/** A 32×32 frame breathing out: rows above the waist move down 1 px, the legs stay put. */
function bob(px) {
  const rows = [...Array(S).keys()].filter((y) => px.subarray(y * S * 4, (y + 1) * S * 4).some((v, k) => k % 4 === 3 && v));
  const top = rows[0], waist = top + Math.round((rows.at(-1) - top) * 0.55), out = px.slice();
  for (let y = waist; y > top; y--) out.set(px.subarray((y - 1) * S * 4, y * S * 4), y * S * 4);
  out.fill(0, top * S * 4, (top + 1) * S * 4);
  if (out.subarray((waist + 1) * S * 4).some((v, k) => v !== px[(waist + 1) * S * 4 + k])) throw new Error('bob moved the legs');
  return out;
}

/**
 * PixelLab draws front and back walks with both arms in sync (mirror images), so swing them here: in the first half
 * of the loop the left arm sits 1 px lower and the right 1 px higher, in the second half the other way round.
 * Arms = the outer columns of the body, from the shoulders down to just above the feet.
 */
function swingArms(px, i, n) {
  const op = (x, y) => px[(y * S + x) * 4 + 3] > 0;
  let top = S, feet = 0, lo = S, hi = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (op(x, y)) { top = Math.min(top, y); feet = y; lo = Math.min(lo, x); hi = Math.max(hi, x); }
  const arm = Math.max(3, Math.round((hi - lo + 1) * 0.22)), a = top + Math.round((feet - top) * 0.3), b = feet - 3, out = px.slice();
  const at = (x, y) => px.subarray((y * S + x) * 4, (y * S + x + 1) * 4);
  const shift = (x0, x1, dy) => { for (let x = x0; x <= x1; x++) for (let y = a + 1; y < b; y++) out.set(at(x, y - dy), (y * S + x) * 4); };
  const down = i < n / 2 ? 1 : -1;
  shift(lo, lo + arm - 1, down);
  shift(hi - arm + 1, hi, -down);
  return out;
}

for (const name of fs.readdirSync(src).filter((n) => fs.statSync(path.join(src, n)).isDirectory())) {
  const dir = path.join(src, name);
  const rotations = ORDER.map((d) => decode(fs.readFileSync(path.join(dir, 'rotations', `${d}.png`))));
  for (const r of rotations) if (r.w !== S || r.h !== S) throw new Error(`${name}: rotations must be ${S}×${S}`);
  const footRow = feet(rotations);
  const frames = rotations.map((r) => r.px), anims = {};
  const animDir = path.join(dir, 'animations');
  if (!fs.existsSync(path.join(animDir, 'idle'))) {
    // No PixelLab idle (theirs swung the arms out): breathe in code, 4 frames still + 4 with the upper body 1 px down.
    for (const d of ['south', 'south-east', 'east', 'north-east', 'north']) {
      const still = rotations[ORDER.indexOf(d)].px, i = frames.push(still) - 1, j = frames.push(bob(still)) - 1;
      anims[`idle-${d}`] = [i, i, i, i, j, j, j, j];
    }
  }
  for (const anim of fs.existsSync(animDir) ? fs.readdirSync(animDir).sort() : []) {
    for (const d of fs.readdirSync(path.join(animDir, anim)).sort()) {
      const fd = path.join(animDir, anim, d);
      const imgs = fs.readdirSync(fd).filter((f) => f.endsWith('.png')).sort().map((f) => decode(fs.readFileSync(path.join(fd, f))));
      const from = feet(imgs);
      const swing = ['walk', 'run'].includes(anim) && ['north', 'south'].includes(d);
      anims[`${anim}-${d}`] = imgs.map((im, i) => { const f = cut(im, from, footRow); return frames.push(swing ? swingArms(f, i, imgs.length) : f) - 1; });
    }
  }
  const rows = Math.ceil(frames.length / COLS), W = COLS * S, sheet = new Uint8Array(W * rows * S * 4);
  frames.forEach((f, i) => {
    const fx = (i % COLS) * S, fy = Math.floor(i / COLS) * S;
    for (let y = 0; y < S; y++) sheet.set(f.subarray(y * S * 4, (y + 1) * S * 4), ((fy + y) * W + fx) * 4);
  });
  fs.writeFileSync(path.join(out, `${name}.png`), png(W, rows * S, sheet));
  fs.writeFileSync(path.join(out, `${name}.anims.json`), JSON.stringify(anims) + '\n');
  console.log('built dog', name, `${frames.length} frames, ${Object.keys(anims).length} animations`);
}
