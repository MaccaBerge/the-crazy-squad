// Christian costume concepts at 32×32: slimmer (~14 px wide, ~30 px tall), one front and one running side frame each.
// Not used by the game yet. `node art/concepts/christian.mjs <outDir>` writes christian-concepts.png at 8×.
// Frames are built from stamps [y, x, pixels]; '.' inside a stamp leaves what's underneath.
import fs from 'node:fs';
import path from 'node:path';
import { sheet } from '../png.mjs';

const SIZE = 32;
const palette = {
  o: 0x1a1420, // outline
  h: 0x1f1a19, H: 0x3d3330, b: 0x1f1a19, // hair, highlight, brows/pupils
  s: 0xc68a5f, S: 0xa16a44, t: 0x9c6f4e, // tan skin, shade, stubble
  w: 0xf4f4f4,
  u: 0xd0312d, U: 0x8a1c20, // red suit, shade
  y: 0xf5c542, k: 0xf5c542, K: 0xc9962a, // yellow accents, boots, boot shade
  r: 0xf5c542, // scarf
};

const draw = (stamps) => {
  const rows = Array.from({ length: SIZE }, () => '.'.repeat(SIZE).split(''));
  for (const [y, x, s] of stamps) [...s].forEach((c, i) => c !== '.' && (rows[y][x + i] = c));
  return rows.map((r) => r.join(''));
};

const headFront = [
  [2, 12, 'o..o.o.o'],
  [3, 11, 'ohoohohoho'],
  [4, 10, 'ohhhhhhhhhho'],
  [5, 10, 'ohhHhhhhhHho'],
  [6, 10, 'ohhhhhhhhhho'],
  [7, 10, 'ohhhhhhhhhho'],
  [8, 10, 'ohssssssssho'],
  [9, 10, 'osbbbssbbbso'],
  [10, 10, 'oswbsssswbso'],
  [11, 10, 'ossssSSsssso'],
  [12, 10, 'otssssssssto'],
  [13, 11, 'ottsssstto'],
  [14, 12, 'otttttto'],
  [15, 14, 'oSSo'],
];
const bodyFront = [
  [16, 10, 'oUuuuuuuuuUo'],
  ...[17, 18, 19, 20].map((y) => [y, 9, 'ouUuuuuuuuuUuo']),
  [21, 9, 'ouUyyyyyyyyUuo'],
  [22, 9, 'oSouuuuuuuuoSo'],
  [23, 11, 'ouuuuuuuuo'],
  ...[24, 25, 26, 27].map((y) => [y, 11, 'ouuUooUuuo']),
  [28, 11, 'okkKooKkko'],
  [29, 11, 'okkKooKkko'],
  [30, 10, 'okkkKooKkkko'],
  [31, 10, 'ooooo..ooooo'],
];
// Chest emblems on the torso (x 12–19, rows 17–20).
const emblems = {
  chevron: [[17, 12, 'y......y'], [18, 13, 'y....y'], [19, 14, 'y..y'], [20, 15, 'yy']],
  streak: [[17, 12, 'yy'], [18, 14, 'yy'], [19, 16, 'yy'], [20, 18, 'yy']],
  arrow: [[17, 15, 'yy'], [18, 14, 'yyyy'], [19, 15, 'yy'], [20, 15, 'yy']],
};
const cuffsFront = [[21, 10, 'y'], [21, 21, 'y']];
const shadeFront = [17, 18, 19, 20].map((y) => [y, 19, 'U']);

const headSide = [
  [2, 12, 'o.o.o'],
  [3, 11, 'ohohohoo'],
  [4, 10, 'ohhhhhhhhho'],
  [5, 10, 'ohhhHhhhhhho'],
  [6, 10, 'ohhhhhhhhhho'],
  [7, 10, 'ohhhhhhhhhho'],
  [8, 10, 'ohhhhhhhhhso'],
  [9, 10, 'ohhhhhhsbbbo'],
  [10, 10, 'ohhhhssswbso'],
  [11, 10, 'ohhhssssssso'],
  [12, 10, 'ohsssssstso'],
  [13, 11, 'osttttto'],
  [14, 12, 'otttto'],
  [15, 13, 'oSSo'],
];
const bodySide = [
  [16, 11, 'oUuuuuuUo'],
  ...[17, 18, 19, 20].map((y) => [y, 11, 'ouuuUUuuUo']),
  [21, 11, 'oyyyyyyyyo'],
  [22, 11, 'ouuuSSuuUo'],
  [23, 11, 'ouuuuuuuUo'],
  [24, 10, 'ouuuo.ouuuo'],
  [25, 10, 'ouuuo..ouuuo'],
  [26, 9, 'ouuuo...ouuuo'],
  [27, 9, 'ouuuo....ouuuo'],
  [28, 8, 'okkko.....okkko'],
  [29, 8, 'okkko......okkko'],
  [30, 7, 'okkkKo......okkkkKo'],
  [31, 7, 'oooooo......ooooooo'],
];
const emblemSide = [[17, 18, 'y'], [18, 17, 'y'], [19, 18, 'y']];
const scarfFront = [[15, 13, 'orrrro']];
const scarfSide = [[15, 7, 'rrrr.orro'], [16, 4, 'rrrr'], [17, 2, 'rrr']];

export const variants = [
  { name: 'E Chevron', emblem: 'chevron', scarf: false },
  { name: 'F Streak + scarf', emblem: 'streak', scarf: true },
  { name: 'G Arrow', emblem: 'arrow', scarf: false },
];

const front = (v) => draw([...headFront, ...bodyFront, ...shadeFront, ...emblems[v.emblem], ...cuffsFront, ...(v.scarf ? scarfFront : [])]);
const side = (v) => draw([...headSide, ...bodySide, ...emblemSide, ...(v.scarf ? scarfSide : [])]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2] ?? '.';
  const frames = variants.flatMap((v) => [front(v), side(v)]);
  fs.writeFileSync(path.join(outDir, 'christian-concepts.png'), sheet(frames, palette, SIZE, frames.length, 8, 0x2d5a27));
  console.log(variants.map((v) => v.name).join(', '));
}
