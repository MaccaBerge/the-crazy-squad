import type { Dir } from '../art/facing';
import type { BrainDef } from '../ai/dogBrain';
import type { DogKind } from './dogs';

/** A dog that thinks (dog AI blueprint §7). Speeds are multipliers on the squad's walk tuning, like the squad's stats. */
export type Breed = {
  speed: number;
  accel: number;
  brain: BrainDef;
  /** The one simple attack for step 1: a short lunge with a hit circle in front of the dog. */
  lunge: { speed: number; reach: number; radius: number; knockback: number; damage: number };
};

// Starting numbers (blueprint §7.1), to tune in play. Only the Bruiser thinks so far; the others still just stand.
export const BREEDS: Partial<Record<DogKind, Breed>> = {
  bruiser: {
    speed: 0.8,
    accel: 0.7,
    brain: { sight: 140, lose: 200, reach: 22, alert: 0.35, windup: 0.5, attack: 0.15, recover: 0.6 },
    lunge: { speed: 140, reach: 14, radius: 10, knockback: 220, damage: 25 },
  },
};

/** PixelLab made 5 directions; the left-facing 3 are the right-facing ones mirrored (blueprint §7.2). */
const ANIM_DIR: Record<Dir, [dir: string, flip: boolean]> = {
  right: ['east', false],
  'down-right': ['south-east', false],
  down: ['south', false],
  'down-left': ['south-east', true],
  left: ['east', true],
  'up-left': ['north-east', true],
  up: ['north', false],
  'up-right': ['north-east', false],
};
export const animDir = (d: Dir) => ({ dir: ANIM_DIR[d][0], flip: ANIM_DIR[d][1] });
