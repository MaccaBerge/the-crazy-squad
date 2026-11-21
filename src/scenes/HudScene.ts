import * as Phaser from 'phaser';
import { characterTexture, FRAME } from '../art/placeholders';
import type { Party } from '../party/party';
import { bolt, SLOWMO } from '../abilities/slowmo';
import type { Vec } from '../movement';

const GAP = 4;
const MARGIN = 4;
const SLOT = 20; // ability slot, px square
const READY_FLASH = 250; // ms the slot flashes when the ability comes back
// The ability icon: a 9×13 lightning bolt (#: glow colour, o: core).
const ICON = ['....###..', '...###...', '..###....', '.###.....', '###oo####', '.####oo##', '....###..', '...###...', '..###....', '.##......', '##.......', '#........', '.........'];
// 3×5 pixel digits, drawn as pixels so they stay crisp at the game's low resolution.
const DIGITS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
};

/** Draws a digit with its top-left at (x, y): light palette fill with a 1px dark drop shadow. */
function drawDigit(g: Phaser.GameObjects.Graphics, d: string, x: number, y: number) {
  for (const [color, o] of [[0x241520, 1], [0xfff6dc, 0]] as const)
    DIGITS[d].forEach((row, r) => [...row].forEach((c, col) => c === '#' && g.fillStyle(color).fillRect(x + col + o, y + r + o, 1, 1)));
}

/** Draws a pixel pattern from rows of characters: each character with a colour in `colors` is a pixel. */
function drawPattern(g: Phaser.GameObjects.Graphics, rows: string[], x: number, y: number, colors: Record<string, number>, alpha = 1) {
  rows.forEach((row, r) => [...row].forEach((c, col) => c in colors && g.fillStyle(colors[c], alpha).fillRect(x + col, y + r, 1, 1)));
}

/** Squad portraits, health and the swap cooldown. Runs on top of the level and only reads the party (players blueprint §6). */
export class HudScene extends Phaser.Scene {
  private party!: Party;
  private portraits: Phaser.GameObjects.Image[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics; // over the portraits
  private root!: Phaser.GameObjects.Container;
  private edges!: Phaser.GameObjects.Graphics; // slow-mo lightning round the screen, under the panel
  private bolts: Vec[][] = [];
  private nextBolts = 0;
  private wasReady = true;
  private readyAt = -Infinity;

  constructor() {
    super('hud');
  }

  init(data: { party: Party }) {
    this.party = data.party;
  }

  create() {
    // Everything sits in one container pinned to the bottom-left corner, whatever the screen size.
    this.edges = this.add.graphics();
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
    this.bars = this.add.graphics();
    this.root.add(this.bars);
    const place = () => this.root.setPosition(MARGIN, this.scale.height - MARGIN - FRAME);
    place();
    this.scale.on(Phaser.Scale.Events.RESIZE, place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, place));
  }

  update() {
    const { activeIndex, cooldownLeft } = this.party;
    const g = this.gfx.clear();
    const width = this.portraits.length * (FRAME + GAP) - GAP;
    const ability = this.party.abilities[activeIndex];
    g.fillStyle(0x000000, 0.5).fillRect(-2, -11, width + 4 + (ability ? SLOT + GAP : 0), FRAME + 13);
    const ax = activeIndex * (FRAME + GAP);
    g.lineStyle(1, 0xffffff).strokeRect(ax - 0.5, -0.5, FRAME + 1, FRAME + 1);
    // Swap cooldown: a bar that empties, and the others dimmed until you can swap again.
    if (cooldownLeft > 0) g.fillStyle(0xffffff).fillRect(0, FRAME + 1, Math.round(width * this.party.cooldownFraction), 1);
    const b = this.bars.clear();
    this.portraits.forEach((p, i) => {
      const { down, fraction } = this.party.health[i];
      // Health: a 2px bar along the portrait's bottom; downed members go dark and can't be picked.
      const x = i * (FRAME + GAP);
      b.fillStyle(0x241520).fillRect(x, FRAME - 2, FRAME, 2);
      if (!down) b.fillStyle(fraction > 0.3 ? 0xf2a846 : 0xb4443a).fillRect(x, FRAME - 2, Math.max(1, Math.round(FRAME * fraction)), 2);
      p.setAlpha(down ? 0.2 : i === activeIndex || cooldownLeft === 0 ? 1 : 0.4);
      // A dot in the corner for members with an ability: lit when it's ready, so you know when swapping to them pays.
      const a = this.party.abilities[i];
      if (a && !down) b.fillStyle(0x241520).fillRect(x + FRAME - 5, 1, 4, 4).fillStyle(a.ready ? SLOWMO.glow : 0x6b5a5a).fillRect(x + FRAME - 4, 2, 2, 2);
    });
    if (ability) this.drawSlot(b, width + GAP, ability);
    this.drawEdges(this.party.abilities.find((a) => a?.active && a.def.id === 'slowmo')?.left ?? 0);
  }

  /**
   * The active member's ability: a lightning icon with its key over it. Cooling down, the icon is grey with a dark
   * cover that shrinks from the top and the seconds left; running, a bar drains along its bottom; back, it flashes.
   */
  private drawSlot(g: Phaser.GameObjects.Graphics, x: number, a: NonNullable<Party['abilities'][number]>) {
    const y = FRAME - SLOT, now = this.time.now;
    if (a.ready && !this.wasReady) this.readyAt = now;
    this.wasReady = a.ready;
    drawDigit(g, 'E', x + SLOT / 2 - 1, -8);
    g.fillStyle(0x241520).fillRect(x, y, SLOT, SLOT);
    const cooling = a.cooldownLeft > 0;
    drawPattern(g, ICON, x + 6, y + 3, cooling ? { '#': 0x6b5a5a, o: 0x8a7a7a } : { '#': SLOWMO.glow, o: SLOWMO.core });
    if (cooling) {
      const h = Math.ceil((SLOT - 2) * a.cooldownFraction);
      g.fillStyle(0x000000, 0.55).fillRect(x + 1, y + 1, SLOT - 2, h);
      const secs = String(Math.ceil(a.cooldownLeft));
      [...secs].forEach((d, i) => drawDigit(g, d, x + SLOT / 2 - secs.length * 2 + i * 4, y + SLOT / 2 - 2));
    }
    if (a.active) {
      g.fillStyle(SLOWMO.glow).fillRect(x + 1, y + SLOT - 3, Math.max(1, Math.round((SLOT - 2) * (a.left / a.def.duration))), 2);
    }
    const flash = 1 - (now - this.readyAt) / READY_FLASH;
    if (flash > 0) g.fillStyle(SLOWMO.core, flash * 0.8).fillRect(x + 1, y + 1, SLOT - 2, SLOT - 2);
    g.lineStyle(1, a.ready || a.active ? SLOWMO.glow : 0x6b5a5a).strokeRect(x - 0.5, y - 0.5, SLOT + 1, SLOT + 1);
  }

  /**
   * Slow-mo: lightning crackling along the screen edges, redrawn every few frames so it flickers. `left` is the
   * seconds of slow-mo left (0: off); in the last second it stutters, a warning that time is about to snap back.
   */
  private drawEdges(left: number) {
    const g = this.edges.clear(), now = this.time.now;
    if (left <= 0 || (left < 1 && Math.floor(now / 70) % 3 === 0)) return;
    const w = this.scale.width, h = this.scale.height;
    if (now >= this.nextBolts) {
      this.nextBolts = now + 60;
      // Each bolt runs a short way along one edge, a few px in from it.
      const edge = (i: number): [Vec, Vec] => {
        const t = Math.random(), len = 30 + Math.random() * 50, d = 2 + Math.random() * 6;
        if (i % 4 === 0) return [{ x: t * w, y: d }, { x: t * w + len, y: d + Math.random() * 8 }];
        if (i % 4 === 1) return [{ x: t * w, y: h - d }, { x: t * w + len, y: h - d - Math.random() * 8 }];
        if (i % 4 === 2) return [{ x: d, y: t * h }, { x: d + Math.random() * 8, y: t * h + len }];
        return [{ x: w - d, y: t * h }, { x: w - d - Math.random() * 8, y: t * h + len }];
      };
      this.bolts = Array.from({ length: 8 }, (_, i) => bolt(...edge(i + Math.floor(Math.random() * 4)), 7, 4));
    }
    for (const line of this.bolts) {
      const pts = line.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) as Phaser.Math.Vector2[]; // only reads x and y
      g.lineStyle(3, SLOWMO.glow, 0.35).strokePoints(pts);
      g.lineStyle(1, SLOWMO.core, 0.95).strokePoints(pts);
    }
  }
}
