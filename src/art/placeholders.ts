import type * as Phaser from 'phaser';
import type { CharacterDef } from '../characters/types';

export const FRAME = 24; // character frame size (art blueprint §1)

// 5×5 pixel glyphs, so initials stay crisp instead of using a blurry browser font.
const GLYPHS: Record<string, string[]> = {
  M: ['10001', '11011', '10101', '10001', '10001'],
  K: ['10001', '10010', '11100', '10010', '10001'],
  C: ['01111', '10000', '10000', '10000', '01111'],
  J: ['00111', '00010', '00010', '10010', '01100'],
};

const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Texture key for a character: the real sprite once it exists, the generated placeholder until then. */
export const characterTexture = (def: CharacterDef) => `char-${def.id}`;

/** shortcut: generated stand-ins (art blueprint §6), replaced by Aseprite sprites when the art exists. */
export function makePlaceholderTextures(scene: Phaser.Scene, defs: CharacterDef[]) {
  for (const def of defs) {
    const key = characterTexture(def);
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, FRAME, FRAME)!;
    const ctx = tex.getContext();
    // 14×20 body standing on the bottom edge (feet at the bottom centre = sprite origin)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(5, 4, 14, 20);
    ctx.fillStyle = css(def.placeholder.color);
    ctx.fillRect(6, 5, 12, 18);
    ctx.fillStyle = '#1a1a1a';
    GLYPHS[def.placeholder.initial].forEach((row, y) =>
      [...row].forEach((bit, x) => bit === '1' && ctx.fillRect(10 + x, 10 + y, 1, 1)),
    );
    tex.refresh();
  }
  if (!scene.textures.exists('dot')) {
    const dot = scene.textures.createCanvas('dot', 2, 2)!;
    dot.getContext().fillStyle = '#1a1a1a';
    dot.getContext().fillRect(0, 0, 2, 2);
    dot.refresh();
  }
}
