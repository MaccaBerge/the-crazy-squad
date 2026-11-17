import * as Phaser from 'phaser';
import { characterTexture, FRAME } from '../art/placeholders';
import type { Party } from '../party/party';

const GAP = 4;
const MARGIN = 4;
// 3×5 pixel digits, drawn as pixels so they stay crisp at the game's low resolution.
const DIGITS: Record<string, string[]> = {
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
};

/** Draws a digit with its top-left at (x, y): light palette fill with a 1px dark drop shadow. */
function drawDigit(g: Phaser.GameObjects.Graphics, d: string, x: number, y: number) {
  for (const [color, o] of [[0x241520, 1], [0xfff6dc, 0]] as const)
    DIGITS[d].forEach((row, r) => [...row].forEach((c, col) => c === '#' && g.fillStyle(color).fillRect(x + col + o, y + r + o, 1, 1)));
}

/** Squad portraits and the swap cooldown. Runs on top of the level and only reads the party (players blueprint §6). */
export class HudScene extends Phaser.Scene {
  private party!: Party;
  private portraits: Phaser.GameObjects.Image[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private root!: Phaser.GameObjects.Container;

  constructor() {
    super('hud');
  }

  init(data: { party: Party }) {
    this.party = data.party;
  }

  create() {
    // Everything sits in one container pinned to the bottom-left corner, whatever the screen size.
    this.gfx = this.add.graphics();
    const labels = this.add.graphics();
    this.root = this.add.container(0, 0, [this.gfx, labels]);
    this.portraits = this.party.members.map((def, i) => {
      const x = i * (FRAME + GAP);
      drawDigit(labels, String(i + 1), x + 1, -8);
      const p = this.add.image(x, 0, characterTexture(def)).setOrigin(0);
      this.root.add(p);
      return p;
    });
    const place = () => this.root.setPosition(MARGIN, this.scale.height - MARGIN - FRAME);
    place();
    this.scale.on(Phaser.Scale.Events.RESIZE, place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, place));
  }

  update() {
    const { activeIndex, cooldownLeft } = this.party;
    const g = this.gfx.clear();
    const width = this.portraits.length * (FRAME + GAP) - GAP;
    g.fillStyle(0x000000, 0.5).fillRect(-2, -11, width + 4, FRAME + 13);
    const ax = activeIndex * (FRAME + GAP);
    g.lineStyle(1, 0xffffff).strokeRect(ax - 0.5, -0.5, FRAME + 1, FRAME + 1);
    // Swap cooldown: a bar that empties, and the others dimmed until you can swap again.
    if (cooldownLeft > 0) g.fillStyle(0xffffff).fillRect(0, FRAME + 1, Math.round(width * this.party.cooldownFraction), 1);
    this.portraits.forEach((p, i) => p.setAlpha(i === activeIndex || cooldownLeft === 0 ? 1 : 0.4));
  }
}
