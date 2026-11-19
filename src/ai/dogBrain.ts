// The dog's decision layer (dog AI blueprint §3): a small state machine with no Phaser in it, so it can be unit-tested.
// Step 1 of the build order: idle → alert → chase → windup → attack → recover. No tokens, hearing, walls or pathing yet.

export const DOG_STATES = ['idle', 'alert', 'chase', 'windup', 'attack', 'recover', 'stagger'] as const;
export type DogState = (typeof DOG_STATES)[number];

/** How one breed decides. Distances in px between feet, times in seconds. */
export type BrainDef = {
  sight: number; // notices the target within this
  lose: number; // gives up the chase beyond this (more than sight, so it doesn't flicker at the edge)
  reach: number; // starts an attack within this
  alert: number; // "!" pause before chasing: the player's moment to react
  windup: number; // telegraph before the hit, at least 0.3 s
  attack: number; // the active part, where the hit can land
  recover: number; // standing open to hits afterwards
  stagger: number; // knocked off balance by a hard hit: its attack is cancelled
};

export type Brain = { state: DogState; t: number }; // t = seconds in the current state

export const newBrain = (): Brain => ({ state: 'idle', t: 0 });

/**
 * The dog was hit (combat blueprint §6). A hit harder than its poise staggers it, cancelling any windup or attack.
 * Either way a sleeping dog wakes up and comes for you.
 */
export function hurt(b: Brain, staggered: boolean) {
  const next = staggered ? 'stagger' : b.state === 'idle' || b.state === 'alert' ? 'chase' : b.state;
  if (next !== b.state || staggered) Object.assign(b, { state: next, t: 0 });
}

/**
 * Advances the brain by dt. `dist` is the distance to the target, or null when there is none.
 * `told`: a packmate that can see the target is close and warned this dog (dog AI blueprint §2), so it joins the
 * hunt even when it can't see the target itself, and doesn't give up while the warning lasts.
 * Returns the state it entered this step, if it changed, so the caller can start effects once.
 */
export function think(b: Brain, def: BrainDef, dist: number | null, dt: number, told = false): DogState | undefined {
  b.t += dt;
  const next = decide(b, def, dist, told);
  if (next === b.state) return;
  b.state = next;
  b.t = 0;
  return next;
}

function decide({ state, t }: Brain, def: BrainDef, dist: number | null, told: boolean): DogState {
  const sees = (dist !== null && dist <= def.sight) || told;
  const lost = (dist === null || dist > def.lose) && !told;
  switch (state) {
    case 'idle':
      return sees ? 'alert' : 'idle';
    case 'alert':
      return t >= def.alert ? 'chase' : 'alert';
    case 'chase':
      if (lost) return 'idle';
      return dist !== null && dist <= def.reach ? 'windup' : 'chase';
    case 'windup': // committed: the telegraph always plays out, so it can be read and dodged
      return t >= def.windup ? 'attack' : 'windup';
    case 'attack':
      return t >= def.attack ? 'recover' : 'attack';
    case 'recover':
      if (t < def.recover) return 'recover';
      return lost ? 'idle' : 'chase';
    case 'stagger':
      if (t < def.stagger) return 'stagger';
      return lost ? 'idle' : 'chase';
  }
}
