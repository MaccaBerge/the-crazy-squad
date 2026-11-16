// Christian: sprinter turned speedster hero. Hand-typed pixel art, one char per pixel.
// Run `npm run art` to rebuild public/assets/sprites/christian.png + christian.anims.json.
// From the photos: dark messy hair with spiky tips and a straight fringe, thick brows, light tan skin, stubble.
// Suit (original design): blue with a gold speed streak and belt, dark domino mask, white sprint shoes, orange scarf.

export const palette = {
  o: 0x1a1420, // outline
  h: 0x1f1a19, H: 0x3d3330, // hair
  s: 0xdcab86, S: 0xb88264, t: 0xc4977a, // skin, shade, stubble
  b: 0x1f1a19, w: 0xf4f4f4, g: 0xb9c2cf, // brows/pupils, white, grey
  m: 0x1b2340, // mask
  u: 0x2f6fd6, U: 0x1f4a9c, l: 0x6aaef0, // suit
  y: 0xf2c53d, r: 0xf08a2c, // gold, scarf
};

const headDown = [
  '........................',
  '........................',
  '.........o..o.o.........',
  '........ohoohoho........',
  '.......ohhhhhhhho.......',
  '......ohhHhhhhHhho......',
  '......ohhhhhhhhhho......',
  '......ohhhhhhhhhho......',
  '......osbbssssbbso......',
  '......ommmmmmmmmmo......',
  '......omwbmmmmbwmo......',
  '......osssssSsssso......',
  '.......otssssssto.......',
  '........ottsstto........',
];
const bodyDown = [
  '......oUuuurruuuUo......',
  '.....oUuyyuuuuuuuUo.....',
  '....oUouuuyyuuuuuoUo....',
  '....oUouuuuuyyuuuoUo....',
  '....oSoyyyyyyyyyyoSo....',
  '......ouuuuuuuuuuo......',
];
const headUp = [
  '........................',
  '........................',
  '.........o..o.o.........',
  '........ohoohoho........',
  '.......ohhhhhhhho.......',
  '......ohhHhhhhHhho......',
  '......ohhhhhhhhhho......',
  '......ohhhhhhhhhho......',
  '......ohhhhhhhhhho......',
  '......ohhhhhhhhhho......',
  '......ohHhhhhhhHho......',
  '......oshhhhhhhhso......',
  '.......osshhhhsso.......',
  '........osssssso........',
];
const bodyUp = [
  '......oUuurrrruuUo......',
  '.....oUuuurrruuuuUo.....',
  '....oUouuuurruuuuoUo....',
  '....oUouuuuurruuuoUo....',
  '....oSoyyyyyyyyyyoSo....',
  '......ouuuuuuuuuuo......',
];
const headSide = [
  '........................',
  '........................',
  '.........o.o.o..........',
  '........ohohoho.........',
  '.......ohhhhhhho........',
  '......ohhhHhhhhho.......',
  '......ohhhhhhhhhho......',
  '......ohhhhhhhhhho......',
  '......ohhhhhhsbbso......',
  '......ohhhhmmmmmmo......',
  '......ohhhsmmmwbmo......',
  '......ohhssssssSso......',
  '.......ohssssssto.......',
  '........ostttsso........',
];
const scarfSide = [
  [ // hanging (idle)
    '.......roUurruuUo.......',
    '.......roUuuuuuuUo......',
    '........oUuuUUuuUo......',
  ],
  [ // trailing, flap 1
    '.....rr.oUurruuUo.......',
    '...rrrr.oUuuuuuuUo......',
    '..rr....oUuuUUuuUo......',
  ],
  [ // trailing, flap 2
    '....rrr.oUurruuUo.......',
    '..rrr...oUuuuuuuUo......',
    '........oUuuUUuuUo......',
  ],
];
const bodySide = [
  '........oUuuUUuuUo......',
  '........oyyySSyyyo......',
  '........ouuuuuuuuo......',
];

// Legs: rows 20–23. Front/back views share them; one foot lifts on a step.
const legsFront = {
  stand: ['......ouuUo..oUuuo......', '......ouuUo..oUuuo......', '......owwgo..ogwwo......', '......ooooo..ooooo......'],
  stepL: ['......ouuUo..oUuuo......', '......ouuUo..ogwwo......', '......owwgo..ooooo......', '......ooooo.............'],
  stepR: ['......ouuUo..oUuuo......', '......owwgo..oUuuo......', '......ooooo..ogwwo......', '.............ooooo......'],
};
const legsSide = {
  stand: ['.........ouuuuuuo.......', '.........ouuuuuuo.......', '.........owwwwwwgo......', '.........ooooooooo......'],
  stride: ['........ouuuo.ouuuo.....', '.......ouuuo...ouuuo....', '......owwgo.....owwwgo..', '......oooo......oooooo..'],
};

/** Moves rows from..to down by one pixel (a 1 px bob), dropping the row they land on. */
const bob = (rows, from, to) => rows.map((r, y) => (y === from ? '.'.repeat(r.length) : y > from && y <= to + 1 ? rows[y - 1] : r));

const down = (legs) => [...headDown, ...bodyDown, ...legs];
const up = (legs) => [...headUp, ...bodyUp, ...legs];
const side = (scarf, legs) => [...headSide, ...scarf, ...bodySide, ...legs];

// Columns: idle ×2, walk ×4. Rows: down, up, side (left = side flipped in game).
export const frames = [
  down(legsFront.stand), bob(down(legsFront.stand), 2, 18),
  bob(down(legsFront.stepL), 2, 18), down(legsFront.stand), bob(down(legsFront.stepR), 2, 18), down(legsFront.stand),
  up(legsFront.stand), bob(up(legsFront.stand), 2, 18),
  bob(up(legsFront.stepR), 2, 18), up(legsFront.stand), bob(up(legsFront.stepL), 2, 18), up(legsFront.stand),
  side(scarfSide[0], legsSide.stand), bob(side(scarfSide[0], legsSide.stand), 2, 18),
  bob(side(scarfSide[1], legsSide.stride), 2, 18), side(scarfSide[2], legsSide.stand), bob(side(scarfSide[1], legsSide.stride), 2, 18), side(scarfSide[2], legsSide.stand),
];

export const anims = {};
['down', 'up', 'side'].forEach((dir, row) => {
  anims[`idle-${dir}`] = { frames: [row * 6, row * 6 + 1], frameRate: 2.2 };
  anims[`walk-${dir}`] = { frames: [2, 3, 4, 5].map((c) => row * 6 + c), frameRate: 8 };
});
