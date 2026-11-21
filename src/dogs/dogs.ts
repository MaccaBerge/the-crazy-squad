import type * as Phaser from 'phaser';
import { DEPTH } from '../world/constants';

// The dog enemies that only stand on the map: turning to face you, or looping one animation (the showcase).
// Dogs that think are DogAI (dogAI.ts).
// Sheets come from `npm run art` (art/dogs.mjs): 8 frames in facing.ts order, right first, clockwise.

export const DOG_KINDS = ['heavy-gunner', 'k9-cop', 'long-shot', 'bruiser', 'mad-bomber'] as const;
export type DogKind = (typeof DOG_KINDS)[number];
export const isDogKind = (k: unknown): k is DogKind => typeof k === 'string' && (DOG_KINDS as readonly string[]).includes(k);

const FRAME = 32;
const BODY = { w: 12, h: 6 }; // feet only, like the squad

export function preloadDogs(scene: Phaser.Scene) {
  for (const kind of DOG_KINDS) {
    scene.load.spritesheet(`dog-${kind}`, `assets/dogs/${kind}.png`, { frameWidth: FRAME, frameHeight: FRAME });
    scene.load.json(`dog-${kind}-anims`, `assets/dogs/${kind}.anims.json`);
  }
}

/** A looping animation for a dog to show instead of facing you: its name and PixelLab direction, e.g. walk + east. */
export type Showcase = { anim: string; dir: string };

/** The sheet frame (0–7) facing from (x, y) towards (tx, ty). */
export const facingFrame = (x: number, y: number, tx: number, ty: number) => (Math.round(Math.atan2(ty - y, tx - x) / (Math.PI / 4)) + 8) % 8;

export class Dogs {
  readonly sprites: Phaser.Physics.Arcade.Sprite[] = [];
  private facing: Phaser.Physics.Arcade.Sprite[] = [];

  constructor(private scene: Phaser.Scene) {}

  add(kind: DogKind, x: number, y: number, show?: Showcase) {
    const s = this.scene.physics.add.staticSprite(x, y, `dog-${kind}`, 2).setOrigin(0.5, 1).setDepth(DEPTH.actors + y);
    s.body.setSize(BODY.w, BODY.h).setOffset((FRAME - BODY.w) / 2, FRAME - BODY.h);
    this.sprites.push(s);
    const frames = show && (this.scene.cache.json.get(`dog-${kind}-anims`) as Record<string, number[]>)[`${show.anim}-${show.dir}`];
    if (!show) this.facing.push(s);
    else if (!frames) console.warn(`Dog ${kind}: no animation "${show.anim}-${show.dir}"`);
    else {
      const key = `dog-${kind}/${show.anim}-${show.dir}`;
      if (!this.scene.anims.exists(key)) this.scene.anims.create({ key, frames: this.scene.anims.generateFrameNumbers(`dog-${kind}`, { frames }), frameRate: 8, repeat: -1 });
      s.play(key);
    }
  }

  /** Each dog turns to look at (tx, ty). */
  face(tx: number, ty: number) {
    for (const s of this.facing) s.setFrame(facingFrame(s.x, s.y - 8, tx, ty));
  }
}
