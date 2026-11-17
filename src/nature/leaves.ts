import * as Phaser from 'phaser';
import { DEPTH } from '../world/constants';
import { FADE, LIE, type Leaf, leafDrawn, shedRate, stepLeaf, swing } from './leafFall';
import type { LeafSource } from './trees';
import type { WindParams } from './weather';
import { wind } from './wind';

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

interface Falling { leaf: Leaf; sprite: Phaser.GameObjects.Image }

export class FallingLeaves {
  private live: Falling[] = [];
  private spare: Phaser.GameObjects.Image[] = [];
  private due: number[]; // leaves owed per source, carried between frames

  constructor(private scene: Phaser.Scene, private sources: LeafSource[]) {
    makeLeafTexture(scene);
    this.due = sources.map(() => Math.random()); // so trees don't all drop their first leaf together
  }

  get count() {
    return this.live.length;
  }

  private drop(src: LeafSource, t: number) {
    if (this.live.length >= MAX_LEAVES || !src.spots.length) return;
    const spot = src.spots[Math.floor(Math.random() * src.spots.length)];
    const sx = src.left + spot.x, sy = src.top + spot.y;
    const ground = Math.max(sy + 8, src.baseY - 18 + Math.random() * 28); // lands somewhere under the canopy
    const leaf: Leaf = { x: sx, y: ground, z: ground - sy, phase: Math.random() * Math.PI * 2, age: 0 };
    leaf.x -= leafDrawn({ ...leaf, x: 0, y: 0 }, t).x; // start the swing exactly at the spot it left
    const sprite = (this.spare.pop() ?? this.scene.add.image(0, 0, KEY, 'flat')).setVisible(true).setAlpha(1);
    sprite.setTint(spot.color);
    this.live.push({ leaf, sprite });
  }

  update(t: number, dt: number, weather: WindParams) {
    this.sources.forEach((src, i) => {
      const w = wind(src.left + 80, src.top + 40, t, weather);
      this.due[i] += shedRate(src.shed, w) * dt;
      while (this.due[i] >= 1) this.due[i]--, this.drop(src, t);
    });
    this.live = this.live.filter(({ leaf, sprite }) => {
      if (!stepLeaf(leaf, t, dt, weather)) {
        this.spare.push(sprite.setVisible(false));
        return false;
      }
      const { x, y } = leafDrawn(leaf, t);
      const s = swing(leaf, t);
      sprite.setPosition(x, y).setDepth(DEPTH.actors + leaf.y);
      sprite.setFrame(leaf.z <= 0 || Math.abs(s) < 0.6 ? 'flat' : s > 0 ? 'right' : 'left');
      if (leaf.z <= 0) sprite.setAlpha(Math.min(1, (LIE + FADE - leaf.age) / FADE));
      return true;
    });
  }
}
