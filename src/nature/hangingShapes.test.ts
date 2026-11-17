import { expect, test } from 'vitest';
import { type Flag, flagPixels, flagStep, lineClothes, linePixels, MAX_ANGLE, type Pendulum, signPixels, swingStep } from './hangingShapes';

const run = (lean: number, seconds: number, p: Pendulum = { a: 0, v: 0 }) => {
  const seen: number[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) swingStep(p, lean, 1 / 60), seen.push(p.a);
  return { p, seen };
};

test('still air leaves a hanging thing still', () => {
  expect(run(0, 5).p.a).toBe(0);
});

test('a steady wind swings it past its lean and back, then it settles there', () => {
  const { p, seen } = run(0.5, 12);
  const target = 0.5 * MAX_ANGLE;
  expect(Math.max(...seen)).toBeGreaterThan(target * 1.3); // overshoots
  expect(p.a).toBeCloseTo(target, 2);
});

test('when the wind drops it swings back and forth through the middle', () => {
  const { p } = run(1, 6);
  const { seen } = run(0, 3, p);
  expect(Math.min(...seen)).toBeLessThan(-0.05);
});

test('everything stands on the ground: the lowest pixel is the row just above the anchor', () => {
  for (const px of [signPixels(0.4), flagPixels(0.7, 1, 1.3), linePixels(60, [0.2, -0.3, 0.1])])
    expect(Math.max(...px.map((p) => p.y))).toBe(-1);
});

test('a flag streams out on the downwind side of its pole', () => {
  const cloth = (side: number) => flagPixels(1, side, 0).filter((p) => p.x > 1 || p.x < 0);
  expect(cloth(1).every((p) => p.x > 1)).toBe(true);
  expect(cloth(-1).every((p) => p.x < 0)).toBe(true);
  expect(cloth(1).length).toBeGreaterThan(50);
});

test('clothes fit between the posts of any line', () => {
  for (const w of [24, 40, 70, 133]) {
    const pegs = lineClothes(w);
    expect(pegs.length).toBeGreaterThan(0);
    for (const peg of pegs) expect(peg.x).toBeGreaterThan(1);
    const xs = linePixels(w, pegs.map(() => 0)).map((p) => p.x);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(w + 1);
  }
});

test('a dip in the wind makes a flag go limp, never flip', () => {
  const f: Flag = { strength: 0, side: 1 };
  for (let i = 0; i < 300; i++) flagStep(f, 0.6, 1, 1 / 60);
  for (let i = 0; i < 120; i++) flagStep(f, -0.3, 1, 1 / 60); // the wind here briefly pushes back
  expect(f.side).toBe(1);
  expect(f.strength).toBeLessThan(0.1);
});

test('when the weather turns, a flag sags in before it swings over', () => {
  const f: Flag = { strength: 0, side: 1 };
  for (let i = 0; i < 300; i++) flagStep(f, 0.8, 1, 1 / 60);
  let flippedAt = -1;
  for (let i = 0; i < 600; i++) {
    const before = f.strength;
    flagStep(f, -0.8, -1, 1 / 60);
    if (f.side === -1 && flippedAt < 0) (flippedAt = i), expect(before).toBeLessThan(0.1);
  }
  expect(flippedAt).toBeGreaterThan(30); // not instantly: it takes a moment to sag
  expect(f.strength).toBeGreaterThan(0.6); // and then flies out on the new side
});
