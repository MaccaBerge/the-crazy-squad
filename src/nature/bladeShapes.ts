// Blade, flower and reed art for the moving grass (nature blueprint §4, step 5). Drawn as data, bent into poses by code.
// No imports, so the art preview script can run it under plain Node.

/** Cool nature ramps and accents, copied from art/palette.mjs (bladeShapes.palette.test.mjs keeps them in sync). Dark → light. */
export const RAMPS = {
  fern: [0x1d5217, 0x3f7a2e, 0x629f54, 0xa1b875],
  moss: [0x4f4a1c, 0x6b6324, 0x818634, 0xb3b85a],
  teal: [0x0f3a3c, 0x27596c, 0x368578, 0x549e9f, 0x86c9a6],
  violet: [0x2c0d37, 0x4d1852, 0x6a3787, 0x9155a0, 0xb476b8],
  autumn: [0x7a2a36, 0xb4443a, 0xde7438, 0xf2a846, 0xffd77a],
  berry: [0x5c1f48, 0x943464, 0xd0607a, 0xf29a9a],
  wood: [0x4a2a2a, 0x6e3b30, 0x955536, 0xbb7845],
} as const;
type Ramp = keyof typeof RAMPS;

export type BladeKind = 'grass' | 'flower' | 'reed' | 'autumn';

/**
 * One drawing, top row first, root row last. `.` is empty, a digit is a step of `ramp` (0 = darkest),
 * a letter a–e is a step of `head` (a = darkest). `root` is the column that sits on the blade's position.
 * Light comes from the top-left: tips and left columns are lighter.
 */
export interface Shape {
  name: string;
  kind: BladeKind;
  ramp: Ramp;
  head?: Ramp;
  root?: number;
  weight?: number; // how often it's picked among its kind (default 1)
  rows: string[];
}

export const SHAPES: Shape[] = [
  { name: 'fern short', kind: 'grass', ramp: 'fern', weight: 3, rows: ['3', '3', '2', '2', '1', '1'] },
  { name: 'fern tall', kind: 'grass', ramp: 'fern', weight: 2, rows: ['3.', '3.', '2.', '2.', '2.', '21', '21', '11', '10', '10'] },
  { name: 'fern hook', kind: 'grass', ramp: 'fern', weight: 2, rows: ['.3', '.2', '2.', '2.', '1.', '1.', '1.', '1.'] },
  { name: 'moss short', kind: 'grass', ramp: 'moss', weight: 2, rows: ['3', '3', '2', '2', '1', '1'] },
  { name: 'moss tall', kind: 'grass', ramp: 'moss', rows: ['3', '3', '2', '2', '2', '1', '1', '1', '1'] },
  { name: 'teal tall', kind: 'grass', ramp: 'teal', weight: 0.7, rows: ['4.', '3.', '3.', '3.', '2.', '2.', '32', '32', '21', '21', '21'] },
  { name: 'violet flower', kind: 'flower', ramp: 'fern', head: 'violet', root: 1, rows: ['.e.', 'ede', '.c.', '.2.', '.2.', '.1.', '.1.', '.1.'] },
  { name: 'gold flower', kind: 'flower', ramp: 'fern', head: 'autumn', rows: ['ed', 'dc', '2.', '2.', '1.', '1.', '1.'] },
  { name: 'pink flower', kind: 'flower', ramp: 'fern', head: 'berry', root: 1, rows: ['.d.', 'dcd', '.2.', '.1.', '.1.', '.1.'] },
  // Autumn grass: dry olive, golden and rust blades and seed heads, for autumn areas.
  { name: 'dry short', kind: 'autumn', ramp: 'moss', weight: 3, rows: ['3', '3', '2', '2', '1', '1'] },
  { name: 'golden tall', kind: 'autumn', ramp: 'autumn', weight: 2, rows: ['3.', '3.', '3.', '2.', '2.', '21', '21', '11', '10', '10'] },
  { name: 'rust hook', kind: 'autumn', ramp: 'autumn', weight: 1.5, rows: ['.2', '.2', '1.', '1.', '1.', '0.', '0.', '0.'] },
  { name: 'seed head', kind: 'autumn', ramp: 'moss', head: 'autumn', rows: ['d.', 'dc', 'c.', '2.', '2.', '1.', '1.', '1.'] },
  {
    name: 'cattail', kind: 'reed', ramp: 'moss', head: 'wood',
    rows: ['2.', 'dc', 'cb', 'cb', 'cb', 'ba', '2.', '2.', '2.', '2.', '2.', '1.', '1.', '1.', '1.', '1.', '1.'],
  },
  {
    name: 'reed leaf', kind: 'reed', ramp: 'teal',
    rows: ['4.', '3.', '3.', '3.', '3.', '2.', '2.', '2.', '2.', '2.', '21', '21', '21', '21', '11', '11', '10'],
  },
];

export const MAX_POSE = 3; // poses are -3..3: three steps of lean each way
export const CELL = { w: 16, h: 24 }; // texture cell per shape and pose; the root sits at column CELL.w / 2

/** Sideways offset (px) of row `r` (0 = root) of a shape `h` tall, in lean pose `pose`: the tip moves most, taller shapes more. */
export const bendOffset = (pose: number, r: number, h: number) => Math.round(pose * Math.min(h / 8, 2) * (r / (h - 1)) ** 2);

/** The pixels of a shape in a pose, relative to its root: x right, y up from the root row (0). */
export function drawShape(shape: Shape, pose: number) {
  const h = shape.rows.length;
  const pixels: { x: number; y: number; color: number }[] = [];
  const darker = Math.abs(pose) >= 2 ? 1 : 0; // leaning far shows the shaded side
  shape.rows.forEach((row, i) => {
    const r = h - 1 - i;
    [...row].forEach((c, col) => {
      if (c === '.') return;
      const head = c >= 'a';
      const ramp = RAMPS[head ? shape.head! : shape.ramp];
      const step = head ? c.charCodeAt(0) - 97 : Number(c);
      pixels.push({ x: col - (shape.root ?? 0) + bendOffset(pose, r, h), y: r, color: ramp[Math.max(0, step - darker)] });
    });
  });
  return pixels;
}

/** Picks a shape index of `kind`, by weight, from a random number in 0..1. */
export function pickShape(kind: BladeKind, r: number) {
  const pool = SHAPES.map((s, i) => [s, i] as const).filter(([s]) => s.kind === kind);
  let left = r * pool.reduce((sum, [s]) => sum + (s.weight ?? 1), 0);
  for (const [s, i] of pool) if ((left -= s.weight ?? 1) < 0) return i;
  return pool[pool.length - 1][1];
}
