import * as Phaser from 'phaser';
import { DEPTH } from '../world/constants';
import { FADE, LIE, type Leaf, leafDrawn, shedRate, stepLeaf, swing } from './leafFall';
import type { LeafSource } from './trees';
import type { WindParams } from './weather';
import { windAt } from './wind';

// Falling leaves (nature blueprint §5): trees (and later bushes) drop leaves from their canopy at their own `shed`
// rate, more in strong wind. Each leaf takes the colour of the canopy pixel it left, tumbles through three tiny poses
// as it swings down, lies on the ground for a while and fades. A fixed pool keeps the cost flat.

const MAX_LEAVES = 160;
const KEY = 'leaf';
// White so the tint gives each leaf its canopy colour exactly.
const POSES = {
  flat: ['.##.', '####'],
  left: ['##..', '.##.', '..#.'],
  right: ['..##', '.##.', '.#..'],
};

function makeLeafTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return;
  const names = Object.keys(POSES) as (keyof typeof POSES)[];
  const tex = scene.textures.createCanvas(KEY, 4 * names.length, 3)!;
  const ctx = tex.getContext();
  ctx.fillStyle = '#fff';
  names.forEach((name, i) => {
    POSES[name].forEach((row, y) => [...row].forEach((c, x) => c === '#' && ctx.fillRect(i * 4 + x, y, 1, 1)));
    tex.add(name, 0, i * 4, 0, 4, 3);
  });
  tex.refresh();
}

interface Falling { leaf: Leaf; sprite: Phaser.GameObjects.Image; src: number }

const GROUND = DEPTH.Decor + 1; // landed leaves lie under grass and characters

export class FallingLeaves {
  private live: Falling[] = [];
  private spare: Phaser.GameObjects.Image[] = [];
  private due: number[]; // leaves owed per source, carried between frames
  private litter: Phaser.GameObjects.Image[][]; // per source: the carpet of leaves under it, oldest first

  constructor(private scene: Phaser.Scene, private sources: LeafSource[]) {
    makeLeafTexture(scene);
    this.due = sources.map(() => Math.random()); // so trees don't all drop their first leaf together
    this.litter = sources.map((src) => {
      const carpet: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < src.litter && src.spots.length; k++) { // the carpet is already there when the level starts
        const { x, y, color } = this.landing(src);
        carpet.push(this.scene.add.image(Math.round(x + (Math.random() - 0.5) * 16), Math.round(y), KEY, 'flat').setTint(color).setDepth(GROUND));
      }
      return carpet;
    });
  }

  /** A random canopy spot of a source, and where a leaf from it lands. */
  private landing(src: LeafSource) {
    const spot = src.spots[Math.floor(Math.random() * src.spots.length)];
    const sy = src.top + spot.y;
    return { x: src.left + spot.x, sy, y: Math.max(sy + 8, src.baseY - 18 + Math.random() * 28), color: spot.color };
  }

  /** A landed leaf joins its tree's carpet; when the carpet is full its oldest leaf fades instead. */
  private settle(f: Falling) {
    const carpet = this.litter[f.src];
    carpet.push(f.sprite.setFrame('flat').setDepth(GROUND));
    const old = carpet.shift()!;
    this.live.push({ leaf: { x: old.x, y: old.y, z: 0, phase: 0, age: LIE }, sprite: old, src: -1 }); // fades out from here
  }

  get count() {
    return this.live.length;
  }

  private drop(i: number, t: number) {
    const src = this.sources[i];
    if (this.live.length >= MAX_LEAVES || !src.spots.length) return;
    const { x, y, sy, color } = this.landing(src); // lands somewhere under the canopy
    const leaf: Leaf = { x, y, z: y - sy, phase: Math.random() * Math.PI * 2, age: 0 };
    leaf.x -= leafDrawn({ ...leaf, x: 0, y: 0 }, t).x; // start the swing exactly at the spot it left
    const sprite = (this.spare.pop() ?? this.scene.add.image(0, 0, KEY, 'flat')).setVisible(true).setAlpha(1);
    sprite.setTint(color);
    this.live.push({ leaf, sprite, src: i });
  }

  update(t: number, dt: number, weather: WindParams) {
    this.sources.forEach((src, i) => {
      const v = windAt(src.left + 80, src.top + 40, t, weather);
      this.due[i] += shedRate(src.shed, Math.hypot(v.x, v.y)) * dt;
      while (this.due[i] >= 1) this.due[i]--, this.drop(i, t);
    });
    this.live = this.live.filter((f) => {
      const { leaf, sprite } = f;
      if (!stepLeaf(leaf, t, dt, weather)) {
        this.spare.push(sprite.setVisible(false));
        return false;
      }
      if (leaf.z <= 0 && leaf.age === 0 && f.src >= 0 && this.litter[f.src].length) {
        sprite.setPosition(leafDrawn(leaf, t).x, leafDrawn(leaf, t).y);
        this.settle(f);
        return false;
      }
      const { x, y } = leafDrawn(leaf, t);
      const s = swing(leaf, t);
      sprite.setPosition(x, y).setDepth(leaf.z > 0 ? DEPTH.actors + leaf.y : GROUND);
      sprite.setFrame(leaf.z <= 0 || Math.abs(s) < 0.6 ? 'flat' : s > 0 ? 'right' : 'left');
      if (leaf.z <= 0) sprite.setAlpha(Math.min(1, (LIE + FADE - leaf.age) / FADE));
      return true;
    });
  }
}
