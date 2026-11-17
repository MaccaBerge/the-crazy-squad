// Tree types (nature blueprint §5): PixelLab images in public/assets/trees/<name>.png, plus where each one stands.
// Coordinates are image pixels.

export interface TreeType {
  base: { x: number; y: number }; // where the trunk meets the ground: the tree's position, and its depth like actors' feet
  block: { w: number; h: number }; // trunk hitbox, centred on base.x, its bottom on base.y
  swayFrom: number; // rows above this y sway in the wind, more towards the top; the trunk below stays put
  sway: number; // px the top row moves at full lean
}

export const TREE_TYPES = {
  'spreading-oak': { base: { x: 77, y: 146 }, block: { w: 24, h: 8 }, swayFrom: 110, sway: 2 },
  gnarled: { base: { x: 77, y: 122 }, block: { w: 20, h: 6 }, swayFrom: 92, sway: 2 },
} satisfies Record<string, TreeType>;

export type TreeName = keyof typeof TREE_TYPES;
export const isTreeName = (name: unknown): name is TreeName => typeof name === 'string' && name in TREE_TYPES;

export const MAX_SWAY_POSE = 3; // sway poses are -3..3

/** How far (px) row `y` of a tree shifts in sway pose `pose`: nothing below swayFrom, the full `sway` at the top. */
export const swayOffset = (t: TreeType, pose: number, y: number) =>
  y >= t.swayFrom ? 0 : Math.round((pose / MAX_SWAY_POSE) * t.sway * ((t.swayFrom - y) / t.swayFrom) ** 1.5);
