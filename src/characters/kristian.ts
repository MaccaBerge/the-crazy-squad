import type { CharacterDef } from './types';

// shortcut: placeholder stats and colours until the characters table in docs/characters-abilities-blueprint.md is filled in
export const kristian: CharacterDef = {
  id: 'kristian',
  name: 'Kristian',
  placeholder: { initial: 'K', color: 0xe0533d },
  sprite: 'kristian',
  body: { w: 12, h: 6 },
  stats: { speed: 0.9, accel: 0.85 },
};
