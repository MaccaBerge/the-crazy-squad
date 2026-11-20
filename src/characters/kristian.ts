import type { CharacterDef } from './types';

// shortcut: placeholder stats and colours until the characters table in docs/characters-abilities-blueprint.md is filled in
export const kristian: CharacterDef = {
  id: 'kristian',
  name: 'Kristian',
  placeholder: { initial: 'K', color: 0xe0533d },
  sprite: 'kristian',
  body: { w: 12, h: 6 },
  stats: { maxHp: 100, speed: 0.9, accel: 0.85 },
  // Wrench swing: slow, wide, heavy knockback (combat blueprint §3). Radius 24 so he can reach a Bruiser winding up at 22.
  attack: [{ damage: 30, windup: 0.15, active: 0.1, recovery: 0.35, radius: 24, arc: 120, knockback: 200, heavy: true, lunge: 4, shake: true }],
};
