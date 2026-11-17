// Tree and bush types (nature blueprint §5): PixelLab images in public/assets/trees/<name>.png, plus where each one stands.
// Coordinates are image pixels.

export interface TreeType {
  base: { x: number; y: number }; // where the trunk meets the ground: the tree's position, and its depth like actors' feet
  block: { w: number; h: number }; // trunk hitbox, centred on base.x, its bottom on base.y
  swayFrom: number; // leaf clumps above this row sway; the trunk and the lowest leaves stay put
  sway: number; // px a clump at the top moves at full lean
  shed: number; // leaves per second in a light breeze (more in strong wind); big trees shed more than small ones and bushes. A tree's `shed` property in Tiled overrides it
}

const GREEN = {
  'spreading-oak': { base: { x: 77, y: 146 }, block: { w: 24, h: 8 }, swayFrom: 110, sway: 3, shed: 0.8 },
  gnarled: { base: { x: 77, y: 122 }, block: { w: 20, h: 6 }, swayFrom: 92, sway: 2, shed: 0.4 },
  'autumn-maple': { base: { x: 29, y: 70 }, block: { w: 10, h: 5 }, swayFrom: 54, sway: 2, shed: 0.6 },
  'young-oak': { base: { x: 18, y: 43 }, block: { w: 8, h: 4 }, swayFrom: 34, sway: 2, shed: 0.3 },
  'slender-tree': { base: { x: 15, y: 68 }, block: { w: 4, h: 3 }, swayFrom: 45, sway: 2, shed: 0.25 },
  'small-pine': { base: { x: 11, y: 36 }, block: { w: 6, h: 4 }, swayFrom: 33, sway: 1, shed: 0.05 },
  // Bushes: whole thing sways a little, blocks like a trunk, sheds least.
  'round-bush': { base: { x: 14, y: 22 }, block: { w: 16, h: 5 }, swayFrom: 23, sway: 1, shed: 0.08 },
  'berry-bush': { base: { x: 14, y: 25 }, block: { w: 16, h: 5 }, swayFrom: 26, sway: 1, shed: 0.08 },
  'flowering-bush': { base: { x: 15, y: 26 }, block: { w: 18, h: 5 }, swayFrom: 27, sway: 1, shed: 0.1 },
} satisfies Record<string, TreeType>;

/** Autumn recolours (art/trees/autumn.mjs): same shape, so the same trunk, hitbox and sway; autumn trees shed more. */
const autumn = (t: TreeType): TreeType => ({ ...t, shed: t.shed * 1.5 });

export const TREE_TYPES = {
  ...GREEN,
  'autumn-young-oak': autumn(GREEN['young-oak']),
  'autumn-slender-tree': autumn(GREEN['slender-tree']),
  'autumn-round-bush': autumn(GREEN['round-bush']),
  'autumn-berry-bush': autumn(GREEN['berry-bush']),
  'autumn-flowering-bush': autumn(GREEN['flowering-bush']),
};

export type TreeName = keyof typeof TREE_TYPES;
export const isTreeName = (name: unknown): name is TreeName => typeof name === 'string' && name in TREE_TYPES;
