import { expect, test } from 'vitest';
import { stepVelocity, type MoveParams } from './movement';

const p: MoveParams = { maxSpeed: 100, accel: 1000, decel: 500 };
const run = (input: { x: number; y: number }, seconds: number, vel = { x: 0, y: 0 }) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.01) vel = stepVelocity(vel, input, 0.01, p);
  return vel;
};

test('ramps up and caps at max speed', () => {
  expect(run({ x: 1, y: 0 }, 0.05).x).toBeCloseTo(50);
  expect(run({ x: 1, y: 0 }, 1)).toEqual({ x: 100, y: 0 });
});

test('diagonal is not faster than straight', () => {
  const v = run({ x: 1, y: 1 }, 1);
  expect(Math.hypot(v.x, v.y)).toBeCloseTo(100);
});

test('stops with decel and does not overshoot past zero', () => {
  expect(run({ x: 0, y: 0 }, 0.1, { x: 100, y: 0 }).x).toBeCloseTo(50);
  expect(run({ x: 0, y: 0 }, 1, { x: 100, y: 0 })).toEqual({ x: 0, y: 0 });
});

test('reversing uses accel', () => {
  expect(run({ x: -1, y: 0 }, 0.1, { x: 100, y: 0 }).x).toBeCloseTo(0);
});

test('analog input below full length moves slower', () => {
  expect(run({ x: 0.5, y: 0 }, 1)).toEqual({ x: 50, y: 0 });
});
