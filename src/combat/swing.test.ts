import { expect, test } from 'vitest';
import { inArc, type Swing, swingPhase } from './swing';

const s: Swing = { damage: 30, windup: 0.1, active: 0.1, recovery: 0.2, radius: 20, arc: 120, knockback: 200 };

test('a swing goes windup → active → recovery → done', () => {
  expect([0, 0.15, 0.25, 0.45].map((t) => swingPhase(s, t))).toEqual(['windup', 'active', 'recovery', 'done']);
});

test('it hits in front within the arc and radius, not behind or too far', () => {
  const right = { x: 1, y: 0 }, o = { x: 0, y: 0 };
  expect(inArc(s, o, right, { x: 15, y: 0 })).toBe(true);
  expect(inArc(s, o, right, { x: 10, y: 15 })).toBe(true); // 56°, inside the 60° half-arc
  expect(inArc(s, o, right, { x: 5, y: 15 })).toBe(false); // 72°
  expect(inArc(s, o, right, { x: -10, y: 0 })).toBe(false);
  expect(inArc(s, o, right, { x: 25, y: 0 })).toBe(false);
});
