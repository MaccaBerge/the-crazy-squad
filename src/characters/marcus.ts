import type { CharacterDef } from './types';

// shortcut: placeholder stats and colours until the characters table in docs/characters-abilities-blueprint.md is filled in
export const marcus: CharacterDef = {
  id: 'marcus',
  name: 'Marcus',
  placeholder: { initial: 'M', color: 0xffcc00 },
  body: { w: 10, h: 6 },
  stats: { speed: 1, accel: 1 },
};
