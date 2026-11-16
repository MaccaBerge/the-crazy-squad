// Checks every map in public/assets/maps against the rules in docs/world-blueprint.md,
// so a map Phaser can't load (or that breaks our conventions) fails CI instead of the game.
import { describe, expect, test } from 'vitest';
import { MAP_LAYERS, TILE, TILESETS } from './constants';

type TiledLayer = { name: string; type: string; width?: number; height?: number; data?: unknown; encoding?: string; layers?: TiledLayer[]; objects?: { id: number; template?: string }[] };
type TiledMap = { orientation: string; infinite: boolean; width: number; height: number; tilewidth: number; tileheight: number; layers: TiledLayer[]; tilesets: Record<string, unknown>[] };

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
});
