import * as Phaser from 'phaser';
import { HudScene } from './scenes/HudScene';
import { LevelScene, tuning } from './scenes/LevelScene';
import { tuningPanel } from './tuning';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 320,
  height: 240,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#2d5a27',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  scene: [LevelScene, HudScene],
});

tuningPanel(tuning, {
  maxSpeed: [20, 300, 5],
  accel: [100, 6000, 100],
  decel: [100, 6000, 100],
  cameraLerp: [0.02, 1, 0.01],
  lookahead: [0, 48, 1],
  swapCooldown: [0, 10, 0.5],
});
