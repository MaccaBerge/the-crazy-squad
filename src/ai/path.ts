import { rectFree, type SolidAt } from '../collision/cornerAssist';
import { TILE } from '../world/constants';

// Pathfinding on the tile grid (dog AI blueprint §6): A* for a few dogs, smoothed so they don't zigzag cell by cell.

export type Cell = { x: number; y: number };
type Vec = { x: number; y: number };

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/**
 * Cells from `from` to `to` (both included) around solid cells, 8 directions, never cutting a corner.
 * `to` counts as free even if solid, since the target may stand at the edge of one. Null when there's no way there.
 */
export function findPath(solid: SolidAt, from: Cell, to: Cell, limit = 4000): Cell[] | null {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const free = (x: number, y: number) => (x === to.x && y === to.y) || !solid(x, y);
  const h = (c: Cell) => {
    const dx = Math.abs(c.x - to.x), dy = Math.abs(c.y - to.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); // octile distance
  };
  const g = new Map([[key(from), 0]]);
  const came = new Map<string, Cell>();
  const open: Cell[] = [from];
  const done = new Set<string>();

  // shortcut: open list is a plain array scanned for the best cell; fine for one map's worth of tiles, use a heap if many dogs path at once.
  while (open.length && done.size < limit) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (g.get(key(open[i]))! + h(open[i]) < g.get(key(open[best]))! + h(open[best])) best = i;
    const c = open.splice(best, 1)[0], ck = key(c);
    if (c.x === to.x && c.y === to.y) {
      const path = [c];
      for (let p = came.get(ck); p; p = came.get(key(p))) path.unshift(p);
      return path;
    }
    if (done.has(ck)) continue;
    done.add(ck);
    for (const [dx, dy] of STEPS) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (!free(n.x, n.y) || (dx && dy && (!free(c.x + dx, c.y) || !free(c.x, c.y + dy)))) continue;
      const nk = key(n), cost = g.get(ck)! + (dx && dy ? Math.SQRT2 : 1);
      if (done.has(nk) || cost >= (g.get(nk) ?? Infinity)) continue;
      g.set(nk, cost);
      came.set(nk, c);
      open.push(n);
    }
  }
  return null;
}

/** True if a feet box of `body` size (bottom-centre at the point) can slide in a straight line from a to b. */
export function clearLine(solid: SolidAt, a: Vec, b: Vec, body: { w: number; h: number }) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    if (!rectFree({ x: x - body.w / 2, y: y - body.h, w: body.w, h: body.h }, solid)) return false;
  }
  return true;
}

/** Where a feet box stands to sit in the middle of a cell. */
export const cellFeet = (c: Cell, bodyH: number): Vec => ({ x: c.x * TILE + TILE / 2, y: c.y * TILE + (TILE + bodyH) / 2 });

/** Whether a straight line from a to b crosses no solid tile (sight, not movement: a thin ray, sampled every 4 px). */
export function lineOfSight(solid: SolidAt, a: Vec, b: Vec): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 4);
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, y = a.y + ((b.y - a.y) * i) / n;
    if (solid(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

/** Whether the segment a→b passes through the rectangle (slab clipping, so even a 2 px trunk can't slip between samples). */
export function crossesRect(a: Vec, b: Vec, r: { x: number; y: number; width: number; height: number }): boolean {
  let t0 = 0, t1 = 1;
  for (const [d, lo, hi, p] of [[b.x - a.x, r.x, r.x + r.width, a.x], [b.y - a.y, r.y, r.y + r.height, a.y]]) {
    if (d === 0) {
      if (p <= lo || p >= hi) return false;
      continue;
    }
    let u = (lo - p) / d, v = (hi - p) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u), t1 = Math.min(t1, v);
    if (t0 >= t1) return false;
  }
  return true;
}
