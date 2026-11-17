import { expect, test } from 'vitest';
import { SQUAD } from '../characters';
import { Party } from './party';
import { defaultStamina } from './stamina';

const fits = () => true;

test('number keys pick a member, Tab cycles both ways and wraps', () => {
  const p = new Party(SQUAD, { swapCooldown: 0, ...defaultStamina });
  expect(p.targetFor('swap3')).toBe(2);
  expect(p.targetFor('swapPrev')).toBe(3);
  expect(p.targetFor('swapNext')).toBe(1);
});

test('a swap starts the cooldown, which blocks swapping until it runs out', () => {
  const p = new Party(SQUAD, { swapCooldown: 4, ...defaultStamina });
  expect(p.trySwap(1, fits)).toBe('ok');
  expect(p.active.id).toBe('kristian');
  p.tick(3.9);
  expect(p.trySwap(2, fits)).toBe('cooldown');
  p.tick(0.1);
  expect(p.trySwap(2, fits)).toBe('ok');
  expect(p.active.id).toBe('christian');
});

test('swapping to yourself or into a spot that does not fit is refused without using the cooldown', () => {
  const p = new Party(SQUAD, { swapCooldown: 4, ...defaultStamina });
  expect(p.trySwap(0, fits)).toBe('same');
  expect(p.trySwap(1, () => false)).toBe('no-room');
  expect(p.cooldownLeft).toBe(0);
  expect(p.active.id).toBe('marcus');
});

test('each member keeps their own stamina, and off-stage members refill', () => {
  const p = new Party(SQUAD, { swapCooldown: 0, ...defaultStamina });
  for (let i = 0; i < 100; i++) p.tick(0.01, true);
  const tired = p.stamina[0].value;
  expect(tired).toBeLessThan(1);
  p.trySwap(1, fits);
  expect(p.stamina[1].value).toBe(1);
  for (let i = 0; i < 300; i++) p.tick(0.01, false);
  expect(p.stamina[0].value).toBeGreaterThan(tired);
});
