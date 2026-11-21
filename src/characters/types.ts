import type { AbilityDef } from '../abilities/ability';
import type { Swing } from '../combat/swing';

export type CharacterId = 'marcus' | 'kristian' | 'christian' | 'jonas';

export type CharacterDef = {
  id: CharacterId;
  name: string;
  /** Placeholder look until the real sprite exists (art blueprint §6). */
  placeholder: { initial: 'M' | 'K' | 'C' | 'J'; color: number };
  /** Sprite sheet in public/assets/sprites, built from art/characters/<sprite>.mjs. Without it the placeholder is used. */
  sprite?: string;
  /** Feet hitbox in px (collision blueprint §3). */
  body: { w: number; h: number };
  /** maxHp in points. speed and accel are multipliers on the shared movement tuning, so the T panel still tunes everyone at once. */
  stats: { maxHp: number; speed: number; accel: number };
  /**
   * Basic attack (combat blueprint §3): one swing, or several that chain as a combo when pressed again in time.
   * shortcut: only melee swings so far; the others get theirs in later build steps.
   */
  attack?: Swing[];
  /** Signature ability on E (blueprint §2). */
  ability1?: AbilityDef;
};
