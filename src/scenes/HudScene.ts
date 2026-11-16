import * as Phaser from 'phaser';
import { characterTexture, FRAME } from '../art/placeholders';
import type { Party } from '../party/party';

const GAP = 4;
const X = 4;
const Y = 240 - 4 - FRAME; // bottom-left corner

/** Squad portraits and the swap cooldown. Runs on top of the level and only reads the party (players blueprint §6). */
export class HudScene extends Phaser.Scene {
  private party!: Party;
  private portraits: Phaser.GameObjects.Image[] = [];
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('hud');
  }

  init(data: { party: Party }) {
    this.party = data.party;
  }

  create() {
    this.gfx = this.add.graphics();
    this.portraits = this.party.members.map((def, i) => {
      const x = X + i * (FRAME + GAP);
      this.add.text(x + 1, Y - 9, String(i + 1), { fontFamily: 'monospace', fontSize: '8px', color: '#fff' });
      return this.add.image(x, Y, characterTexture(def)).setOrigin(0);
    });
  }

  update() {
    const { activeIndex, cooldownLeft } = this.party;
    const g = this.gfx.clear();
    const width = this.portraits.length * (FRAME + GAP) - GAP;
    g.fillStyle(0x000000, 0.5).fillRect(X - 2, Y - 11, width + 4, FRAME + 13);
    const ax = X + activeIndex * (FRAME + GAP);
    g.lineStyle(1, 0xffffff).strokeRect(ax - 0.5, Y - 0.5, FRAME + 1, FRAME + 1);
    // Swap cooldown: a bar that empties, and the others dimmed until you can swap again.
    if (cooldownLeft > 0) g.fillStyle(0xffffff).fillRect(X, Y + FRAME + 1, Math.round(width * this.party.cooldownFraction), 1);
    this.portraits.forEach((p, i) => p.setAlpha(i === activeIndex || cooldownLeft === 0 ? 1 : 0.4));
  }
}
