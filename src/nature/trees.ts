import * as Phaser from 'phaser';
import type { MapObject } from '../world/spawner';
import { DEPTH } from '../world/constants';
import { isTreeName, MAX_SWAY_POSE, swayOffset, TREE_TYPES, type TreeName } from './treeTypes';
import type { WindParams } from './weather';
import { wind } from './wind';

// Trees (nature blueprint §5): one sprite each, depth-sorted like actors, a static hitbox at the trunk, swaying by
// shifting pixel rows (DaFluffyPotato's trick) and fading while the player is behind the canopy.

const FADED = 0.45; // canopy alpha while the player is behind it
const FADE_SPEED = 8; // per second

/** Queue every tree image. Call from preload(). */
export function preloadTrees(scene: Phaser.Scene) {
  for (const name of Object.keys(TREE_TYPES)) scene.load.image(`tree:${name}`, `assets/trees/${name}.png`);
}

/** Draws each tree type's sway poses side by side into one canvas texture, frames `-3`..`3`. */
function makeSwayTexture(scene: Phaser.Scene, name: TreeName) {
  const key = `tree-sway:${name}`;
  if (scene.textures.exists(key)) return key;
  const img = scene.textures.get(`tree:${name}`).getSourceImage() as HTMLImageElement;
  const poses = MAX_SWAY_POSE * 2 + 1;
  const tex = scene.textures.createCanvas(key, img.width * poses, img.height)!;
  const ctx = tex.getContext();
  for (let i = 0; i < poses; i++) {
    const pose = i - MAX_SWAY_POSE;
    for (let y = 0; y < img.height; y++)
      ctx.drawImage(img, 0, y, img.width, 1, i * img.width + swayOffset(TREE_TYPES[name], pose, y), y, img.width, 1);
    tex.add(String(pose), 0, i * img.width, 0, img.width, img.height);
  }
  tex.refresh();
  return key;
}

interface Tree { sprite: Phaser.GameObjects.Sprite; pose: number; flex: number }

export class Trees {
  readonly bodies: Phaser.Physics.Arcade.StaticBody[] = [];
  private trees: Tree[] = [];

  /** One tree per point on the map's `Trees` layer; the point is where the trunk meets the ground. */
  constructor(scene: Phaser.Scene, objects: MapObject[]) {
    for (const o of objects) {
      if (!isTreeName(o.type)) continue; // the map test rejects unknown types
      const t = TREE_TYPES[o.type];
      const x = Math.round(o.x ?? 0), y = Math.round(o.y ?? 0);
      const key = makeSwayTexture(scene, o.type);
      const sprite = scene.add.sprite(x, y, key, '0').setDepth(DEPTH.actors + y);
      sprite.setOrigin(t.base.x / sprite.width, t.base.y / sprite.height);
      this.bodies.push(scene.physics.add.staticBody(x - t.block.w / 2, y - t.block.h, t.block.w, t.block.h));
      this.trees.push({ sprite, pose: 0, flex: 0.8 + ((o.id * 7919) % 100) / 250 }); // trees differ a little in stiffness
    }
  }

  /** Whether the tree has an opaque pixel at world point (x, y). */
  private covers(s: Phaser.GameObjects.Sprite, x: number, y: number) {
    const lx = Math.floor(x - (s.x - s.displayOriginX)), ly = Math.floor(y - (s.y - s.displayOriginY));
    if (lx < 0 || ly < 0 || lx >= s.width || ly >= s.height) return false;
    return s.scene.textures.getPixelAlpha(lx, ly, s.texture.key, s.frame.name) > 0;
  }

  /** Sways every tree with the wind and fades canopies the focus (the player's feet) is behind. */
  update(t: number, dt: number, weather: WindParams, focus: { x: number; y: number }) {
    const side = Math.cos((weather.windDir * Math.PI) / 180);
    for (const tree of this.trees) {
      const s = tree.sprite;
      const w = wind(s.x, s.y - s.displayHeight / 2, t, weather) * side;
      const pose = Math.max(-MAX_SWAY_POSE, Math.min(MAX_SWAY_POSE, Math.round(w * tree.flex * MAX_SWAY_POSE)));
      if (pose !== tree.pose) s.setFrame(String((tree.pose = pose)));
      const behind = focus.y < s.y && (this.covers(s, focus.x, focus.y - 6) || this.covers(s, focus.x, focus.y - 18));
      s.alpha += ((behind ? FADED : 1) - s.alpha) * Math.min(1, dt * FADE_SPEED);
    }
  }
}
