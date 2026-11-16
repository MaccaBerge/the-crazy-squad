import * as Phaser from 'phaser';
import { defaultMove, stepVelocity } from './movement';
import { tuningPanel } from './tuning';
import { DEPTH } from './world/constants';
import { tileCenter } from './world/grid';
import { loadMap, preloadMap } from './world/loadMap';

const MAP = 'test';

const tuning = { ...defaultMove, cameraLerp: 0.15 };

class PlayScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.Body };
  private facingMarker!: Phaser.GameObjects.Image;
  private facing = { x: 0, y: 1 };
  private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('play');
  }

  preload() {
    preloadMap(this, MAP);
  }

  create() {
    const { map, colliders } = loadMap(this, MAP);

    // shortcut: placeholder textures until the character pixel art exists. They must be textures (not shapes or
    // graphics) because Phaser 4 only snaps textured objects to whole pixels; shapes stutter against each other.
    const texture = (key: string, w: number, h: number, color: number) => {
      this.add.graphics().fillStyle(color).fillRect(0, 0, w, h).generateTexture(key, w, h).destroy();
    };
    texture('player', 14, 14, 0xffcc00);
    texture('dot', 4, 4, 0x222222);

    // shortcut: spawn in the map centre until PlayerSpawn objects exist (build order step 2)
    this.player = this.physics.add.image(tileCenter(Math.floor(map.width / 2)), tileCenter(Math.floor(map.height / 2)), 'player') as typeof this.player;
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, colliders);
    this.facingMarker = this.add.image(0, 0, 'dot');

    this.cameras.main.startFollow(this.player, true);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.W), kb.addKey(K.UP)],
      down: [kb.addKey(K.S), kb.addKey(K.DOWN)],
      left: [kb.addKey(K.A), kb.addKey(K.LEFT)],
      right: [kb.addKey(K.D), kb.addKey(K.RIGHT)],
    };

    this.add.text(4, 4, 'WASD / arrows to move · T for tuning', { fontFamily: 'monospace', fontSize: '8px', color: '#fff' })
      .setScrollFactor(0)
      .setDepth(DEPTH.ui);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05); // avoid huge jumps after a tab switch
    const held = (dir: keyof typeof this.keys) => this.keys[dir].some((k) => k.isDown);
    const input = { x: Number(held('right')) - Number(held('left')), y: Number(held('down')) - Number(held('up')) };

    // Read velocity back from the body so walls that stopped us are respected.
    const v = stepVelocity(this.player.body.velocity, input, dt, tuning);
    this.player.body.setVelocity(v.x, v.y);

    if (input.x || input.y) {
      const len = Math.hypot(input.x, input.y);
      this.facing = { x: input.x / len, y: input.y / len };
    }
    this.facingMarker.setPosition(this.player.x + this.facing.x * 5, this.player.y + this.facing.y * 5);

    // Y-sort: actors lower on screen (larger feet y) draw in front.
    this.player.setDepth(DEPTH.actors + this.player.body.bottom);
    this.facingMarker.setDepth(this.player.depth + 0.5);
    this.cameras.main.setLerp(tuning.cameraLerp, tuning.cameraLerp);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 320,
  height: 240,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#2d5a27',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  scene: [PlayScene],
});

tuningPanel(tuning, {
  maxSpeed: [20, 300, 5],
  accel: [100, 6000, 100],
  decel: [100, 6000, 100],
  cameraLerp: [0.02, 1, 0.01],
});
