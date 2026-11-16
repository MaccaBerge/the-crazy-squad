import type { CharacterDef } from './types';

// shortcut: placeholder stats and colours until the characters table in docs/characters-abilities-blueprint.md is filled in
export const jonas: CharacterDef = {
  id: 'jonas',
  name: 'Jonas',
  placeholder: { initial: 'J', color: 0x5cc06a },
  body: { w: 8, h: 5 },
  stats: { speed: 1.1, accel: 1 },
};
