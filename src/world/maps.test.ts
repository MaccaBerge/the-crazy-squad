// Checks every map in public/assets/maps against the rules in docs/world-blueprint.md,
// so a map Phaser can't load (or that breaks our conventions) fails CI instead of the game.
import { describe, expect, test } from 'vitest';
import { isTreeName } from '../nature/treeTypes';
import { isWeather } from '../nature/weather';
import { ENTITY_TYPES, MAP_LAYERS, TILE, TILESETS } from './constants';

type TiledLayer = { name: string; type: string; width?: number; height?: number; data?: unknown; encoding?: string; layers?: TiledLayer[]; objects?: { id: number; type?: string; template?: string; ellipse?: boolean; point?: boolean; width?: number; polygon?: unknown[]; properties?: { name: string; value: unknown }[] }[] };
type TiledMap = { orientation: string; infinite: boolean; width: number; height: number; tilewidth: number; tileheight: number; layers: TiledLayer[]; tilesets: Record<string, unknown>[]; properties?: { name: string; value: unknown }[] };

const files = import.meta.glob('/public/assets/maps/*.tmj', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

test('there is at least one map', () => {
  expect(Object.keys(files).length).toBeGreaterThan(0);
});

describe.each(Object.entries(files))('%s', (_path, raw) => {
  const map = JSON.parse(raw) as TiledMap;

  test('is a finite orthogonal map on the 16 px grid', () => {
    expect(map.orientation).toBe('orthogonal');
    expect(map.infinite).toBe(false);
    expect([map.tilewidth, map.tileheight]).toEqual([TILE, TILE]);
  });

  test('tilesets are embedded single images Phaser can load', () => {
    for (const ts of map.tilesets) {
      expect(ts.source, 'tileset must be embedded (Map → Embed Tileset in Tiled)').toBeUndefined();
      expect(ts.image, `tileset "${ts.name}" must be a single image, not a collection of images`).toBeTypeOf('string');
      expect(TILESETS, `tileset "${ts.name}" must be listed in TILESETS in constants.ts`).toContain(ts.name);
      expect([ts.tilewidth, ts.tileheight, ts.margin, ts.spacing]).toEqual([TILE, TILE, 0, 0]);
    }
  });

  test('only uses known layer names', () => {
    for (const layer of map.layers) expect(MAP_LAYERS, `unknown layer "${layer.name}"`).toContain(layer.name);
  });

  test('tile layers are uncompressed and cover the whole map', () => {
    const tileLayers = map.layers.flatMap((l) => (l.type === 'group' ? l.layers ?? [] : [l])).filter((l) => l.type === 'tilelayer');
    for (const l of tileLayers) {
      expect(l.encoding ?? 'csv', `layer "${l.name}" must use CSV encoding`).toBe('csv');
      expect((l.data as number[]).length, `layer "${l.name}" size`).toBe(map.width * map.height);
    }
  });

  test('objects have no unresolved templates', () => {
    const objects = map.layers.flatMap((l) => l.objects ?? []);
    for (const o of objects) expect(o.template, `object ${o.id} still uses a template (detach it in Tiled)`).toBeUndefined();
  });

  test('entities have known classes and there is exactly one PlayerSpawn', () => {
    const objects = map.layers.find((l) => l.name === 'Entities')?.objects ?? [];
    for (const o of objects) expect(ENTITY_TYPES, `object ${o.id} has unknown class "${o.type}"`).toContain(o.type);
    expect(objects.filter((o) => o.type === 'PlayerSpawn').length, 'PlayerSpawn objects').toBe(1);
  });

  test('has a known weather preset', () => {
    const weather = map.properties?.find((p) => p.name === 'weather')?.value;
    expect(isWeather(weather), `map property "weather" is "${weather}"; use one of WEATHER in src/nature/weather.ts`).toBe(true);
  });

  test('grass areas are rectangles or polygons with sensible properties', () => {
    for (const o of map.layers.find((l) => l.name === 'Grass')?.objects ?? []) {
      expect(o.ellipse || o.point, `grass area ${o.id} must be a rectangle or polygon`).toBeFalsy();
      expect(o.polygon || o.width, `grass area ${o.id} is empty`).toBeTruthy();
      const density = o.properties?.find((p) => p.name === 'density')?.value;
      if (density !== undefined) expect(density, `grass area ${o.id} density (blades per tile)`).toSatisfy((d) => typeof d === 'number' && d > 0 && d <= 64);
      const flowers = o.properties?.find((p) => p.name === 'flowers')?.value;
      if (flowers !== undefined) expect(flowers, `grass area ${o.id} flowers (share 0–1)`).toSatisfy((f) => typeof f === 'number' && f >= 0 && f <= 1);
      const kind = o.properties?.find((p) => p.name === 'kind')?.value;
      if (kind !== undefined) expect(['grass', 'reeds'], `grass area ${o.id} kind`).toContain(kind);
    }
  });

  test('trees are points with a known tree type', () => {
    for (const o of map.layers.find((l) => l.name === 'Trees')?.objects ?? []) {
      expect(o.point, `tree ${o.id} must be a point (where the trunk meets the ground)`).toBe(true);
      expect(isTreeName(o.type), `tree ${o.id} has unknown type "${o.type}"; see TREE_TYPES in src/nature/treeTypes.ts`).toBe(true);
    }
  });
});
