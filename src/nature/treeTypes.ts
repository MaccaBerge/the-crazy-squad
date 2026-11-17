// Tree types (nature blueprint §5): PixelLab images in public/assets/trees/<name>.png, plus where each one stands.
// Coordinates are image pixels.

export interface TreeType {
  base: { x: number; y: number }; // where the trunk meets the ground: the tree's position, and its depth like actors' feet
  block: { w: number; h: number }; // trunk hitbox, centred on base.x, its bottom on base.y
  swayFrom: number; // rows above this y sway in the wind, more towards the top; the trunk below stays put
  sway: number; // px the top row moves at full lean
}

export const TREE_TYPES = {
  'spreading-oak': { base: { x: 77, y: 146 }, block: { w: 24, h: 8 }, swayFrom: 110, sway: 6 },
  gnarled: { base: { x: 77, y: 122 }, block: { w: 20, h: 6 }, swayFrom: 92, sway: 4 },
} satisfies Record<string, TreeType>;

export type TreeName = keyof typeof TREE_TYPES;
export const isTreeName = (name: unknown): name is TreeName => typeof name === 'string' && name in TREE_TYPES;

const FLUTTER = 0.6; // px of leaf flutter at the top, rippling up the canopy even in still air

/** How far (px) row `y` shifts when it feels wind `lean` (-1..1) at time `time`: nothing below swayFrom, about `sway` at the top. */
export const swayOffset = (t: TreeType, lean: number, y: number, time: number) => {
  if (y >= t.swayFrom) return 0;
  const h = ((t.swayFrom - y) / t.swayFrom) ** 1.2;
  return Math.round(h * (lean * t.sway + FLUTTER * Math.sin(time * 3 + y * 0.2)));
};
