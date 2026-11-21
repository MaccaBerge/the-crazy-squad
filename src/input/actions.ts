// Every action the game reacts to. Gameplay checks actions, never keys (players blueprint §4).
export const ACTIONS = [
  'attack', 'ability1', 'ability2', 'interact',
  'swap1', 'swap2', 'swap3', 'swap4',
  'pause',
] as const;
export type Action = (typeof ACTIONS)[number];
