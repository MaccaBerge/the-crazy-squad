import * as Phaser from 'phaser';
import { type Dir, snapDir } from '../art/facing';
import { type Brain, hurt, newBrain, think } from '../ai/dogBrain';
import { type Cell, cellFeet, clearLine, findPath, lineOfSight } from '../ai/path';
import type { SolidAt } from '../collision/cornerAssist';
import { Health } from '../collision/hits';
import { stepVelocity, type Vec } from '../movement';
import { DEPTH } from '../world/constants';
import { toTile } from '../world/grid';
import { animDir, type Breed } from './breeds';
import type { DogKind } from './dogs';

type Body = Phaser.Physics.Arcade.Body;
type DogSprite = Phaser.Physics.Arcade.Sprite & { body: Body };

/** The shared movement tuning a dog's breed multiplies (the T panel's walk values). */
export type DogTuning = { walkSpeed: number; accel: number; decel: number; packPush: number };

const BODY = { w: 12, h: 6 }; // feet only, like the squad
const FRAME = 32;
const REPATH = 0.3; // s between path searches while the way is blocked
const EYES = 8; // px above the feet a dog looks from, and where it looks at you
const ARRIVED = 10; // px from the last seen spot that counts as there
const IFRAMES = 0.1; // s a dog ignores hits after one lands: short, so fast combos connect (combat blueprint §6)
const KNOCK = 0.15; // s a hit pushes the dog around
const FLASH = 0.06; // s of white after a hit
const DIZZY = 0.6; // s of spinning with stars when knocked out, before the poof
const POOF = 0.25; // s of the poof
const HELD_MAX = 400; // px/s cap on knockback saved up during slow-mo, so a long combo doesn't fling a dog off the map

/**
 * One thinking dog (dog AI blueprint §11): the brain decides, this turns it into movement, animation and the hit.
 * It walks straight at you when it can and finds a way round obstacles when it can't (§4, §6).
 * Still missing: sight through walls is allowed, and nobody shares attack tokens yet.
 */
export class DogAI {
  readonly sprite: DogSprite;
  private brain: Brain = newBrain();
  private dir: Dir = 'down';
  private aim: Vec = { x: 0, y: 1 };
  private landed = false;
  private marks: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  /** Tiles a dog can't walk through (walls, water, trunks, standing dogs). Without it the dog steers straight. */
  nav?: SolidAt;
  /** Tiles a dog can't see through (walls). Without it the dog sees through everything. */
  sight?: SolidAt;
  /** Where it last saw you, or was told you were: it searches here when it loses you. */
  private lastSeen?: Vec;
  /** It can see the target itself this step (not just told): only these dogs warn packmates. */
  seesTarget = false;
  private path: Cell[] = [];
  private repath = 0;
  readonly health: Health;
  private knock: Vec = { x: 0, y: 0 };
  private knockT = 0;
  private flashT = 0;
  /** World speed for this dog: 1 normal, below 1 in slow-mo. Its movement, timers and animation all run this much slower. */
  timeScale = 1;
  /** Knockback from hits in slow-mo, saved until time snaps back (release). */
  private held: Vec = { x: 0, y: 0 };
  /** Seconds since being knocked out, or -1 while still in the fight. */
  private ko = -1;

  constructor(private scene: Phaser.Scene, readonly kind: DogKind, private breed: Breed, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, `dog-${kind}`, 2).setOrigin(0.5, 1) as DogSprite;
    this.sprite.body.setSize(BODY.w, BODY.h, false).setOffset((FRAME - BODY.w) / 2, FRAME - BODY.h);
    // Not pushable: the squad can't shove it, and two dogs that bump split the overlap instead of passing through.
    this.sprite.setPushable(false).setCollideWorldBounds(true).setVertexRoundMode('full');
    this.marks = scene.add.graphics().setDepth(DEPTH.effects);
    this.label = scene.add.text(x, y, '', { fontFamily: 'monospace', fontSize: '8px', color: '#fff', backgroundColor: '#000a', resolution: 4 })
      .setOrigin(0.5, 1).setDepth(DEPTH.ui).setVisible(false);
    this.health = new Health(breed.maxHp);
  }

  get state() {
    return this.brain.state;
  }

  /** Out of the fight: no hits, no attacks, no collisions. */
  get out() {
    return this.ko >= 0;
  }

  /**
   * A squad attack reached this dog (combat blueprint §6). Returns whether it landed.
   * `push` is the attacker's knockback in px/s; the breed's weight scales it and its poise decides the stagger.
   */
  takeHit(damage: number, push: Vec) {
    if (this.out || !this.health.take(damage, IFRAMES)) return false;
    const w = this.breed.weight;
    if (this.timeScale < 1) {
      const x = this.held.x + push.x * w, y = this.held.y + push.y * w, k = Math.min(1, HELD_MAX / (Math.hypot(x, y) || 1));
      this.held = { x: x * k, y: y * k };
    } else {
      this.knock = { x: push.x * w, y: push.y * w };
      this.knockT = KNOCK;
    }
    this.flashT = FLASH;
    hurt(this.brain, Math.hypot(push.x, push.y) >= this.breed.poise);
    if (this.health.down) {
      // shortcut: knocked-out dogs spin and poof in code; run off screen once there's a KO animation.
      this.ko = 0;
      this.sprite.disableBody(false, false);
    }
    return true;
  }

  /** Slow-mo ended: all the knockback saved up lands at once. Returns whether there was any. */
  release() {
    const { x, y } = this.held;
    this.held = { x: 0, y: 0 };
    if (this.out || Math.hypot(x, y) < 1) return false;
    this.knock = { x, y };
    this.knockT = KNOCK;
    this.flashT = FLASH;
    return true;
  }

  /**
   * Fixed physics step: think, then move. `onHit` fires once per attack that reaches the target, with the push and damage.
   * What the pack gives it: `crowd` is the push away from packmates (separation), mixed into its steering. `slot` is its
   * own spot in the ring round the target, chased instead of the target itself so a pack surrounds you. `told` means a
   * packmate tracking the target warned it, so it hunts even out of sight.
   */
  step(dt: number, target: { x: number; y: number } | undefined, t: DogTuning, onHit: (push: Vec, damage: number) => void, { crowd = { x: 0, y: 0 }, slot, told = false }: { crowd?: Vec; slot?: Vec; told?: boolean } = {}) {
    const s = this.sprite, b = this.breed;
    // Hit immunity and the hit flash stay in real time, so Christian's fast combos still connect in slow-mo.
    this.health.tick(dt);
    this.flashT = Math.max(0, this.flashT - dt);
    const ts = this.timeScale;
    dt *= ts;
    if (this.out) return void (this.ko += dt);
    const to = target && { x: target.x - s.x, y: target.y - s.y };
    const dist = to ? Math.hypot(to.x, to.y) : null;
    const eye = (p: Vec) => ({ x: p.x, y: p.y - EYES });
    const visible = !!target && (!this.sight || lineOfSight(this.sight, eye(s), eye(target)));
    this.seesTarget = visible && dist !== null && dist <= b.brain.lose && this.brain.state !== 'idle';
    if (target && (this.seesTarget || told)) this.lastSeen = { x: target.x, y: target.y };
    const arrived = !!this.lastSeen && Math.hypot(this.lastSeen.x - s.x, this.lastSeen.y - s.y) <= ARRIVED;
    const entered = think(this.brain, b.brain, { dist, visible, told, arrived }, dt);
    const state = this.brain.state;

    if (to && dist && (entered === 'windup' || entered === 'alert')) this.aim = { x: to.x / dist, y: to.y / dist }; // aim locks at windup: you can sidestep it
    if (entered === 'attack') this.landed = false;

    let move = { x: 0, y: 0 };
    const heading = state === 'chase' && target ? slot ?? target : state === 'search' ? this.lastSeen : undefined;
    if (heading) {
      const goal = this.steer(heading, dt);
      const gx = goal.x - s.x, gy = goal.y - s.y, gd = Math.hypot(gx, gy);
      if (gd > 0.5) move = { x: gx / gd, y: gy / gd };
    } else this.path = [];
    // Packmates push apart in every state, the lunge too: they all aim at you, so without it they'd land in one spot.
    const apart = { x: crowd.x * t.packPush, y: crowd.y * t.packPush };
    move = { x: move.x + apart.x, y: move.y + apart.y };
    const p = { maxSpeed: t.walkSpeed * b.speed, accel: t.accel * b.accel, decel: t.decel * b.accel };
    const v = this.knockT > 0 ? (this.knockT = Math.max(0, this.knockT - dt), { x: this.knock.x * (this.knockT / KNOCK), y: this.knock.y * (this.knockT / KNOCK) })
      : state === 'attack' ? { x: this.aim.x * b.lunge.speed + apart.x * p.maxSpeed, y: this.aim.y * b.lunge.speed + apart.y * p.maxSpeed } : stepVelocity({ x: s.body.velocity.x / ts, y: s.body.velocity.y / ts }, move, dt, p);
    s.body.setVelocity(v.x * ts, v.y * ts); // the body moves in real time, so slow-mo scales its speed
    this.dir = snapDir(this.dir, heading ? move : state === 'idle' || state === 'lost' ? { x: 0, y: 0 } : this.aim);

    if (state === 'attack' && !this.landed && target) {
      const hx = s.x + this.aim.x * b.lunge.reach, hy = s.y + this.aim.y * b.lunge.reach;
      if (Math.hypot(target.x - hx, target.y - hy) <= b.lunge.radius) {
        this.landed = true;
        onHit({ x: this.aim.x * b.lunge.knockback, y: this.aim.y * b.lunge.knockback }, b.lunge.damage);
      }
    }
  }

  /** Where to head now: straight at the target if the way is clear, else the furthest path cell in plain sight. */
  private steer(target: { x: number; y: number }, dt: number) {
    const s = this.sprite, nav = this.nav;
    // Clear way: no path needed, and the next time it's blocked it searches straight away.
    if (!nav || clearLine(nav, s, target, BODY)) return (this.path = []), (this.repath = 0), target;
    this.repath -= dt;
    // Only every REPATH seconds, also after a failed search: retrying a failed one every step made big packs crawl.
    if (this.repath <= 0) {
      const cell = (p: { x: number; y: number }) => ({ x: toTile(p.x), y: toTile(p.y - BODY.h / 2) });
      this.path = findPath(nav, cell(s), cell(target)) ?? [];
      this.repath = REPATH;
    }
    while (this.path.length > 1 && clearLine(nav, s, cellFeet(this.path[1], BODY.h), BODY)) this.path.shift();
    return this.path.length ? cellFeet(this.path[0], BODY.h) : target; // no way there: push straight at it
  }

  /** Per rendered frame: animation, y-sort, the telegraph and the debug label. */
  update(now: number, showDebug: boolean) {
    const s = this.sprite, state = this.brain.state;
    s.setDepth(DEPTH.actors + s.y);
    const squash = this.flashT > 0 && !this.out; // squashed by the hit for a moment (flashT stops counting once knocked out)
    s.setScale(squash ? 1.2 : 1, squash ? 0.85 : 1);
    if (this.out) return this.knockedOut(now);
    const speed = s.body.velocity.length();
    const anim = speed > 5 && (state === 'chase' || state === 'search') ? 'walk' : 'idle';
    const { dir, flip } = animDir(this.dir);
    const key = `dog-${this.kind}/${anim}-${dir}`;
    if (!this.scene.anims.exists(key)) {
      const frames = (this.scene.cache.json.get(`dog-${this.kind}-anims`) as Record<string, number[]>)[`${anim}-${dir}`];
      if (frames) this.scene.anims.create({ key, frames: this.scene.anims.generateFrameNumbers(`dog-${this.kind}`, { frames }), frameRate: 8, repeat: -1 });
    }
    s.setFlipX(flip);
    if (this.scene.anims.exists(key)) s.play(key, true);
    s.anims.timeScale = (anim === 'walk' ? Phaser.Math.Clamp(speed / this.timeScale / 50, 0.5, 2) : 1) * this.timeScale;

    // Windup telegraph: flash white, faster as the hit gets close.
    const t = this.brain.t, w = this.breed.brain.windup;
    if (this.flashT > 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (state === 'windup' && Math.floor(now / (t > w * 0.6 ? 50 : 100)) % 2 === 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else s.clearTint();

    const g = this.marks.clear();
    // Speech bubbles: "!" while it tells the pack it has seen you, "?" when your trail has gone cold.
    if (state === 'alert' || state === 'lost') this.bubble(g, Math.round(s.x), Math.round(s.y - (this.health.fraction < 1 ? 33 : 30)), state === 'alert' ? '!' : '?', this.brain.t);
    if (state === 'attack') this.swipe(g);
    const hp = this.health.fraction;
    if (hp < 1) {
      // A small bar over the head once hurt, so you can see a fight going your way.
      const x = Math.round(s.x - 6), y = Math.round(s.y - 31);
      g.fillStyle(0x241520).fillRect(x - 1, y - 1, 14, 4);
      g.fillStyle(0xb4443a).fillRect(x, y, Math.max(1, Math.round(12 * hp)), 2);
    }

    this.label.setVisible(showDebug).setText(`${state} ${this.health.hp}`).setPosition(Math.round(s.x), Math.round(s.y - 35));
  }

  /** Knocked out: spin in place with stars over the head, then poof into a ring of dust and disappear. */
  private knockedOut(now: number) {
    const s = this.sprite, g = this.marks.clear(), t = this.ko;
    this.label.setVisible(false);
    s.anims.stop();
    if (t < DIZZY) {
      s.setFlipX(Math.floor(now / 90) % 2 === 0).setTint(0xffffff).setTintMode(t < FLASH ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
      for (let i = 0; i < 3; i++) {
        const a = now / 150 + (i * Math.PI * 2) / 3;
        g.fillStyle(i % 2 ? 0xe6faf6 : 0xf2a846).fillRect(Math.round(s.x + Math.cos(a) * 7), Math.round(s.y - 31 + Math.sin(a) * 2), 2, 2);
      }
      return;
    }
    s.setVisible(false);
    const p = (t - DIZZY) / POOF;
    if (p >= 1) return;
    const r = 4 + p * 10;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillStyle(0xe6faf6, 1 - p).fillRect(Math.round(s.x + Math.cos(a) * r), Math.round(s.y - 10 + Math.sin(a) * r * 0.6), 2, 2);
    }
  }

  /**
   * A small speech bubble with its tail on (x, y): a pale 7×9 box with a dark outline, holding a red "!" or a dark "?".
   * It pops up a pixel for its first moment, so it catches the eye.
   */
  private bubble(g: Phaser.GameObjects.Graphics, x: number, y: number, glyph: '!' | '?', age: number) {
    if (age < 0.08) y -= 1;
    const l = x - 4, top = y - 12;
    g.fillStyle(0x241520).fillRect(l, top, 9, 11).fillRect(x - 1, top + 11, 3, 1).fillRect(x, top + 12, 1, 1); // outline and tail
    g.fillStyle(0xe6faf6).fillRect(l + 1, top + 1, 7, 9).fillRect(x, top + 10, 1, 1);
    if (glyph === '!') g.fillStyle(0xb4443a).fillRect(x, top + 2, 1, 4).fillRect(x, top + 7, 1, 1);
    else g.fillStyle(0x241520).fillRect(x - 1, top + 2, 2, 1).fillRect(x + 1, top + 3, 1, 1).fillRect(x, top + 4, 1, 1).fillRect(x, top + 7, 1, 1);
  }

  /** Placeholder for the club: a short pale arc where the hit circle is. */
  private swipe(g: Phaser.GameObjects.Graphics) {
    const s = this.sprite, l = this.breed.lunge;
    const cx = s.x + this.aim.x * l.reach, cy = s.y - 8 + this.aim.y * l.reach, a = Math.atan2(this.aim.y, this.aim.x);
    g.lineStyle(2, 0xe6faf6, 0.9).beginPath().arc(cx, cy, l.radius, a - 1.1, a + 1.1).strokePath();
  }

  destroy() {
    this.sprite.destroy();
    this.marks.destroy();
    this.label.destroy();
  }
}
