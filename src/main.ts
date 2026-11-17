import * as Phaser from 'phaser';
import { HudScene } from './scenes/HudScene';
import { LevelScene, tuning } from './scenes/LevelScene';
import { tuningPanel } from './tuning';

// The shorter screen side always shows VIEW px of the world; the longer side shows more,
// so the game fills any screen shape (phone, ultrawide) without black bars.
const VIEW = 240;
const viewSize = (): [number, number] => {
  const s = Math.min(innerWidth, innerHeight) / VIEW;
  return [Math.round(innerWidth / s), Math.round(innerHeight / s)];
};
const [width, height] = viewSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width,
  height,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#2d5a27',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  scene: [LevelScene, HudScene],
});
addEventListener('resize', () => game.scale.setGameSize(...viewSize()));

tuningPanel(tuning, {
  maxSpeed: [20, 300, 5],
  accel: [100, 6000, 100],
  decel: [100, 6000, 100],
  cameraLerp: [0.02, 1, 0.01],
  lookahead: [0, 48, 1],
  swapCooldown: [0, 10, 0.5],
});
