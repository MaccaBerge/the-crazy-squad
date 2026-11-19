// The dog's decision layer (dog AI blueprint §3): a small state machine with no Phaser in it, so it can be unit-tested.
// idle → alert ("!") → chase → windup → attack → recover, and when it loses sight: search the last seen spot → lost ("?") → idle.

export const DOG_STATES = ['idle', 'alert', 'chase', 'windup', 'attack', 'recover', 'stagger', 'search', 'lost'] as const;
export type DogState = (typeof DOG_STATES)[number];

/** States where the dog is after the target and knows where it is: these get a spot in the pack's ring. */
export const HUNTING: ReadonlySet<DogState> = new Set(['alert', 'chase', 'windup', 'attack', 'recover', 'stagger']);

/** How one breed decides. Distances in px between feet, times in seconds. */
export type BrainDef = {
  sight: number; // notices the target within this, if no wall is in the way
  lose: number; // keeps tracking a target it can see within this (more than sight, so it doesn't flicker at the edge)
  reach: number; // starts an attack within this
  alert: number; // "!" pause before chasing: the player's moment to react, and the pack's moment to hear about it
  windup: number; // telegraph before the hit, at least 0.3 s
  attack: number; // the active part, where the hit can land
  recover: number; // standing open to hits afterwards
  stagger: number; // knocked off balance by a hard hit: its attack is cancelled
  search: number; // longest it heads for the last seen spot before giving up (the spot may be unreachable)
  lost: number; // "?" pause when the trail goes cold, before going back to idle
};

export type Brain = { state: DogState; t: number }; // t = seconds in the current state

/**
 * What the dog knows this step. `dist`: distance to the target, or null when there is none. `visible`: no wall between
 * them. `told`: a packmate that can see the target warned it (blueprint §2). `arrived`: it reached the last seen spot.
 */
export type Sense = { dist: number | null; visible: boolean; told: boolean; arrived: boolean };

export const newBrain = (): Brain => ({ state: 'idle', t: 0 });

/**
 * The dog was hit (combat blueprint §6). A hit harder than its poise staggers it, cancelling any windup or attack.
 * Either way a dog that wasn't after you turns on you.
 */
export function hurt(b: Brain, staggered: boolean) {
  const next = staggered ? 'stagger' : HUNTING.has(b.state) && b.state !== 'alert' ? b.state : 'chase';
  if (next !== b.state || staggered) Object.assign(b, { state: next, t: 0 });
}

/** Advances the brain by dt. Returns the state it entered this step, if it changed, so the caller can start effects once. */
export function think(b: Brain, def: BrainDef, sense: Sense, dt: number): DogState | undefined {
  b.t += dt;
  const next = decide(b, def, sense);
  if (next === b.state) return;
  b.state = next;
  b.t = 0;
  return next;
}

function decide({ state, t }: Brain, def: BrainDef, { dist, visible, told, arrived }: Sense): DogState {
  const sees = (visible && dist !== null && dist <= def.sight) || told;
  const tracking = (visible && dist !== null && dist <= def.lose) || told;
  switch (state) {
    case 'idle':
      return sees ? 'alert' : 'idle';
    case 'alert':
      return t >= def.alert ? 'chase' : 'alert';
    case 'chase':
      if (!tracking) return 'search';
      return dist !== null && dist <= def.reach ? 'windup' : 'chase';
    case 'windup': // committed: the telegraph always plays out, so it can be read and dodged
      return t >= def.windup ? 'attack' : 'windup';
    case 'attack':
      return t >= def.attack ? 'recover' : 'attack';
    case 'recover':
      if (t < def.recover) return 'recover';
      return tracking ? 'chase' : 'search';
    case 'stagger':
      if (t < def.stagger) return 'stagger';
      return tracking ? 'chase' : 'search';
    case 'search': // heading for where it last saw you
      if (tracking) return 'chase';
      return arrived || t >= def.search ? 'lost' : 'search';
    case 'lost':
      if (sees) return 'alert';
      return t >= def.lost ? 'idle' : 'lost';
  }
}
