import * as Phaser from 'phaser';
import { type Dir, sheetDir, snapDir } from '../art/facing';
import { characterTexture, FRAME, makePlaceholderTextures } from '../art/placeholders';
import { createAnims, preloadSprites } from '../art/sprites';
import { defaultStamina } from '../party/stamina';
import { CameraRig } from '../camera/cameraRig';
import { SQUAD } from '../characters';
import type { CharacterDef } from '../characters/types';
import { cornerNudge, rectFree, type SolidAt } from '../collision/cornerAssist';
import { LocalController } from '../input/localController';
import { defaultMove, stepVelocity } from '../movement';
import { Party, SWAP_ACTIONS, type SwapAction } from '../party/party';
import { DEPTH } from '../world/constants';
import { loadMap, preloadMap } from '../world/loadMap';
import { spawnEntities } from '../world/spawner';

const MAP = new URLSearchParams(location.search).get('map') ?? 'test'; // dev: ?map=backyard
const NUDGE_SPEED = 0.6; // corner assist sideways speed, as a share of top speed

/** Live-tunable values (T panel). Character stats multiply the movement values. */
// Walking is the default; holding sprint raises speed to sprintSpeed while stamina lasts.
// animSpeed: multiplier on walk/run playback, to match feet to ground.
export const tuning = {
  walkSpeed: 62, sprintSpeed: 115, accel: defaultMove.accel, decel: defaultMove.decel, ...defaultStamina,
  cameraLerp: 0.15, lookahead: 24, swapCooldown: 4, animSpeed: 1,
};

type CharSprite = Phaser.Physics.Arcade.Sprite & { body: Phaser.Physics.Arcade.Body };

function onStage(s: CharSprite, x: number, y: number) {
  s.enableBody(true, x, y, true, true);
  s.body.debugShowBody = s.body.debugShowVelocity = true;
}

function offStage(s: CharSprite) {
  s.disableBody(true, true);
  s.body.debugShowBody = s.body.debugShowVelocity = false; // Phaser still draws disabled bodies otherwise
}

export class LevelScene extends Phaser.Scene {
  private party = new Party(SQUAD, tuning);
  private controller = new LocalController();
  private sprites: CharSprite[] = [];
  private rig!: CameraRig;
  private solid!: SolidAt;
  private facing = { x: 0, y: 1 };
  private dir: Dir = 'down';
  private sprinting = false;
  private staminaBar!: Phaser.GameObjects.Graphics;
  private sweat: { x: number; y: number; vx: number; vy: number; age: number }[] = [];
  private nextSweat = 0;
  private facingDot!: Phaser.GameObjects.Image;

  constructor() {
    super('level');
  }

  private get active() {
    return this.sprites[this.party.activeIndex];
  }

  preload() {
    preloadMap(this, MAP);
    preloadSprites(this, SQUAD);
  }

  create() {
    const { map, colliders } = loadMap(this, MAP);
    this.solid = (tx, ty) => colliders.some((l) => l.getTileAt(tx, ty)?.collides);
    makePlaceholderTextures(this, SQUAD);
    createAnims(this, SQUAD);

    let spawn = { x: map.widthInPixels / 2, y: map.heightInPixels / 2 };
    spawnEntities(map, { PlayerSpawn: (o) => (spawn = { x: o.x ?? spawn.x, y: o.y ?? spawn.y }) });

    // All four exist, but only the active one is enabled; the others are off stage (players blueprint §2).
    this.sprites = SQUAD.map((def) => {
      const s = this.physics.add.sprite(spawn.x, spawn.y, characterTexture(def)).setOrigin(0.5, 1) as CharSprite;
      s.body.setSize(def.body.w, def.body.h, false).setOffset((FRAME - def.body.w) / 2, FRAME - def.body.h);
      s.setCollideWorldBounds(true);
      // Phaser only snaps unflipped sprites to whole pixels; mirrored (left-facing) ones landed between pixels and sampled wrong columns.
      s.setVertexRoundMode('full');
      offStage(s);
      return s;
    });
    onStage(this.active, spawn.x, spawn.y);
    this.physics.add.collider(this.sprites, colliders);
    this.facingDot = this.add.image(0, 0, 'dot');
    this.staminaBar = this.add.graphics().setDepth(DEPTH.effects);

    this.rig = new CameraRig(this.cameras.main, tuning);
    this.rig.follow(this.active);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.controller.attach());
    // Gameplay runs in fixed physics steps, not per rendered frame (players blueprint §3).
    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_STEP, (dt: number) => this.step(dt));

    // Dev: B toggles the hitbox overlay (collision blueprint §11).
    this.input.keyboard!.on('keydown-B', () => {
      const world = this.physics.world;
      world.drawDebug = !world.drawDebug;
      if (world.drawDebug && !world.debugGraphic) world.createDebugGraphic();
      if (!world.drawDebug) world.debugGraphic?.clear();
    });

    this.scene.launch('hud', { party: this.party });
  }

  private moveParams(def: CharacterDef, sprint = false) {
    return { maxSpeed: (sprint ? tuning.sprintSpeed : tuning.walkSpeed) * def.stats.speed, accel: tuning.accel * def.stats.accel, decel: tuning.decel * def.stats.accel };
  }

  private step(dt: number) {
    const intent = this.controller.getIntent(performance.now());
    // Only drain while actually moving: holding Shift against a wall shouldn't tire you out.
    const moving = !!(intent.move.x || intent.move.y) && this.active.body.velocity.length() > 5;
    this.sprinting = this.party.tick(dt, intent.sprint && moving);
    const swap = SWAP_ACTIONS.find((a) => intent.pressed.has(a));
    if (swap) this.trySwap(swap);

    const s = this.active;
    const p = this.moveParams(this.party.active, this.sprinting);
    // Exhausted (bar just ran dry): walk slower. Animation speed still compares to the normal walk, so the legs look heavy.
    p.maxSpeed *= this.party.stamina[this.party.activeIndex].speedFactor;
    const v = stepVelocity(s.body.velocity, intent.move, dt, p);
    const b = s.body;
    const nudge = cornerNudge({ x: b.x, y: b.y, w: b.width, h: b.height }, intent.move, b.blocked, this.solid);
    if (nudge?.x) v.x = nudge.x * p.maxSpeed * NUDGE_SPEED;
    if (nudge?.y) v.y = nudge.y * p.maxSpeed * NUDGE_SPEED;
    b.setVelocity(v.x, v.y);

    if (intent.move.x || intent.move.y) {
      const len = Math.hypot(intent.move.x, intent.move.y);
      this.facing = { x: intent.move.x / len, y: intent.move.y / len };
    }
    this.dir = snapDir(this.dir, intent.move);
  }

  private trySwap(action: SwapAction) {
    const from = this.active;
    const result = this.party.trySwap(this.party.targetFor(action), (def) => this.fits(def, from.x, from.y));
    // A press that lands on the cooldown stays buffered, so pressing just before it ends still swaps.
    if (result !== 'cooldown') this.controller.consume(action);
    if (result === 'no-room') this.flash(from, 0xff4040);
    if (result !== 'ok') return;

    const to = this.active;
    const { x: vx, y: vy } = from.body.velocity;
    offStage(from);
    onStage(to, from.x, from.y);
    to.body.setVelocity(vx, vy);
    this.rig.follow(to);
    this.flash(to, 0xffffff);
  }

  /** Whether `def`'s feet hitbox has room with its feet at (x, y). */
  private fits(def: CharacterDef, x: number, y: number) {
    const r = { x: x - def.body.w / 2, y: y - def.body.h, w: def.body.w, h: def.body.h };
    const w = this.physics.world.bounds;
    return r.x >= w.x && r.x + r.w <= w.right && r.y >= w.y && r.y + r.h <= w.bottom && rectFree(r, this.solid);
  }

  private flash(s: CharSprite, color: number) {
    s.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(80, () => s.clearTint());
  }

  update(_time: number, delta: number) {
    const s = this.active;
    s.setDepth(DEPTH.actors + s.y); // y-sort by feet
    const { sprite } = this.party.active;
    // Placeholders show facing with a dot; real art shows it with the animation.
    this.facingDot.setVisible(!sprite).setPosition(s.x + this.facing.x * 5, s.y - 14 + this.facing.y * 5).setDepth(s.depth + 0.5);
    if (sprite) {
      const speed = s.body.velocity.length();
      const { row, flip } = sheetDir(this.dir);
      const run = `${sprite}/run-${row}`;
      const running = this.sprinting && this.anims.exists(run);
      const key = running ? run : `${sprite}/${speed > 5 ? 'walk' : 'idle'}-${row}`;
      s.setFlipX(flip).play(key, true);
      // Playback follows speed, so feet don't slide while speeding up or slowing down. Full rate at sprint speed for the
      // run and at walk speed for the walk (a character without a run plays its walk faster while sprinting).
      const full = this.moveParams(this.party.active, running).maxSpeed;
      s.anims.timeScale = speed > 5 ? Phaser.Math.Clamp((speed / full) * tuning.animSpeed, 0.3, 2) : 1;
    }
    this.rig.update(s.body.velocity, this.moveParams(this.party.active, this.sprinting).maxSpeed, delta / 1000);
    this.drawStamina(s, delta / 1000);
  }

  /** A thin bar under the active character's feet, hidden while full. Red while winded, flashing while exhausted. */
  private drawStamina(s: CharSprite, dt: number) {
    const st = this.party.stamina[this.party.activeIndex];
    const g = this.staminaBar.clear();
    this.drawSweat(g, s, st.exhausted, dt);
    if (st.value >= 1) return;
    const w = 14, x = Math.round(s.x - w / 2), y = Math.round(s.y + 2);
    const flashOff = st.exhausted && Math.floor(this.time.now / 150) % 2 === 1;
    g.fillStyle(flashOff ? 0x7a2a36 : 0x241520).fillRect(x - 1, y - 1, w + 2, 4);
    g.fillStyle(st.winded ? 0xb4443a : 0xf2a846).fillRect(x, y, Math.round(w * st.value), 2);
  }

  /** Sweat drops popping off the head while exhausted: 1×2 px, light water blues from the palette. */
  private drawSweat(g: Phaser.GameObjects.Graphics, s: CharSprite, exhausted: boolean, dt: number) {
    if (exhausted && this.time.now >= this.nextSweat) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.sweat.push({ x: s.x + side * 5, y: s.y - 26, vx: side * (10 + Math.random() * 10), vy: -30, age: 0 });
      this.nextSweat = this.time.now + 250;
    }
    this.sweat = this.sweat.filter((d) => (d.age += dt) < 0.45);
    for (const d of this.sweat) {
      d.vy += 160 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      g.fillStyle(0x8edcf2).fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
      g.fillStyle(0xe6faf6).fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    }
  }

}
