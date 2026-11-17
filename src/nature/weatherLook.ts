import * as Phaser from 'phaser';
import { DEPTH } from '../world/constants';
import { mixLight } from './weather';

// The weather's light (nature blueprint §2): one rectangle over the level that multiplies everything below it by the
// preset's `light` colour. The art stays on the palette; only the view is tinted. The HUD is its own scene, so it stays
// untinted. When the weather turns, the light fades to the new colour instead of snapping.

const FADE = 0.5; // 1/s: two seconds to settle on a new light

export class WeatherLook {
  private shade: Phaser.GameObjects.Rectangle;
  private from: number;
  private to: number;
  private k = 1; // how far the fade from `from` to `to` has come

  constructor(private scene: Phaser.Scene, light: number) {
    this.from = this.to = light;
    this.shade = scene.add.rectangle(0, 0, 1, 1, light).setOrigin(0).setDepth(DEPTH.effects - 1).setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  update(dt: number, light: number) {
    if (light !== this.to) (this.from = mixLight(this.from, this.to, this.k)), (this.to = light), (this.k = 0);
    this.k = Math.min(1, this.k + dt * FADE);
    const color = mixLight(this.from, this.to, this.k);
    const view = this.scene.cameras.main.worldView;
    this.shade.setPosition(view.x - 8, view.y - 8).setSize(view.width + 16, view.height + 16).setFillStyle(color);
    this.shade.setVisible(color !== 0xffffff); // plain daylight needs no pass at all
  }
}
