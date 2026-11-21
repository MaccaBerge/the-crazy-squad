import * as Phaser from 'phaser';
import { characterTexture, FRAME } from '../art/placeholders';
import type { Party } from '../party/party';
import { drawLightning, type Lightning, lightning, SLOWMO } from '../abilities/slowmo';

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
  private edgeGlow!: Phaser.GameObjects.Graphics; // slow-mo lightning round the screen, under the panel: additive glow…
  private edgeCore!: Phaser.GameObjects.Graphics; // …and the bright cores on top
  private strikes: { l: Lightning; born: number; life: number; grow: number; thick: number }[] = [];
  private nextStrike = 0;
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
    this.edgeGlow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.edgeCore = this.add.graphics();
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
      if (a && !down) b.fillStyle(0x241520).fillRect(x + FRAME - 5, 1, 4, 4).fillStyle(a.ready ? SLOWMO.gold : 0x6b5a5a).fillRect(x + FRAME - 4, 2, 2, 2);
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
    drawPattern(g, ICON, x + 6, y + 3, cooling ? { '#': 0x6b5a5a, o: 0x8a7a7a } : { '#': SLOWMO.gold, o: SLOWMO.core });
    if (cooling) {
      const h = Math.ceil((SLOT - 2) * a.cooldownFraction);
      g.fillStyle(0x000000, 0.55).fillRect(x + 1, y + 1, SLOT - 2, h);
      const secs = String(Math.ceil(a.cooldownLeft));
      [...secs].forEach((d, i) => drawDigit(g, d, x + SLOT / 2 - secs.length * 2 + i * 4, y + SLOT / 2 - 2));
    }
    if (a.active && !(a.left < 1 && Math.floor(this.time.now / 100) % 2)) { // blinks in the last second: about to snap back
      g.fillStyle(SLOWMO.gold).fillRect(x + 1, y + SLOT - 3, Math.max(1, Math.round((SLOT - 2) * (a.left / a.def.duration))), 2);
    }
    const flash = 1 - (now - this.readyAt) / READY_FLASH;
    if (flash > 0) g.fillStyle(SLOWMO.core, flash * 0.8).fillRect(x + 1, y + 1, SLOT - 2, SLOT - 2);
    g.lineStyle(1, a.ready || a.active ? SLOWMO.gold : 0x6b5a5a).strokeRect(x - 0.5, y - 0.5, SLOT + 1, SLOT + 1);
  }

  /**
   * Slow-mo: lightning round the screen edges. Bolts strike in from the edge or crawl along it, branch, grow out from
   * the edge like a real strike, flash, linger and fade, a new one every 70–150 ms, now and then a big one. `left` is the seconds of slow-mo left
   * (0: off); in the last second it stutters, a warning that time is about to snap back.
   */
  private drawEdges(left: number) {
    const glow = this.edgeGlow.clear(), core = this.edgeCore.clear(), now = this.time.now;
    if (left <= 0) return void (this.strikes = []);
    const w = this.scale.width, h = this.scale.height;
    if (now >= this.nextStrike) {
      this.nextStrike = now + 70 + Math.random() * 80; // fewer, since each lives longer
      const side = Math.floor(Math.random() * 4), t = Math.random(), big = Math.random() < 0.12;
      // A point on that edge, the way into the screen from it, and the way along it.
      const at = [{ x: t * w, y: 0 }, { x: w, y: t * h }, { x: t * w, y: h }, { x: 0, y: t * h }][side];
      const inward = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }][side], along = { x: -inward.y, y: inward.x };
      const crawl = !big && Math.random() < 0.45, len = big ? 70 + Math.random() * 50 : 25 + Math.random() * 45;
      const sway = (Math.random() * 2 - 1) * 0.6, dir = crawl ? along : { x: inward.x + along.x * sway, y: inward.y + along.y * sway };
      const from = crawl ? { x: at.x + inward.x * (2 + Math.random() * 5), y: at.y + inward.y * (2 + Math.random() * 5) } : at;
      const to = { x: from.x + dir.x * len, y: from.y + dir.y * len };
      this.strikes.push({ l: lightning(from, to, { depth: big ? 5 : 4, jag: crawl ? 0.12 : 0.22, fork: big ? 0.3 : 0.18 }), born: now, life: (big ? 600 : 400) + Math.random() * 200, grow: big ? 360 : 240, thick: 1 });
    }
    this.strikes = this.strikes.filter((b) => now - b.born < b.life);
    if (left < 1 && Math.floor(now / 70) % 3 === 0) return;
    for (const b of this.strikes) {
      // Like a real strike: a dim leader reaches out from the edge, flashes to full brightness when it's all the way out,
      // then fades over the second half of its life.
      const ms = now - b.born, grow = ms / b.grow, age = ms / b.life, flick = Math.random() < 0.08 ? 0.35 : 1;
      const bright = grow < 1 ? 0.55 : Math.min(1, (1 - age) / 0.5);
      drawLightning(glow, core, b.l, flick * bright, { thick: b.thick, thin: true, grow });
    }
  }
}
