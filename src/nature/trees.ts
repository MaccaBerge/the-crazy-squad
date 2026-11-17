import * as Phaser from 'phaser';
import { type MapObject, props } from '../world/spawner';
import { DEPTH } from '../world/constants';
import { clumpOffset, findClumps, UNDER, type Clump } from './leafClumps';
import { isTreeName, TREE_TYPES, type TreeType } from './treeTypes';
import type { WindParams } from './weather';
import { windAt } from './wind';

// Trees (nature blueprint §5): one sprite each, depth-sorted like actors, a static hitbox at the trunk, leaf clumps
// swaying as whole pieces (DaFluffyPotato's foliage trick) and fading while the player is behind the canopy.

const FADED = 0.45; // canopy alpha while the player is behind it
const FADE_SPEED = 8; // per second

/** Queue every tree image. Call from preload(). */
export function preloadTrees(scene: Phaser.Scene) {
  for (const name of Object.keys(TREE_TYPES)) scene.load.image(`tree:${name}`, `assets/trees/${name}.png`);
}

/** A tree type's still part (the canopy's uncovered shade in place of every clump) and each clump as its own piece. */
interface Parts {
  base: HTMLCanvasElement;
  clumps: { clump: Clump; piece: HTMLCanvasElement; x: number; y: number }[];
  spots: LeafSpot[]; // every clump pixel: where falling leaves come from, and their colour
}

export interface LeafSpot { x: number; y: number; color: number }

/** Where a tree drops leaves from: its canopy's spots in world px, the ground under it, and how many per second. */
export interface LeafSource { left: number; top: number; baseY: number; spots: LeafSpot[]; shed: number; litter: number }

function cutParts(img: HTMLImageElement, type: TreeType): Parts {
  const canvas = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const base = canvas(img.width, img.height);
  const ctx = base.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const src = Uint8ClampedArray.from(data.data);
  const spots: LeafSpot[] = [];
  const clumps = findClumps(src, img.width, img.height, type.swayFrom).map((clump) => {
    const xs = clump.pixels.map((i) => i % img.width), ys = clump.pixels.map((i) => Math.floor(i / img.width));
    const x = Math.min(...xs), y = Math.min(...ys);
    const piece = canvas(Math.max(...xs) - x + 1, Math.max(...ys) - y + 1);
    const pctx = piece.getContext('2d')!;
    const out = pctx.createImageData(piece.width, piece.height);
    for (const i of clump.pixels) {
      const o = ((Math.floor(i / img.width) - y) * piece.width + (i % img.width) - x) * 4;
      out.data.set(src.subarray(i * 4, i * 4 + 4), o);
      spots.push({ x: i % img.width, y: Math.floor(i / img.width), color: (src[i * 4] << 16) | (src[i * 4 + 1] << 8) | src[i * 4 + 2] });
      data.data.set([...UNDER, 255], i * 4);
    }
    pctx.putImageData(out, 0, 0);
    return { clump, piece, x, y };
  });
  ctx.putImageData(data, 0, 0);
  return { base, clumps, spots };
}

interface Tree {
  sprite: Phaser.GameObjects.Image;
  tex: Phaser.Textures.CanvasTexture;
  parts: Parts;
  type: TreeType;
  offsets: Int8Array; // dx, dy per clump as drawn now
  flex: number;
}

export class Trees {
  readonly bodies: Phaser.Physics.Arcade.StaticBody[] = [];
  readonly sources: LeafSource[] = [];
  private trees: Tree[] = [];
  private parts = new Map<string, Parts>();

  /** One tree per point on the map's `Trees` layer; the point is where the trunk meets the ground. */
  constructor(scene: Phaser.Scene, objects: MapObject[]) {
    for (const o of objects) {
      if (!isTreeName(o.type)) continue; // the map test rejects unknown types
      const t: TreeType = TREE_TYPES[o.type];
      const x = Math.round(o.x ?? 0), y = Math.round(o.y ?? 0);
      const img = scene.textures.get(`tree:${o.type}`).getSourceImage() as HTMLImageElement;
      if (!this.parts.has(o.type)) this.parts.set(o.type, cutParts(img, t));
      const parts = this.parts.get(o.type)!;
      const tex = scene.textures.createCanvas(`tree-sway:${o.id}`, img.width, img.height)!; // each tree rustles on its own
      tex.getContext().drawImage(img, 0, 0);
      tex.refresh();
      const sprite = scene.add.image(x, y, tex).setDepth(DEPTH.actors + y);
      sprite.setOrigin(t.base.x / img.width, t.base.y / img.height);
      const shed = props(o).shed;
      this.sources.push({
        left: x - t.base.x, top: y - t.base.y, baseY: y, spots: parts.spots,
        shed: typeof shed === 'number' ? shed : t.shed,
        litter: t.litter ?? 0,
      });
      this.bodies.push(scene.physics.add.staticBody(x - t.block.w / 2, y - t.block.h, t.block.w, t.block.h));
      this.trees.push({ sprite, tex, parts, type: t, offsets: new Int8Array(parts.clumps.length * 2).fill(99), flex: 0.8 + ((o.id * 7919) % 100) / 250 }); // trees differ a little in stiffness
    }
  }

  /** Whether the tree has an opaque pixel at world point (x, y). */
  private covers(s: Phaser.GameObjects.Image, x: number, y: number) {
    const lx = Math.floor(x - (s.x - s.displayOriginX)), ly = Math.floor(y - (s.y - s.displayOriginY));
    if (lx < 0 || ly < 0 || lx >= s.width || ly >= s.height) return false;
    return s.scene.textures.getPixelAlpha(lx, ly, s.texture.key, s.frame.name) > 0;
  }

  /** Moves each leaf clump with the wind where it sits; redraws only when a clump moved. */
  private sway(tree: Tree, t: number, weather: WindParams) {
    const { sprite: s, type, offsets, parts } = tree;
    const left = s.x - s.displayOriginX, top = s.y - s.displayOriginY;
    let changed = false;
    parts.clumps.forEach(({ clump }, k) => {
      const lean = Math.max(-1, Math.min(1, windAt(left + clump.cx, top + clump.cy, t, weather).x * tree.flex));
      const { dx, dy } = clumpOffset(clump, k, lean, t, type.sway, type.swayFrom);
      if (dx !== offsets[k * 2] || dy !== offsets[k * 2 + 1]) (offsets[k * 2] = dx), (offsets[k * 2 + 1] = dy), (changed = true);
    });
    if (!changed) return;
    const ctx = tree.tex.getContext();
    ctx.clearRect(0, 0, tree.tex.width, tree.tex.height);
    ctx.drawImage(parts.base, 0, 0);
    parts.clumps.forEach(({ piece, x, y }, k) => ctx.drawImage(piece, x + offsets[k * 2], y + offsets[k * 2 + 1]));
    tree.tex.refresh();
  }

  /** Sways every tree with the wind and fades canopies the focus (the player's feet) is behind. */
  update(t: number, dt: number, weather: WindParams, focus: { x: number; y: number }) {
    for (const tree of this.trees) {
      const s = tree.sprite;
      this.sway(tree, t, weather);
      const behind = focus.y < s.y && (this.covers(s, focus.x, focus.y - 6) || this.covers(s, focus.x, focus.y - 18));
      s.alpha += ((behind ? FADED : 1) - s.alpha) * Math.min(1, dt * FADE_SPEED);
    }
  }
}
