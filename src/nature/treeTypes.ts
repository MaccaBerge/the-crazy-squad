// Tree types (nature blueprint §5): PixelLab images in public/assets/trees/<name>.png, plus where each one stands.
// Coordinates are image pixels.

export interface TreeType {
  base: { x: number; y: number }; // where the trunk meets the ground: the tree's position, and its depth like actors' feet
  block: { w: number; h: number }; // trunk hitbox, centred on base.x, its bottom on base.y
  swayFrom: number; // leaf clumps above this row sway; the trunk and the lowest leaves stay put
  sway: number; // px a clump at the top moves at full lean
  shed: number; // leaves per second in a light breeze (more in strong wind); big trees shed more than small ones and bushes. A tree's `shed` property in Tiled overrides it
}

export const TREE_TYPES = {
  'spreading-oak': { base: { x: 77, y: 146 }, block: { w: 24, h: 8 }, swayFrom: 110, sway: 3, shed: 0.8 },
  gnarled: { base: { x: 77, y: 122 }, block: { w: 20, h: 6 }, swayFrom: 92, sway: 2, shed: 0.4 },
} satisfies Record<string, TreeType>;

export type TreeName = keyof typeof TREE_TYPES;
export const isTreeName = (name: unknown): name is TreeName => typeof name === 'string' && name in TREE_TYPES;
