import type { CharacterDef } from './types';

// shortcut: placeholder stats and colours until the characters table in docs/characters-abilities-blueprint.md is filled in
export const christian: CharacterDef = {
  id: 'christian',
  name: 'Christian',
  placeholder: { initial: 'C', color: 0x4a9be8 },
  sprite: 'christian',
  body: { w: 10, h: 6 },
  stats: { maxHp: 100, speed: 1, accel: 1.1 },
};
