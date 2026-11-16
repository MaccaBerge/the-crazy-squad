// Shared world numbers and names. See docs/world-blueprint.md.

export const TILE = 16;

/** Tile layers in drawing order. Names must match the layer names in Tiled exactly. */
export const TILE_LAYERS = ['Ground', 'Decor', 'Walls', 'Above'] as const;
export type TileLayerName = (typeof TILE_LAYERS)[number];

/** Only these layers can block movement (tiles with the `collides` property). */
export const COLLISION_LAYERS: readonly TileLayerName[] = ['Ground', 'Walls'];

/** Every layer name a map may use. `Roofs` is a group layer, its children are `Roofs/<building>`. */
export const MAP_LAYERS = [...TILE_LAYERS, 'Roofs', 'Entities', 'Zones'] as const;

/** Tiled classes allowed on the Entities layer. Each needs a factory where the level spawns entities. */
export const ENTITY_TYPES = ['PlayerSpawn'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Tileset texture key = tileset name in Tiled = file name in public/assets/tilesets/. */
export const TILESETS = ['placeholder'] as const;

export const DEPTH = {
  Ground: 0,
  Decor: 100,
  Walls: 200,
  actors: 1000, // + feet y, so lower on screen draws in front
  Above: 5000,
  Roofs: 6000,
  effects: 7000,
  ui: 9000,
} as const;
