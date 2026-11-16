// Christian: sprinter turned speedster. 32×32 frames, feet at the bottom centre.
// From the photos: dark messy hair with spiky tips and a straight fringe, thick brows, tan skin, stubble.
// Suit (concept F in art/concepts/christian.mjs): red with yellow streak, belt, cuffs and boots, yellow scarf. No mask.
// Frames are built from stamps [y, x, pixels]; '.' inside a stamp leaves what's underneath.
// Run `npm run art` to rebuild public/assets/sprites/christian.png + christian.anims.json.

export const size = 32;
export const columns = 6; // idle ×2, walk ×4

export const palette = {
  o: 0x1a1420, // outline
  h: 0x1f1a19, H: 0x3d3330, b: 0x1f1a19, // hair, highlight, brows/pupils
  s: 0xc68a5f, S: 0xa16a44, t: 0x9c6f4e, // tan skin, shade, stubble
  w: 0xf4f4f4,
  u: 0xd0312d, U: 0x8a1c20, // red suit, shade
  y: 0xf5c542, k: 0xf5c542, K: 0xc9962a, // yellow accents, boots, boot shade
  r: 0xf5c542, // scarf
};

const rows = (ys, x, s) => ys.map((y) => [y, x, s]);
/** The far leg of a pair is drawn darker. */
const far = (stamps) => stamps.map(([y, x, s]) => [y, x, s.replace(/u/g, 'U').replace(/k/g, 'K')]);

// ---------- heads ----------
const hairTop = [
  [2, 12, 'o..o.o.o'],
  [3, 11, 'ohoohohoho'],
  [4, 10, 'ohhhhhhhhhho'],
  [5, 10, 'ohhHhhhhhHho'],
  ...rows([6, 7], 10, 'ohhhhhhhhhho'),
];
const head = {
  down: [
    ...hairTop,
    [8, 10, 'ohssssssssho'],
    [9, 10, 'osbbbssbbbso'],
    [10, 10, 'oswbsssswbso'],
    [11, 10, 'ossssSSsssso'],
    [12, 10, 'otssssssssto'],
    [13, 11, 'ottsssstto'],
    [14, 12, 'otttttto'],
    [15, 14, 'oSSo'],
  ],
  downSide: [
    ...hairTop,
    [8, 10, 'ohhhhsssssso'],
    [9, 10, 'ohhssbbssbbo'],
    [10, 10, 'ohsswbssswbo'],
    [11, 10, 'ohssssssSsso'],
    [12, 10, 'ostsssssssto'],
    [13, 11, 'otttsssto'],
    [14, 12, 'otttttto'],
    [15, 14, 'oSSo'],
  ],
  side: [
    [2, 12, 'o.o.o'],
    [3, 11, 'ohohohoo'],
    [4, 10, 'ohhhhhhhhho'],
    [5, 10, 'ohhhHhhhhhho'],
    ...rows([6, 7], 10, 'ohhhhhhhhhho'),
    [8, 10, 'ohhhhhhhhhso'],
    [9, 10, 'ohhhhhhsbbbo'],
    [10, 10, 'ohhhhssswbso'],
    [11, 10, 'ohhhssssssso'],
    [12, 10, 'ohsssssstso'],
    [13, 11, 'osttttto'],
    [14, 12, 'otttto'],
    [15, 13, 'oSSo'],
  ],
  upSide: [
    ...hairTop,
    ...rows([8, 9, 10], 10, 'ohhhhhhhhhso'),
    ...rows([11, 12], 10, 'ohhhhhhhhsso'),
    [13, 11, 'ohhhhhhsso'],
    [14, 12, 'osssssso'],
    [15, 14, 'oSSo'],
  ],
  up: [
    ...hairTop,
    ...rows([8, 9, 10], 10, 'ohhhhhhhhhho'),
    [11, 10, 'ohhHhhhhHhho'],
    [12, 10, 'oshhhhhhhhso'],
    [13, 11, 'oshhhhhhso'],
    [14, 12, 'osssssso'],
    [15, 14, 'oSSo'],
  ],
};

// ---------- torsos (rows 16–23) ----------
const torsoFront = (nearLeft) => [
  [16, 10, 'oUuuuuuuuuUo'],
  ...rows([17, 18, 19, 20], 9, nearLeft ? 'ouUuuuuuuuUUUo' : 'ouUuuuuuuuuUuo'),
  [21, 9, 'oyUyyyyyyyyUyo'],
  [22, 9, 'oSouuuuuuuuoSo'],
  [23, 11, 'ouuuuuuuuo'],
];
const torso = {
  down: [...torsoFront(false), [17, 12, 'yy'], [18, 14, 'yy'], [19, 16, 'yy'], [20, 18, 'yy']],
  // Turned toward the right: the left arm is the far one, so it is darker.
  downSide: [...torsoFront(false).map(([y, x, s]) => (y >= 17 && y <= 20 ? [y, x, 'oUUuuuuuuuuUuo'] : [y, x, s])),
    [17, 13, 'yy'], [18, 15, 'yy'], [19, 17, 'yy'], [20, 19, 'y']],
  side: [
    [16, 11, 'oUuuuuuUo'],
    ...rows([17, 18, 19, 20], 11, 'ouuuuuuuUo'),
    [21, 11, 'oyyyyyyyyo'],
    ...rows([22, 23], 11, 'ouuuuuuuUo'),
    [17, 18, 'y'], [18, 17, 'y'], [19, 18, 'y'],
  ],
  upSide: torsoFront(false).map(([y, x, s]) => (y >= 17 && y <= 20 ? [y, x, 'ouUuuuuuuuuuUo'] : [y, x, s])),
  up: torsoFront(false).map(([y, x, s]) => (y >= 17 && y <= 20 ? [y, x, 'ouUuuuuuuuuUuo'] : [y, x, s])),
};

// Side arm (the near one) swings with the stride: hand forward, neutral or back.
const sideArm = {
  neutral: [...rows([17, 18, 19], 15, 'UU'), [20, 15, 'yy'], [21, 15, 'UU'], [22, 15, 'SS']],
  forward: [...rows([17, 18], 15, 'UU'), [19, 16, 'UU'], [20, 17, 'yy'], [21, 18, 'SS']],
  back: [...rows([17, 18], 15, 'UU'), [19, 14, 'UU'], [20, 13, 'yy'], [21, 12, 'SS']],
};

// ---------- legs (rows 24–31) ----------
const legL = {
  stand: [...rows([24, 25, 26, 27], 11, 'ouuUo'), ...rows([28, 29], 11, 'okkKo'), [30, 10, 'okkkKo'], [31, 10, 'ooooo']],
  lift: [...rows([24, 25], 11, 'ouuUo'), ...rows([26, 27], 11, 'okkKo'), [28, 10, 'okkkKo'], [29, 10, 'ooooo']],
};
const legR = {
  stand: [...rows([24, 25, 26, 27], 16, 'oUuuo'), ...rows([28, 29], 16, 'oKkko'), [30, 16, 'oKkkko'], [31, 17, 'ooooo']],
  lift: [...rows([24, 25], 16, 'oUuuo'), ...rows([26, 27], 16, 'oKkko'), [28, 16, 'oKkkko'], [29, 17, 'ooooo']],
};
const legsFront = {
  stand: [...legL.stand, ...legR.stand],
  liftL: [...legL.lift, ...legR.stand],
  liftR: [...legL.stand, ...legR.lift],
};
const sideLeg = {
  back: [[24, 10, 'ouuuo'], [25, 10, 'ouuuo'], [26, 9, 'ouuuo'], [27, 9, 'ouuuo'], [28, 8, 'okkko'], [29, 8, 'okkko'], [30, 7, 'okkkKo'], [31, 7, 'oooooo']],
  front: [[24, 16, 'ouuuo'], [25, 17, 'ouuuo'], [26, 17, 'ouuuo'], [27, 18, 'ouuuo'], [28, 18, 'okkko'], [29, 19, 'okkko'], [30, 19, 'okkkkKo'], [31, 19, 'ooooooo']],
  stand: [...rows([24, 25, 26, 27], 13, 'ouuuo'), ...rows([28, 29], 13, 'okkko'), [30, 13, 'okkkkKo'], [31, 13, 'ooooooo']],
  lift: [[24, 13, 'ouuuo'], [25, 14, 'ouuuo'], [26, 14, 'ouuuo'], [27, 14, 'okkko'], [28, 14, 'okkkKo'], [29, 14, 'oooooo']],
};
const legsSide = {
  stand: [...far(sideLeg.stand.map(([y, x, s]) => [y, x - 1, s])), ...sideLeg.stand],
  strideNear: [...far(sideLeg.back), ...sideLeg.front], // near leg forward
  strideFar: [...sideLeg.back, ...far(sideLeg.front)], // far leg forward
  liftNear: [...far(sideLeg.stand), ...sideLeg.lift],
  liftFar: [...sideLeg.stand, ...far(sideLeg.lift)],
};

// ---------- scarf (flap 0 = hanging when idle, 1 and 2 = streaming when running) ----------
const scarf = {
  down: [[[15, 13, 'orrrro']], [[15, 13, 'orrrro']], [[15, 13, 'orrrro']]],
  downSide: [
    [[15, 13, 'orrrro'], [16, 10, 'r'], [17, 10, 'r']],
    [[15, 13, 'orrrro'], [15, 9, 'rrrr'], [16, 6, 'rrr'], [17, 4, 'rr']],
    [[15, 13, 'orrrro'], [15, 9, 'rrrr'], [14, 6, 'rrr'], [14, 4, 'rr']],
  ],
  side: [
    [[15, 12, 'orro'], [16, 10, 'r'], [17, 10, 'r'], [18, 10, 'r']],
    [[15, 12, 'orro'], [15, 7, 'rrrr'], [16, 4, 'rrrr'], [17, 2, 'rrr']],
    [[15, 12, 'orro'], [15, 6, 'rrrrr'], [14, 3, 'rrr'], [13, 1, 'rr']],
  ],
  upSide: [
    [[15, 13, 'orrrro'], [16, 14, 'rr'], [17, 14, 'rr'], [18, 14, 'r']],
    [[15, 13, 'orrrro'], [16, 11, 'rrr'], [17, 8, 'rrr'], [18, 6, 'rr']],
    [[15, 13, 'orrrro'], [16, 11, 'rrr'], [16, 8, 'rrr'], [15, 6, 'rr']],
  ],
  up: [
    [[15, 13, 'orrrro'], ...rows([16, 17, 18], 15, 'rr'), [19, 15, 'r']],
    [[15, 13, 'orrrro'], ...rows([16, 17], 15, 'rr'), [18, 16, 'rr'], [19, 17, 'r']],
    [[15, 13, 'orrrro'], ...rows([16, 17], 15, 'rr'), [18, 14, 'rr'], [19, 13, 'r']],
  ],
};

/** Draws legs, then the upper body shifted down by `bob` px (it overlaps the hips, like a knee bend). */
function frame(upper, legs, bob) {
  const px = Array.from({ length: size }, () => Array(size).fill('.'));
  const stamp = ([y, x, s], dy) => [...s].forEach((c, i) => c !== '.' && y + dy < size && (px[y + dy][x + i] = c));
  legs.forEach((st) => stamp(st, 0));
  upper.forEach((st) => stamp(st, bob));
  return px.map((r) => r.join(''));
}

const upper = (dir, flap, arm) => [...head[dir], ...torso[dir], ...(arm ?? []), ...scarf[dir][flap]];

function direction(dir) {
  if (dir === 'side') {
    return [
      frame(upper('side', 0, sideArm.neutral), legsSide.stand, 0),
      frame(upper('side', 0, sideArm.neutral), legsSide.stand, 1),
      frame(upper('side', 1, sideArm.back), legsSide.strideNear, 1),
      frame(upper('side', 2, sideArm.neutral), legsSide.liftFar, 0),
      frame(upper('side', 1, sideArm.forward), legsSide.strideFar, 1),
      frame(upper('side', 2, sideArm.neutral), legsSide.liftNear, 0),
    ];
  }
  return [
    frame(upper(dir, 0), legsFront.stand, 0),
    frame(upper(dir, 0), legsFront.stand, 1),
    frame(upper(dir, 1), legsFront.liftL, 0),
    frame(upper(dir, 2), legsFront.stand, 1),
    frame(upper(dir, 1), legsFront.liftR, 0),
    frame(upper(dir, 2), legsFront.stand, 1),
  ];
}

// Rows in the sheet. Left-facing directions are these flipped in game.
const DIRS = { down: 'down', 'down-side': 'downSide', side: 'side', 'up-side': 'upSide', up: 'up' };

export const frames = Object.values(DIRS).flatMap(direction);

export const anims = {};
Object.keys(DIRS).forEach((dir, row) => {
  anims[`idle-${dir}`] = { frames: [row * columns, row * columns + 1], frameRate: 2.2 };
  anims[`walk-${dir}`] = { frames: [2, 3, 4, 5].map((c) => row * columns + c), frameRate: 10 };
});
