import * as Phaser from 'phaser';
import { defaultMove, stepVelocity } from './movement';
import { tuningPanel } from './tuning';

const WORLD_W = 960;
const WORLD_H = 720;
const TILE = 16;

const tuning = { ...defaultMove, cameraLerp: 0.15 };

class PlayScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.Body };
  private facingMarker!: Phaser.GameObjects.Image;
  private facing = { x: 0, y: 1 };
  private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('play');
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // shortcut: placeholder textures until the pixel art exists. They must be textures (not shapes or
    // graphics) because Phaser 4 only snaps textured objects to whole pixels; shapes stutter against each other.
    const texture = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      const g = this.add.graphics();
      draw(g);
      g.generateTexture(key, w, h).destroy();
    };
    texture('floor', TILE, TILE, (g) => g.fillStyle(0x2d5a27).fillRect(0, 0, TILE, TILE).fillStyle(0x264d21).fillRect(0, 0, TILE, 1).fillRect(0, 0, 1, TILE));
    // Same 1px seam on the top/left edge as the floor, so wall tiles continue the floor grid.
    texture('wall', TILE, TILE, (g) => g.fillStyle(0x6b4f2a).fillRect(0, 0, TILE, TILE).fillStyle(0x553e20).fillRect(0, 0, TILE, 1).fillRect(0, 0, 1, TILE));
    texture('player', 14, 14, (g) => g.fillStyle(0xffcc00).fillRect(0, 0, 14, 14));
    texture('dot', 4, 4, (g) => g.fillStyle(0x222222).fillRect(0, 0, 4, 4));

    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'floor').setOrigin(0);

    // Test walls: corners and corridors to feel collisions and wall-sliding.
    const walls = this.physics.add.staticGroup();
    const wallRects: [number, number, number, number][] = [
      [240, 160, 96, 16], [240, 160, 16, 96], [560, 120, 16, 160], [608, 120, 16, 160],
      [160, 480, 192, 16], [480, 400, 64, 64], [720, 520, 128, 16], [720, 520, 16, 112],
    ];
    for (const [x, y, w, h] of wallRects) walls.add(this.add.tileSprite(x + w / 2, y + h / 2, w, h, 'wall'));

    this.player = this.physics.add.image(WORLD_W / 2, WORLD_H / 2, 'player') as typeof this.player;
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, walls);
    this.facingMarker = this.add.image(0, 0, 'dot');

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H).startFollow(this.player, true);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.W), kb.addKey(K.UP)],
      down: [kb.addKey(K.S), kb.addKey(K.DOWN)],
      left: [kb.addKey(K.A), kb.addKey(K.LEFT)],
      right: [kb.addKey(K.D), kb.addKey(K.RIGHT)],
    };

    this.add.text(4, 4, 'WASD / arrows to move · T for tuning', { fontFamily: 'monospace', fontSize: '8px', color: '#fff' })
      .setScrollFactor(0);
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
