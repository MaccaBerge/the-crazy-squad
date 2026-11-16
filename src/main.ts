import * as Phaser from 'phaser';

const SPEED = 120;

class PlayScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
  private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('play');
  }

  create() {
    this.add.text(8, 8, 'The Crazy Squad', { fontFamily: 'monospace', fontSize: '12px', color: '#fff' });

    // shortcut: coloured square stands in for the player sprite, replace once the pixel art exists
    const square = this.add.rectangle(160, 120, 16, 16, 0xffcc00);
    this.physics.add.existing(square);
    this.player = square as typeof this.player;
    this.player.body.setCollideWorldBounds(true);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.W), kb.addKey(K.UP)],
      down: [kb.addKey(K.S), kb.addKey(K.DOWN)],
      left: [kb.addKey(K.A), kb.addKey(K.LEFT)],
      right: [kb.addKey(K.D), kb.addKey(K.RIGHT)],
    };
  }

  update() {
    const held = (dir: keyof typeof this.keys) => this.keys[dir].some((k) => k.isDown);
    const v = new Phaser.Math.Vector2(
      Number(held('right')) - Number(held('left')),
      Number(held('down')) - Number(held('up')),
    ).normalize().scale(SPEED);
    this.player.body.setVelocity(v.x, v.y);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 320,
  height: 240,
  pixelArt: true,
  backgroundColor: '#2d5a27',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  scene: [PlayScene],
});
