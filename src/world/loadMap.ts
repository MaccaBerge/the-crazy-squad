import * as Phaser from 'phaser';
import { COLLISION_LAYERS, DEPTH, TILESETS, TILE_LAYERS, type TileLayerName } from './constants';

/** Queue a map and every tileset image for loading. Call from a scene's preload(). */
export function preloadMap(scene: Phaser.Scene, key: string) {
  scene.load.tilemapTiledJSON(key, `assets/maps/${key}.tmj`);
  for (const name of TILESETS) scene.load.image(name, `assets/tilesets/${name}.png`);
}

/** Build the tile layers of a loaded map, set their depths and collision, and size the world to the map. */
export function loadMap(scene: Phaser.Scene, key: string) {
  const map = scene.add.tilemap(key);
  // Texture key = tileset name in Tiled (see TILESETS).
  const tilesets = map.tilesets.map((t) => map.addTilesetImage(t.name, t.name)!);

  const layers: Partial<Record<TileLayerName, Phaser.Tilemaps.TilemapLayer>> = {};
  for (const name of TILE_LAYERS) {
    if (!map.getLayer(name)) continue; // maps may leave out layers they don't need
    const layer = (map.createLayer(name, tilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer).setDepth(DEPTH[name]);
    if (COLLISION_LAYERS.includes(name)) layer.setCollisionByProperty({ collides: true });
    layers[name] = layer;
  }

  scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  const colliders = COLLISION_LAYERS.flatMap((name) => layers[name] ?? []);
  return { map, layers, colliders };
}
