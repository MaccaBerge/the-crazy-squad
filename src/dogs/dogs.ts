import type * as Phaser from 'phaser';
import { DEPTH } from '../world/constants';

// The dog enemies, for now only standing on the map and turning to face you (no AI, animations or weapons yet).
// Sheets come from `npm run art` (art/dogs.mjs): 8 frames in facing.ts order, right first, clockwise.

export const DOG_KINDS = ['heavy-gunner', 'k9-cop', 'long-shot', 'bruiser', 'mad-bomber'] as const;
export type DogKind = (typeof DOG_KINDS)[number];
export const isDogKind = (k: unknown): k is DogKind => typeof k === 'string' && (DOG_KINDS as readonly string[]).includes(k);

const FRAME = 32;
const BODY = { w: 12, h: 6 }; // feet only, like the squad

export function preloadDogs(scene: Phaser.Scene) {
  for (const kind of DOG_KINDS) scene.load.spritesheet(`dog-${kind}`, `assets/dogs/${kind}.png`, { frameWidth: FRAME, frameHeight: FRAME });
}

/** The sheet frame (0–7) facing from (x, y) towards (tx, ty). */
export const facingFrame = (x: number, y: number, tx: number, ty: number) => (Math.round(Math.atan2(ty - y, tx - x) / (Math.PI / 4)) + 8) % 8;

export class Dogs {
  readonly sprites: Phaser.Physics.Arcade.Image[] = [];

  constructor(private scene: Phaser.Scene) {}

  add(kind: DogKind, x: number, y: number) {
    const s = this.scene.physics.add.staticImage(x, y, `dog-${kind}`, 2).setOrigin(0.5, 1).setDepth(DEPTH.actors + y);
    s.body.setSize(BODY.w, BODY.h).setOffset((FRAME - BODY.w) / 2, FRAME - BODY.h);
    this.sprites.push(s);
  }

  /** Each dog turns to look at (tx, ty). */
  face(tx: number, ty: number) {
    for (const s of this.sprites) s.setFrame(facingFrame(s.x, s.y - 8, tx, ty));
  }
}
