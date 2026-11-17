import * as Phaser from 'phaser';
import type { MapObject } from '../world/spawner';
import { DEPTH } from '../world/constants';
import { isTreeName, swayOffset, TREE_TYPES, type TreeType } from './treeTypes';
import type { WindParams } from './weather';
import { wind } from './wind';

// Trees (nature blueprint §5): one sprite each, depth-sorted like actors, a static hitbox at the trunk, swaying by
// shifting pixel rows (DaFluffyPotato's trick) and fading while the player is behind the canopy.

const FADED = 0.45; // canopy alpha while the player is behind it
const FADE_SPEED = 8; // per second
const LAG = 0.5; // s the canopy's bottom trails its top, so gusts ripple down the tree

/** Queue every tree image. Call from preload(). */
export function preloadTrees(scene: Phaser.Scene) {
  for (const name of Object.keys(TREE_TYPES)) scene.load.image(`tree:${name}`, `assets/trees/${name}.png`);
}

interface Tree {
  sprite: Phaser.GameObjects.Image;
  tex: Phaser.Textures.CanvasTexture;
  img: HTMLImageElement;
  type: TreeType;
  offsets: Int8Array; // current shift of each pixel row
  flex: number;
}

export class Trees {
  readonly bodies: Phaser.Physics.Arcade.StaticBody[] = [];
  private trees: Tree[] = [];

  /** One tree per point on the map's `Trees` layer; the point is where the trunk meets the ground. */
  constructor(scene: Phaser.Scene, objects: MapObject[]) {
    for (const o of objects) {
      if (!isTreeName(o.type)) continue; // the map test rejects unknown types
      const t = TREE_TYPES[o.type];
      const x = Math.round(o.x ?? 0), y = Math.round(o.y ?? 0);
      const img = scene.textures.get(`tree:${o.type}`).getSourceImage() as HTMLImageElement;
      const tex = scene.textures.createCanvas(`tree-sway:${o.id}`, img.width, img.height)!; // each tree ripples on its own
      tex.getContext().drawImage(img, 0, 0);
      tex.refresh();
      const sprite = scene.add.image(x, y, tex).setDepth(DEPTH.actors + y);
      sprite.setOrigin(t.base.x / img.width, t.base.y / img.height);
      this.bodies.push(scene.physics.add.staticBody(x - t.block.w / 2, y - t.block.h, t.block.w, t.block.h));
      this.trees.push({ sprite, tex, img, type: t, offsets: new Int8Array(t.swayFrom), flex: 0.8 + ((o.id * 7919) % 100) / 250 }); // trees differ a little in stiffness
    }
  }

  /** Whether the tree has an opaque pixel at world point (x, y). */
  private covers(s: Phaser.GameObjects.Image, x: number, y: number) {
    const lx = Math.floor(x - (s.x - s.displayOriginX)), ly = Math.floor(y - (s.y - s.displayOriginY));
    if (lx < 0 || ly < 0 || lx >= s.width || ly >= s.height) return false;
    return s.scene.textures.getPixelAlpha(lx, ly, s.texture.key, s.frame.name) > 0;
  }

  /** Shifts each canopy row by the wind it feels, lagging further down; redraws only when a row moved. */
  private sway(tree: Tree, t: number, weather: WindParams, side: number) {
    const { sprite: s, type, offsets } = tree;
    const top = s.y - s.displayOriginY;
    let changed = false;
    for (let y = 0; y < type.swayFrom; y++) {
      const lag = LAG * (y / type.swayFrom);
      const lean = Math.max(-1, Math.min(1, wind(s.x, top + y, t - lag, weather) * side * tree.flex));
      const off = swayOffset(type, lean, y, t);
      if (off !== offsets[y]) (offsets[y] = off), (changed = true);
    }
    if (!changed) return;
    const ctx = tree.tex.getContext();
    ctx.clearRect(0, 0, tree.img.width, type.swayFrom);
    for (let y = 0; y < type.swayFrom; y++) ctx.drawImage(tree.img, 0, y, tree.img.width, 1, offsets[y], y, tree.img.width, 1);
    tree.tex.refresh();
  }

  /** Sways every tree with the wind and fades canopies the focus (the player's feet) is behind. */
  update(t: number, dt: number, weather: WindParams, focus: { x: number; y: number }) {
    const side = Math.cos((weather.windDir * Math.PI) / 180);
    for (const tree of this.trees) {
      const s = tree.sprite;
      this.sway(tree, t, weather, side);
      const behind = focus.y < s.y && (this.covers(s, focus.x, focus.y - 6) || this.covers(s, focus.x, focus.y - 18));
      s.alpha += ((behind ? FADED : 1) - s.alpha) * Math.min(1, dt * FADE_SPEED);
    }
  }
}
