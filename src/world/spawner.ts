import type * as Phaser from 'phaser';
import { ENTITY_TYPES, type EntityType } from './constants';

type TiledProperty = { name: string; type: string; value: unknown };
export type MapObject = Phaser.Types.Tilemaps.TiledObject;
export type EntityFactory = (obj: MapObject, props: Record<string, unknown>) => void;

/** Tiled keeps properties as a list; turn it into a plain object. */
export const props = (obj: MapObject) =>
  Object.fromEntries(((obj.properties ?? []) as TiledProperty[]).map((p) => [p.name, p.value]));

/** Calls the factory for each object on the Entities layer, by its Tiled class (world blueprint §8). */
export function spawnEntities(map: Phaser.Tilemaps.Tilemap, factories: Partial<Record<EntityType, EntityFactory>>) {
  for (const obj of map.getObjectLayer('Entities')?.objects ?? []) {
    const type = obj.type as EntityType;
    const factory = ENTITY_TYPES.includes(type) ? factories[type] : undefined;
    if (factory) factory(obj, props(obj));
    else console.warn(`No factory for Tiled object ${obj.id} (class "${obj.type}") at ${obj.x},${obj.y}`);
  }
}
