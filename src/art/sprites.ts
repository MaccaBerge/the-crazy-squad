import type * as Phaser from 'phaser';
import type { CharacterDef } from '../characters/types';
import { FRAME } from './placeholders';

type AnimsFile = { anims: Record<string, { frames: number[]; frameRate: number }> };

/** Loads the sheet and animation list for every character that has real art (built by `npm run art`). */
export function preloadSprites(scene: Phaser.Scene, defs: CharacterDef[]) {
  for (const { sprite } of defs) {
    if (!sprite) continue;
    scene.load.spritesheet(sprite, `assets/sprites/${sprite}.png`, { frameWidth: FRAME, frameHeight: FRAME });
    scene.load.json(`${sprite}-anims`, `assets/sprites/${sprite}.anims.json`);
  }
}

/** Creates animations keyed `${sprite}/${anim}`, e.g. `christian/walk-side` (art blueprint §4). */
export function createAnims(scene: Phaser.Scene, defs: CharacterDef[]) {
  for (const { sprite } of defs) {
    if (!sprite) continue;
    const { anims } = scene.cache.json.get(`${sprite}-anims`) as AnimsFile;
    for (const [name, a] of Object.entries(anims)) {
      const key = `${sprite}/${name}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(sprite, { frames: a.frames }), frameRate: a.frameRate, repeat: -1 });
    }
  }
}
