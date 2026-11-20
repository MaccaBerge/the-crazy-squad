import type { CharacterDef } from './types';

// shortcut: placeholder stats and colours until the characters table in docs/characters-abilities-blueprint.md is filled in
export const christian: CharacterDef = {
  id: 'christian',
  name: 'Christian',
  placeholder: { initial: 'C', color: 0x4a9be8 },
  sprite: 'christian',
  body: { w: 10, h: 6 },
  stats: { maxHp: 100, speed: 1, accel: 1.1 },
  // Punch, punch, kick: fast and light, only the kick pushes (combat blueprint §3).
  attack: [
    { damage: 10, windup: 0.05, active: 0.06, recovery: 0.12, radius: 14, arc: 90, knockback: 0 },
    { damage: 10, windup: 0.05, active: 0.06, recovery: 0.12, radius: 14, arc: 90, knockback: 0 },
    { damage: 18, windup: 0.05, active: 0.06, recovery: 0.3, radius: 14, arc: 90, knockback: 120 },
  ],
};
