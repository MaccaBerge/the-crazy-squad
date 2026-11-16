import type { Vec } from '../movement';

export type Dir = 'down' | 'up' | 'left' | 'right';

/**
 * Snaps a move direction to one of 4 sprite directions (art blueprint §2).
 * Exact diagonals and no input keep the previous direction, so the sprite doesn't flicker.
 */
export function snapDir(prev: Dir, move: Vec): Dir {
  const ax = Math.abs(move.x), ay = Math.abs(move.y);
  if (ax === ay) return prev;
  if (ax > ay) return move.x > 0 ? 'right' : 'left';
  return move.y > 0 ? 'down' : 'up';
}

/** Sprite sheets draw down, up and side; left is side flipped. */
export const sheetDir = (d: Dir) => (d === 'left' || d === 'right' ? 'side' : d);
