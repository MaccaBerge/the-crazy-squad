import type * as Phaser from 'phaser';

type Vec = { x: number; y: number };
const BODY_CENTER = 10; // sprites stand on their feet; aim the camera at the middle of the character instead

/** Follows the active character with smoothing, a small deadzone and lookahead (players blueprint §5). */
export class CameraRig {
  private look = { x: 0, y: 0 };

  constructor(
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    private readonly tuning: { cameraLerp: number; lookahead: number },
  ) {
    cam.setDeadzone(16, 12);
  }

  follow(target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject) {
    this.cam.startFollow(target, true, this.tuning.cameraLerp, this.tuning.cameraLerp);
  }

  /** Call every frame with the followed character's velocity and top speed. */
  update(vel: Vec, maxSpeed: number, dt: number) {
    const k = 1 - Math.exp(-4 * dt); // ease the lookahead so turning doesn't snap the view
    this.look.x += ((vel.x / maxSpeed) * this.tuning.lookahead - this.look.x) * k;
    this.look.y += ((vel.y / maxSpeed) * this.tuning.lookahead - this.look.y) * k;
    // Phaser subtracts the follow offset, so a negative offset looks ahead.
    this.cam.setFollowOffset(-this.look.x, BODY_CENTER - this.look.y);
    this.cam.setLerp(this.tuning.cameraLerp, this.tuning.cameraLerp);
  }
}
