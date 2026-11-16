import type { Vec } from '../movement';

export type Dir = 'down' | 'down-right' | 'right' | 'up-right' | 'up' | 'up-left' | 'left' | 'down-left';

// Clockwise from right, matching Math.atan2 with y pointing down.
const DIRS: Dir[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];

/** Snaps a move direction to the nearest of 8 sprite directions (art blueprint §2). No input keeps the previous one. */
export function snapDir(prev: Dir, move: Vec): Dir {
  if (!move.x && !move.y) return prev;
  const octant = Math.round(Math.atan2(move.y, move.x) / (Math.PI / 4));
  return DIRS[(octant + 8) % 8];
}

/** Sheets draw down, down-side, side, up-side and up; the left-facing ones are those flipped. */
export function sheetDir(d: Dir): { row: 'down' | 'down-side' | 'side' | 'up-side' | 'up'; flip: boolean } {
  const flip = d.endsWith('left');
  const row = d === 'down' || d === 'up' ? d : d === 'left' || d === 'right' ? 'side' : d.startsWith('down') ? 'down-side' : 'up-side';
  return { row, flip };
}
