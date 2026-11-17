import { TILE } from '../world/constants';

export type Rect = { x: number; y: number; w: number; h: number };
type Vec = { x: number; y: number };
type Blocked = { left: boolean; right: boolean; up: boolean; down: boolean };
export type SolidAt = (tileX: number, tileY: number) => boolean;

/** True if the rectangle touches no solid tile. */
export function rectFree(r: Rect, solid: SolidAt) {
  const eps = 0.001; // a rect ending exactly on a tile edge doesn't touch that tile
  for (let ty = Math.floor(r.y / TILE); ty <= Math.floor((r.y + r.h - eps) / TILE); ty++)
    for (let tx = Math.floor(r.x / TILE); tx <= Math.floor((r.x + r.w - eps) / TILE); tx++) if (solid(tx, ty)) return false;
  return true;
}

/**
 * Corner assist (collision blueprint §5): when walking straight into a wall and only the edge of the body
 * catches a corner, return the sideways direction that slides around it, or null.
 */
export function cornerNudge(body: Rect, input: Vec, blocked: Blocked, solid: SolidAt, maxNudge = 5): Vec | null {
  const horizontal = input.x !== 0 && input.y === 0 && (input.x > 0 ? blocked.right : blocked.left);
  const vertical = input.y !== 0 && input.x === 0 && (input.y > 0 ? blocked.down : blocked.up);
  if (!horizontal && !vertical) return null;

  const fwd = horizontal ? { x: Math.sign(input.x), y: 0 } : { x: 0, y: Math.sign(input.y) };
  const side = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const shifted = (r: Rect, v: Vec, d: number) => ({ ...r, x: r.x + v.x * d, y: r.y + v.y * d });

  for (let d = 1; d <= maxNudge; d++) {
    const ok = [-1, 1].filter((s) => {
      const moved = shifted(body, side, s * d);
      return rectFree(moved, solid) && rectFree(shifted(moved, fwd, 1), solid);
    });
    if (ok.length === 1) return horizontal ? { x: 0, y: ok[0] } : { x: ok[0], y: 0 };
    if (ok.length === 2) return null; // centred on a narrow obstacle: no obvious way round
  }
  return null;
}
