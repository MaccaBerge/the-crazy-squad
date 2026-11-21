import * as Phaser from 'phaser';
import { type Dir, snapDir } from '../art/facing';
import { type Brain, newBrain, think } from '../ai/dogBrain';
import { type Cell, cellFeet, clearLine, findPath } from '../ai/path';
import type { SolidAt } from '../collision/cornerAssist';
import { stepVelocity, type Vec } from '../movement';
import { DEPTH } from '../world/constants';
import { toTile } from '../world/grid';
import { animDir, type Breed } from './breeds';
import type { DogKind } from './dogs';

type Body = Phaser.Physics.Arcade.Body;
type DogSprite = Phaser.Physics.Arcade.Sprite & { body: Body };

/** The shared movement tuning a dog's breed multiplies (the T panel's walk values). */
export type DogTuning = { walkSpeed: number; accel: number; decel: number };

const BODY = { w: 12, h: 6 }; // feet only, like the squad
const FRAME = 32;
const REPATH = 0.3; // s between path searches while the way is blocked

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
  private path: Cell[] = [];
  private repath = 0;

  constructor(private scene: Phaser.Scene, readonly kind: DogKind, private breed: Breed, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, `dog-${kind}`, 2).setOrigin(0.5, 1) as DogSprite;
    this.sprite.body.setSize(BODY.w, BODY.h, false).setOffset((FRAME - BODY.w) / 2, FRAME - BODY.h);
    this.sprite.setImmovable(true).setCollideWorldBounds(true).setVertexRoundMode('full'); // the squad can't shove it
    this.marks = scene.add.graphics().setDepth(DEPTH.effects);
    this.label = scene.add.text(x, y, '', { fontFamily: 'monospace', fontSize: '8px', color: '#fff', backgroundColor: '#000a', resolution: 4 })
      .setOrigin(0.5, 1).setDepth(DEPTH.ui).setVisible(false);
  }

  /** Fixed physics step: think, then move. `onHit` fires once per attack that reaches the target, with the push and damage. */
  step(dt: number, target: { x: number; y: number } | undefined, t: DogTuning, onHit: (push: Vec, damage: number) => void) {
    const s = this.sprite, b = this.breed;
    const to = target && { x: target.x - s.x, y: target.y - s.y };
    const dist = to ? Math.hypot(to.x, to.y) : null;
    const entered = think(this.brain, b.brain, dist, dt);
    const state = this.brain.state;

    if (to && dist && (entered === 'windup' || entered === 'alert')) this.aim = { x: to.x / dist, y: to.y / dist }; // aim locks at windup: you can sidestep it
    if (entered === 'attack') this.landed = false;

    let move = { x: 0, y: 0 };
    if (state === 'chase' && target) {
      const goal = this.steer(target, dt);
      const gx = goal.x - s.x, gy = goal.y - s.y, gd = Math.hypot(gx, gy);
      if (gd > 0.5) move = { x: gx / gd, y: gy / gd };
    } else this.path = [];
    const p = { maxSpeed: t.walkSpeed * b.speed, accel: t.accel * b.accel, decel: t.decel * b.accel };
    const v = state === 'attack' ? { x: this.aim.x * b.lunge.speed, y: this.aim.y * b.lunge.speed } : stepVelocity(s.body.velocity, move, dt, p);
    s.body.setVelocity(v.x, v.y);
    this.dir = snapDir(this.dir, state === 'chase' ? move : state === 'idle' ? { x: 0, y: 0 } : this.aim);

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
    if (!nav || clearLine(nav, s, target, BODY)) return (this.path = []), target;
    this.repath -= dt;
    if (!this.path.length || this.repath <= 0) {
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
    const speed = s.body.velocity.length();
    const anim = speed > 5 && state === 'chase' ? 'walk' : 'idle';
    const { dir, flip } = animDir(this.dir);
    const key = `dog-${this.kind}/${anim}-${dir}`;
    if (!this.scene.anims.exists(key)) {
      const frames = (this.scene.cache.json.get(`dog-${this.kind}-anims`) as Record<string, number[]>)[`${anim}-${dir}`];
      if (frames) this.scene.anims.create({ key, frames: this.scene.anims.generateFrameNumbers(`dog-${this.kind}`, { frames }), frameRate: 8, repeat: -1 });
    }
    s.setFlipX(flip);
    if (this.scene.anims.exists(key)) s.play(key, true);
    s.anims.timeScale = anim === 'walk' ? Phaser.Math.Clamp(speed / 50, 0.5, 2) : 1;

    // Windup telegraph: flash white, faster as the hit gets close.
    const t = this.brain.t, w = this.breed.brain.windup;
    if (state === 'windup' && Math.floor(now / (t > w * 0.6 ? 50 : 100)) % 2 === 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else s.clearTint();

    const g = this.marks.clear();
    if (state === 'alert') this.exclaim(g, Math.round(s.x), Math.round(s.y - 34));
    if (state === 'attack') this.swipe(g);

    this.label.setVisible(showDebug).setText(state).setPosition(Math.round(s.x), Math.round(s.y - 33));
  }

  /** A "!" above the head: 1×4 bar and a dot, with a dark outline. */
  private exclaim(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x241520).fillRect(x - 1, y - 1, 3, 8);
    g.fillStyle(0xf2a846).fillRect(x, y, 1, 4).fillRect(x, y + 5, 1, 1);
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
