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
    // Short freezes keep the punches snappy; the kick's long one, lunge and shake make the finisher land.
    { damage: 10, windup: 0.05, active: 0.06, recovery: 0.12, radius: 14, arc: 90, knockback: 0, hitstop: 30, lunge: 3, streak: true, anim: 'jab' },
    { damage: 10, windup: 0.05, active: 0.06, recovery: 0.12, radius: 14, arc: 90, knockback: 0, hitstop: 30, lunge: 3, streak: true, anim: 'cross' },
    { damage: 18, windup: 0.05, active: 0.06, recovery: 0.3, radius: 14, arc: 90, knockback: 160, hitstop: 80, lunge: 6, shake: true, anim: 'kick' },
  ],
  // Slow-mo: he runs so fast the world slows down around him. The slowdown itself is tuning.slowmo (T panel).
  ability1: { id: 'slowmo', cooldown: 15, duration: 10, freeSprint: true },
};
