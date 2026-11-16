export type CharacterId = 'marcus' | 'kristian' | 'christian' | 'jonas';

export type CharacterDef = {
  id: CharacterId;
  name: string;
  /** Placeholder look until the real sprite exists (art blueprint §6). */
  placeholder: { initial: 'M' | 'K' | 'C' | 'J'; color: number };
  /** Feet hitbox in px (collision blueprint §3). */
  body: { w: number; h: number };
  /** Multipliers on the shared movement tuning, so the T panel still tunes everyone at once. */
  stats: { speed: number; accel: number };
};
