import type { Dir } from '../art/facing';
import type { BrainDef } from '../ai/dogBrain';
import type { DogKind } from './dogs';

/** A dog that thinks (dog AI blueprint §7). Speeds are multipliers on the squad's walk tuning, like the squad's stats. */
export type Breed = {
  speed: number;
  accel: number;
  brain: BrainDef;
  maxHp: number;
  /** Knockback (px/s) a hit needs to stagger it, cancelling its attack (combat blueprint §6). */
  poise: number;
  /** Share of a hit's knockback it actually feels: heavy dogs barely move. */
  weight: number;
  /** The one simple attack for step 1: a short lunge with a hit circle in front of the dog. */
  lunge: { speed: number; reach: number; radius: number; knockback: number; damage: number };
};

// Starting numbers (blueprint §7.1 speeds, combat blueprint §6 HP), to tune in play.
// shortcut: everyone uses the Bruiser's lunge for now; guns, the shield and bombs come with the dog side of combat (combat blueprint §9, step 8).
const brain = { sight: 140, lose: 200, reach: 22, alert: 0.35, windup: 0.5, attack: 0.15, recover: 0.6, stagger: 0.4 };
const lunge = { speed: 140, reach: 14, radius: 10, knockback: 160, damage: 15 };

export const BREEDS: Record<DogKind, Breed> = {
  bruiser: {
    speed: 0.8,
    accel: 0.7,
    brain,
    maxHp: 160, // about 8 basic hits, 6 wrench swings
    poise: 200, // only heavy hits (Kristian's wrench) stagger it
    weight: 0.6,
    lunge: { ...lunge, knockback: 220, damage: 25 },
  },
  'heavy-gunner': { speed: 0.7, accel: 0.5, brain, maxHp: 120, poise: 200, weight: 0.5, lunge: { ...lunge, damage: 20 } },
  'k9-cop': { speed: 1.0, accel: 1.0, brain, maxHp: 70, poise: 150, weight: 0.9, lunge },
  'long-shot': { speed: 0.8, accel: 0.8, brain, maxHp: 60, poise: 0, weight: 1, lunge },
  'mad-bomber': { speed: 1.15, accel: 1.3, brain: { ...brain, windup: 0.4 }, maxHp: 50, poise: 0, weight: 1.2, lunge: { ...lunge, damage: 10 } },
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
