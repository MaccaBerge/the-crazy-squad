import { expect, test } from 'vitest';
import { aimPull, pickTarget, toward } from './aim';
import { inArc, type Swing } from './swing';

const o = { x: 0, y: 0 }, right = { x: 1, y: 0 }, help = { cone: 35, range: 30 };

test('aim help picks a dog in the cone and in range, not behind or too far', () => {
  expect(pickTarget(o, right, [{ x: -10, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 5 }], help)).toBe(2);
  expect(pickTarget(o, right, [{ x: 5, y: 20 }], help)).toBe(-1); // 76° off
  expect(pickTarget(o, right, [], help)).toBe(-1);
});

test('a dog straight ahead beats a slightly closer one at the edge of the cone', () => {
  expect(pickTarget(o, right, [{ x: 14, y: 9 }, { x: 18, y: 0 }], help)).toBe(1);
  expect(pickTarget(o, right, [{ x: 25, y: 0 }, { x: 10, y: 1 }], help)).toBe(1); // but a much closer one wins
});

test('toward points at the target; the pull closes a short gap, capped', () => {
  expect(toward(o, { x: 0, y: 5 }, right)).toEqual({ x: 0, y: 1 });
  expect(toward(o, o, right)).toBe(right);
  expect(aimPull(4, 10)).toBe(4);
  expect(aimPull(25, 10)).toBe(10); // capped
  expect(aimPull(-5, 10)).toBe(0); // already in reach
});

test("hits count to the dog's body, not only its middle", () => {
  const punch: Swing = { damage: 10, windup: 0, active: 0.1, recovery: 0, radius: 14, arc: 90, knockback: 0 };
  expect(inArc(punch, o, right, { x: 18, y: 0 })).toBe(false); // the dog's middle is out of reach…
  expect(inArc(punch, o, right, { x: 18, y: 0 }, 6)).toBe(true); // …but its near side isn't
  expect(inArc(punch, o, right, { x: 10, y: 12 }, 6)).toBe(true); // 50° off: the arc reaches its near shoulder
  expect(inArc(punch, o, right, { x: -10, y: 0 }, 6)).toBe(false); // behind
});
