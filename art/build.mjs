// Builds every character into public/assets/sprites/<id>.png + <id>.anims.json (art blueprint §4).
// Hand-typed: art/characters/<id>.mjs (Piskel-style route).
// PixelLab: art/pixellab/<id>/rotations/<direction>.png and, once made, animations/walk/<direction>/frame_NNN.png
// (the layout of PixelLab's character ZIP). Every pixel must be a palette color, or the build fails.
// `node art/build.mjs --preview <dir>` also writes 8× previews there for review.
import fs from 'node:fs';
import path from 'node:path';
import { decode, sheet } from './png.mjs';
import { colors } from './palette.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/assets/sprites');
const preview = process.argv.includes('--preview') ? process.argv[process.argv.indexOf('--preview') + 1] : null;
fs.mkdirSync(out, { recursive: true });

function write(id, { frames, palette, anims, size, columns }) {
  fs.writeFileSync(path.join(out, `${id}.png`), sheet(frames, palette, size, columns));
  fs.writeFileSync(path.join(out, `${id}.anims.json`), JSON.stringify({ frameWidth: size, frameHeight: size, anims }, null, 2) + '\n');
  if (preview) fs.writeFileSync(path.join(preview, `${id}-preview.png`), sheet(frames, palette, size, columns, 8, 0x5e9640));
  console.log('built', id);
}

for (const file of fs.readdirSync(path.join(import.meta.dirname, 'characters'))) {
  write(path.basename(file, '.mjs'), await import(`./characters/${file}`));
}

// PixelLab characters: same sheet layout as the hand-typed ones, one row per drawn direction (left is mirrored in game).
const ROWS = { down: 'south', 'down-side': 'south-east', side: 'east', 'up-side': 'north-east', up: 'north' };
const charOf = new Map(colors.map((c, i) => [c, String.fromCharCode(0x100 + i)]));
const palette = Object.fromEntries([...charOf].map(([c, ch]) => [ch, c]));

/** A PNG as a hand-typed frame: one char per pixel, '.' transparent. Throws on an off-palette or half-transparent pixel. */
function frameOf(file) {
  const { w, h, px } = decode(fs.readFileSync(file));
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const i = (y * w + x) * 4;
    if (px[i + 3] === 0) return '.';
    const rgb = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    if (px[i + 3] !== 255 || !charOf.has(rgb)) throw new Error(`${file} (${x},${y}): #${rgb.toString(16).padStart(6, '0')} alpha ${px[i + 3]} is not in the palette`);
    return charOf.get(rgb);
  }).join(''));
}

const plDir = path.join(import.meta.dirname, 'pixellab');
for (const id of fs.existsSync(plDir) ? fs.readdirSync(plDir) : []) {
  const dir = path.join(plDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const walkOf = (d) => {
    const wd = path.join(dir, 'animations/walk', d);
    return fs.existsSync(wd) ? fs.readdirSync(wd).filter((f) => f.endsWith('.png')).sort().map((f) => frameOf(path.join(wd, f))) : [];
  };
  const rows = Object.entries(ROWS).map(([row, d]) => ({ row, still: frameOf(path.join(dir, 'rotations', `${d}.png`)), walk: walkOf(d) }));
  const columns = 1 + Math.max(...rows.map((r) => r.walk.length));
  const blank = rows[0].still.map((r) => '.'.repeat(r.length));
  const frames = [], anims = {};
  rows.forEach(({ row, still, walk }, r) => {
    frames.push(still, ...walk, ...Array(columns - 1 - walk.length).fill(blank));
    anims[`idle-${row}`] = { frames: [r * columns], frameRate: 1 };
    anims[`walk-${row}`] = walk.length ? { frames: walk.map((_, i) => r * columns + 1 + i), frameRate: 10 } : anims[`idle-${row}`];
  });
  write(id, { frames, palette, anims, size: blank.length, columns });
}
