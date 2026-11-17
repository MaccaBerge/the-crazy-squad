import type { Action } from './actions';

/** What a character wants to do this simulation step. Produced by a controller (keyboard, AI, later network). */
export type Intent = {
  move: { x: number; y: number }; // length 0..√2 from keys; movement caps it at 1
  sprint: boolean; // sprint held (players blueprint §4)
  pressed: ReadonlySet<Action>; // pressed recently and not yet used (buffered)
};
