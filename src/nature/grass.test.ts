import { expect, test } from 'vitest';
import { bendOffset, CELL, drawShape, pickShape, SHAPES } from './bladeShapes';
import { AURA, bladesFromMap, MAX_POSE, poseFor, pushFor, scatter, springStep } from './grass';

test('the same seed scatters the same grass, inside the area, back to front', () => {
  const area = { x: 16, y: 32, w: 100, h: 50 };
  const a = scatter(area, 500, 7);
  expect(a).toEqual(scatter(area, 500, 7));
  expect(a).not.toEqual(scatter(area, 500, 8));
  expect(a).toHaveLength(500);
  for (const b of a) {
    expect(b.x).toBeGreaterThanOrEqual(16);
    expect(b.x).toBeLessThan(116);
    expect(b.y).toBeGreaterThanOrEqual(32);
    expect(b.y).toBeLessThan(82);
  }
  expect(a.every((b, i) => i === 0 || a[i - 1].y <= b.y)).toBe(true);
});

test('poses stay within range and follow the wind', () => {
  expect(poseFor(0, 1, 0)).toBe(0);
  expect(poseFor(0, 1, 1)).toBe(MAX_POSE);
  expect(poseFor(0.5, 1.2, -1)).toBe(-MAX_POSE);
  expect(poseFor(0, 1, 0.4)).toBeGreaterThan(0);
});

test('a bent blade keeps its root in place and moves its tip most', () => {
  expect(bendOffset(MAX_POSE, 0, 10)).toBe(0);
  expect(bendOffset(MAX_POSE, 9, 10)).toBe(4);
  expect(bendOffset(-MAX_POSE, 9, 10)).toBe(-4);
});

test('a force pushes blades away from its centre and flattens them under it', () => {
  const f = { rx: 10, ry: 5 };
  expect(pushFor(6, 0, f)).toBeGreaterThan(0);
  expect(pushFor(-6, 0, f)).toBeLessThan(0);
  expect(pushFor(9, 0, f)).toBeLessThan(pushFor(5, 0, f));
  expect(Math.abs(pushFor(1, 1, f))).toBe(MAX_POSE + 1);
  // Just outside the body, blades still bend a little; further out, not at all.
  expect(pushFor(14, 0, f)).toBeGreaterThan(0.4);
  expect(pushFor(14, 0, f)).toBeLessThan(pushFor(9, 0, f));
  expect(pushFor(-14, 0, f)).toBeLessThan(0);
  expect(pushFor(10 * AURA, 0, f)).toBe(0);
  expect(pushFor(0, 5 * AURA + 1, f)).toBe(0);
  // Under the feet, the push beats even a full wind the other way.
  expect(poseFor(0, 1.2, -1, pushFor(1, 0, f))).toBeGreaterThanOrEqual(0);
});

test('a pushed blade gives way fast and springs back to rest', () => {
  const dt = 1 / 60;
  let [p, v] = [0, 0];
  for (let i = 0; i < 6; i++) [p, v] = springStep(p, v, 3, dt);
  expect(p).toBeGreaterThan(2);
  let low = p;
  for (let i = 0; i < 60; i++) {
    [p, v] = springStep(p, v, 0, dt);
    low = Math.min(low, p);
  }
  expect(Math.abs(p)).toBeLessThan(0.05);
  expect(low).toBeLessThan(0); // a little overshoot past straight
  expect(low).toBeGreaterThan(-1); // but less than one pose
});

test('grass areas from a map fill rectangles and polygons at their density', () => {
  const rect = { id: 1, x: 0, y: 0, width: 160, height: 160, properties: [{ name: 'density', type: 'float', value: 4 }] };
  // A right triangle with half the area of its 160×160 box.
  const tri = { id: 2, x: 320, y: 0, polygon: [{ x: 0, y: 0 }, { x: 160, y: 0 }, { x: 0, y: 160 }] };
  const blades = bladesFromMap([rect, tri] as never);
  const inRect = blades.filter((b) => b.x < 160);
  const inTri = blades.filter((b) => b.x >= 320);
  expect(inRect).toHaveLength(400); // 100 tiles × 4
  expect(inTri.length).toBeGreaterThan(250); // about 50 tiles × 6
  expect(inTri.length).toBeLessThan(350);
  expect(inTri.every((b) => b.x - 320 + b.y <= 160)).toBe(true);
  expect(blades.every((b, i) => i === 0 || blades[i - 1].y <= b.y)).toBe(true);
});

test.each(SHAPES.map((s) => [s.name, s] as const))('%s fits its cell and stays connected in every pose', (_name, shape) => {
  for (let pose = -MAX_POSE; pose <= MAX_POSE; pose++) {
    const px = drawShape(shape, pose);
    for (const p of px) {
      expect(p.x + CELL.w / 2).toBeGreaterThanOrEqual(0);
      expect(p.x + CELL.w / 2).toBeLessThan(CELL.w);
      expect(p.y).toBeLessThan(CELL.h - 1);
    }
    // Every pixel above the root row touches one in the row below (diagonals count), so bending never breaks a blade.
    for (const p of px.filter((p) => p.y > 0))
      expect(px.some((q) => q.y === p.y - 1 && Math.abs(q.x - p.x) <= 1) || px.some((q) => q.y === p.y && Math.abs(q.x - p.x) === 1)).toBe(true);
  }
});

test('shapes are picked by kind and weight', () => {
  for (const kind of ['grass', 'flower', 'reed'] as const)
    for (let r = 0; r < 1; r += 0.05) expect(SHAPES[pickShape(kind, r)].kind).toBe(kind);
  const counts = new Map<number, number>();
  for (let r = 0; r < 1; r += 0.001) counts.set(pickShape('grass', r), (counts.get(pickShape('grass', r)) ?? 0) + 1);
  const short = SHAPES.findIndex((s) => s.name === 'fern short'), teal = SHAPES.findIndex((s) => s.name === 'teal tall');
  expect(counts.get(short)!).toBeGreaterThan(counts.get(teal)! * 3);
});

test('areas mix in flowers, and reed areas are mostly reeds', () => {
  const area = { x: 0, y: 0, w: 160, h: 160 };
  const kinds = (b: { type: number }[]) => b.map((x) => SHAPES[x.type].kind);
  const grass = kinds(scatter(area, 2000, 1, undefined, { flowers: 0.1 }));
  expect(grass.filter((k) => k === 'flower').length).toBeGreaterThan(140);
  expect(grass.filter((k) => k === 'flower').length).toBeLessThan(260);
  expect(grass).not.toContain('reed');
  const reeds = kinds(scatter(area, 2000, 1, undefined, { reeds: true }));
  expect(reeds.filter((k) => k === 'reed').length).toBeGreaterThan(1300);
  expect(reeds).not.toContain('flower');
});
