import * as Phaser from 'phaser';
import { type Dir, sheetDir, snapDir } from '../art/facing';
import { characterTexture, FRAME, makePlaceholderTextures } from '../art/placeholders';
import { createAnims, preloadSprites } from '../art/sprites';
import { defaultStamina } from '../party/stamina';
import { CameraRig } from '../camera/cameraRig';
import { SQUAD } from '../characters';
import type { CharacterDef } from '../characters/types';
import { cornerNudge, rectFree, type SolidAt } from '../collision/cornerAssist';
import { toTile } from '../world/grid';
import { LocalController } from '../input/localController';
import { defaultMove, stepVelocity } from '../movement';
import { Party, SWAP_ACTIONS, type SwapAction } from '../party/party';
import { DEFAULT_WEATHER, isWeather, WEATHER } from '../nature/weather';
import { footForce } from '../nature/forces';
import { bladesFromMap, Grass, scatter } from '../nature/grass';
import { Hanging } from '../nature/hanging';
import { WeatherLook } from '../nature/weatherLook';
import { FallingLeaves } from '../nature/leaves';
import { preloadTrees, Trees } from '../nature/trees';
import { gust, windAt } from '../nature/wind';
import { DEPTH, TILE } from '../world/constants';
import { loadMap, preloadMap } from '../world/loadMap';
import { spawnEntities } from '../world/spawner';
import { DOG_KINDS, Dogs, isDogKind, preloadDogs } from '../dogs/dogs';
import { BREEDS } from '../dogs/breeds';
import { DogAI } from '../dogs/dogAI';
import type { Vec } from '../movement';
import { inArc, type Swing, swingPhase } from '../combat/swing';

const MAP = new URLSearchParams(location.search).get('map') ?? 'test'; // dev: ?map=backyard
// Dev: ?grass=20000 covers the map in that many blades, with an fps readout (nature blueprint §8, step 2).
const STRESS_BLADES = Number(new URLSearchParams(location.search).get('grass')) || 0;
const NUDGE_SPEED = 0.6; // corner assist sideways speed, as a share of top speed
const HURT = 0.18; // seconds a hit pushes you around before your input counts again
const ATTACK_SLOW = 0.4; // share of walking speed while swinging: you can creep, not run (combat blueprint §3)

/** Live-tunable values (T panel). Character stats multiply the movement values. */
// Walking is the default; holding sprint raises speed to sprintSpeed while stamina lasts.
// animSpeed: multiplier on walk/run playback, to match feet to ground.
export const tuning = {
  walkSpeed: 62, sprintSpeed: 115, accel: defaultMove.accel, decel: defaultMove.decel, ...defaultStamina,
  cameraLerp: 0.15, lookahead: 24, swapCooldown: 4, animSpeed: 1,
  iframes: 0.8, swapSafe: 0.3, // s: can't be hit again after a hit / right after swapping in
  hitstop: 50, heavyHitstop: 80, // ms the world freezes when a hit lands (combat blueprint §5)
  ...WEATHER[DEFAULT_WEATHER], // replaced by the map's weather on load
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
  private party!: Party;
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
  private windView!: Phaser.GameObjects.Graphics;
  private grass?: Grass;
  private trees!: Trees;
  private leaves!: FallingLeaves;
  private hanging!: Hanging;
  private look!: WeatherLook;
  private dogs!: Dogs;
  private brains: DogAI[] = [];
  private blockers: (Phaser.Tilemaps.TilemapLayer | Phaser.GameObjects.GameObject | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody)[] = []; // what a spawned dog bumps into
  private nav?: SolidAt;
  private spawned = 0;
  private hurt = 0;
  private swing?: { def: Swing; t: number; hit: Set<DogAI> };
  private swingFx!: Phaser.GameObjects.Graphics;
  private frozenUntil = 0;
  private knock: Vec = { x: 0, y: 0 };
  private readout?: HTMLDivElement;

  constructor() {
    super('level');
  }

  private get active() {
    return this.sprites[this.party.activeIndex];
  }

  preload() {
    preloadMap(this, MAP);
    preloadSprites(this, SQUAD);
    preloadDogs(this);
    preloadTrees(this);
  }

  create() {
    // A restart (whole squad down) reuses this scene object, so everything per-run starts fresh here.
    this.party = new Party(SQUAD, tuning);
    this.brains = [];
    this.hurt = 0;
    this.swing = undefined;
    this.frozenUntil = 0;
    const { map, colliders } = loadMap(this, MAP);
    const weather = (map.properties as { name: string; value: unknown }[]).find((p) => p.name === 'weather')?.value;
    Object.assign(tuning, WEATHER[isWeather(weather) ? weather : DEFAULT_WEATHER]);
    this.solid = (tx, ty) => colliders.some((l) => l.getTileAt(tx, ty)?.collides);
    makePlaceholderTextures(this, SQUAD);
    createAnims(this, SQUAD);

    const blades = STRESS_BLADES
      ? scatter({ x: 0, y: 0, w: map.widthInPixels, h: map.heightInPixels }, STRESS_BLADES, 1)
      : bladesFromMap(map.getObjectLayer('Grass')?.objects ?? []).filter((b) => !this.solid(Math.floor(b.x / TILE), Math.floor(b.y / TILE))); // no grass in water or walls
    if (blades.length) this.grass = new Grass(this, blades, map.widthInPixels, DEPTH.actors);
    if (STRESS_BLADES) {
      this.readout = document.body.appendChild(document.createElement('div'));
      this.readout.style.cssText = 'position:fixed;bottom:8px;right:8px;padding:4px 8px;background:#000a;color:#fff;font:13px monospace;border-radius:4px;pointer-events:none';
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.readout?.remove());
    }

    let spawn = { x: map.widthInPixels / 2, y: map.heightInPixels / 2 };
    this.dogs = new Dogs(this);
    spawnEntities(map, {
      PlayerSpawn: (o) => (spawn = { x: o.x ?? spawn.x, y: o.y ?? spawn.y }),
      Dog: (o, p) => {
        if (!isDogKind(p.kind)) return console.warn(`Dog ${o.id}: unknown kind "${p.kind}"`);
        if (p.ai === true) this.brains.push(new DogAI(this, p.kind, BREEDS[p.kind], o.x ?? 0, o.y ?? 0));
        else this.dogs.add(p.kind, o.x ?? 0, o.y ?? 0, typeof p.anim === 'string' ? { anim: p.anim, dir: String(p.dir ?? 'south') } : undefined);
      },
    });

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
    this.trees = new Trees(this, map.getObjectLayer('Trees')?.objects ?? []);
    const thinking = this.brains.map((d) => d.sprite);
    this.blockers = [...colliders, ...this.trees.bodies, ...this.dogs.sprites];
    this.physics.add.collider(this.sprites, [...this.blockers, ...thinking]);
    this.physics.add.collider(thinking, this.blockers);
    const nav = (this.nav = this.navGrid(map.width, map.height, [...this.trees.bodies, ...this.dogs.sprites.map((d) => d.body as Phaser.Physics.Arcade.Body)]));
    for (const d of this.brains) d.nav = nav;
    this.leaves = new FallingLeaves(this, this.trees.sources);
    this.hanging = new Hanging(this, map.getObjectLayer('Hanging')?.objects ?? []);
    this.look = new WeatherLook(this, tuning.light);
    this.facingDot = this.add.image(0, 0, 'dot');
    this.staminaBar = this.add.graphics().setDepth(DEPTH.effects);
    this.swingFx = this.add.graphics().setDepth(DEPTH.effects);

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

    // Dev: N drops a fighting dog near you, cycling through the breeds.
    this.input.keyboard!.on('keydown-N', (e: KeyboardEvent) => !e.repeat && this.spawnDog()); // holding N spawns one, not a stream

    // Dev: V shows the wind as arrows, one per tile (nature blueprint §8, step 1).
    this.windView = this.add.graphics().setDepth(DEPTH.effects).setVisible(false);
    this.input.keyboard!.on('keydown-V', () => this.windView.setVisible(!this.windView.visible));

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
    for (const d of this.brains) d.step(dt, s, tuning, (push, damage) => this.hit(push, damage));
    if (!this.active.active) return; // squad wiped, restarting
    this.attack(intent.pressed.has('attack'), dt);
    if (this.hurt > 0) {
      // Knocked back: the push fades out and your input waits, so the hit reads.
      this.hurt = Math.max(0, this.hurt - dt);
      s.body.setVelocity(this.knock.x * (this.hurt / HURT), this.knock.y * (this.hurt / HURT));
      return;
    }
    const p = this.moveParams(this.party.active, this.sprinting && !this.swing);
    if (this.swing) p.maxSpeed *= ATTACK_SLOW;
    // Exhausted (bar just ran dry): walk slower. Animation speed still compares to the normal walk, so the legs look heavy.
    p.maxSpeed *= this.party.stamina[this.party.activeIndex].speedFactor;
    const v = stepVelocity(s.body.velocity, intent.move, dt, p);
    const b = s.body;
    const nudge = cornerNudge({ x: b.x, y: b.y, w: b.width, h: b.height }, intent.move, b.blocked, this.solid);
    if (nudge?.x) v.x = nudge.x * p.maxSpeed * NUDGE_SPEED;
    if (nudge?.y) v.y = nudge.y * p.maxSpeed * NUDGE_SPEED;
    b.setVelocity(v.x, v.y);

    if (this.swing) return; // facing is locked from windup to the end of recovery, so a swing can't turn mid-arc
    if (intent.move.x || intent.move.y) {
      const len = Math.hypot(intent.move.x, intent.move.y);
      this.facing = { x: intent.move.x / len, y: intent.move.y / len };
    }
    this.dir = snapDir(this.dir, intent.move);
  }

  /** The active character's basic attack (combat blueprint §3): start it on a press, hit dogs in the arc while it's active. */
  private attack(pressed: boolean, dt: number) {
    const def = this.party.active.attack;
    if (pressed && !this.swing && this.hurt <= 0) {
      this.controller.consume('attack'); // while swinging the press stays buffered, so mashing chains swings
      if (def) this.swing = { def, t: 0, hit: new Set() };
    }
    const sw = this.swing;
    if (!sw) return;
    sw.t += dt;
    const phase = swingPhase(sw.def, sw.t);
    if (phase === 'done') return void (this.swing = undefined);
    if (phase !== 'active') return;
    const s = this.active, f = this.facing;
    for (const d of this.brains) {
      if (d.out || sw.hit.has(d) || !inArc(sw.def, s, f, d.sprite)) continue;
      sw.hit.add(d);
      if (d.takeHit(sw.def.damage, { x: f.x * sw.def.knockback, y: f.y * sw.def.knockback })) this.freeze(sw.def.heavy ? tuning.heavyHitstop : tuning.hitstop);
    }
  }

  /**
   * Hit freeze: a few ms where nothing moves, so a hit lands with weight.
   * shortcut: pauses the whole physics world, not only the two involved; fine while fights are small.
   */
  private freeze(ms: number) {
    const world = this.physics.world;
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms);
    world.pause();
    this.time.delayedCall(ms, () => this.time.now >= this.frozenUntil - 1 && world.resume());
  }

  /** Dev spawn: the next breed, on the first free spot about 4 tiles from you. */
  private spawnDog() {
    const kind = DOG_KINDS[this.spawned++ % DOG_KINDS.length], breed = BREEDS[kind];
    const s = this.active, bounds = this.physics.world.bounds;
    // Each spawn starts the search one step further round, so several dogs don't land in a pile.
    const at = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i + this.spawned * 3) * Math.PI / 4).map((a) => ({ x: s.x + Math.cos(a) * 64, y: s.y + Math.sin(a) * 64 }))
      .find((p) => bounds.contains(p.x, p.y) && rectFree({ x: p.x - 6, y: p.y - 6, w: 12, h: 6 }, this.solid));
    if (!at) return this.flash(s, 0xff4040); // boxed in: nowhere to put one
    const d = new DogAI(this, kind, breed, at.x, at.y);
    d.nav = this.nav;
    this.physics.add.collider(d.sprite, this.blockers);
    this.physics.add.collider(this.sprites, d.sprite);
    this.brains.push(d);
  }

  private trySwap(action: SwapAction) {
    const from = this.active;
    const result = this.party.trySwap(this.party.targetFor(action), (def) => this.fits(def, from.x, from.y));
    // A press that lands on the cooldown stays buffered, so pressing just before it ends still swaps.
    if (result !== 'cooldown') this.controller.consume(action);
    if (result === 'no-room' || result === 'downed') this.flash(from, 0xff4040);
    if (result === 'ok') this.swapIn(from);
  }

  /**
   * Tiles dogs path around: solid tiles plus any tile a trunk or standing dog's body touches.
   * shortcut: built once, so it doesn't know about things that move or appear later; rebuild it when they exist.
   */
  private navGrid(w: number, h: number, bodies: { x: number; y: number; width: number; height: number }[]): SolidAt {
    const blocked = new Uint8Array(w * h);
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) blocked[ty * w + tx] = this.solid(tx, ty) ? 1 : 0;
    for (const b of bodies)
      for (let ty = toTile(b.y); ty <= toTile(b.y + b.height - 0.001); ty++)
        for (let tx = toTile(b.x); tx <= toTile(b.x + b.width - 0.001); tx++) if (tx >= 0 && ty >= 0 && tx < w && ty < h) blocked[ty * w + tx] = 1;
    return (tx, ty) => tx < 0 || ty < 0 || tx >= w || ty >= h || blocked[ty * w + tx] === 1;
  }

  /** The party already switched members: put the new one where `from` stood. */
  private swapIn(from: CharSprite) {
    const to = this.active;
    const { x: vx, y: vy } = from.body.velocity;
    this.swing = undefined; // swapping cancels whatever the old one was doing
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

  /** A dog's attack reached the active character (collision blueprint §7): damage, knockback, flash, maybe going down. */
  private hit(push: Vec, damage: number) {
    const i = this.party.activeIndex, health = this.party.health[i];
    if (!health.take(damage, tuning.iframes)) return; // invincible: no push either
    this.freeze(tuning.hitstop);
    this.swing = undefined; // a hit interrupts your attack
    this.hurt = HURT;
    this.knock = push;
    this.flash(this.active, 0xb4443a);
    if (!health.down) return;
    // Down: forced swap to the next one standing, ignoring the cooldown (players blueprint §2). Nobody left: start over.
    const from = this.active;
    this.hurt = 0;
    if (this.party.forceSwap()) return this.swapIn(from);
    // shortcut: no checkpoints yet, so a wipe restarts the level; restart from the last checkpoint once they exist.
    offStage(from);
    this.time.delayedCall(800, () => {
      this.scene.stop('hud');
      this.scene.restart();
    });
  }

  private flash(s: CharSprite, color: number) {
    s.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(80, () => s.clearTint());
  }

  update(_time: number, delta: number) {
    const s = this.active;
    s.setDepth(DEPTH.actors + s.y); // y-sort by feet
    // Invincibility frames show as flicker.
    s.setAlpha(this.party.health[this.party.activeIndex].invulnerable && Math.floor(this.time.now / 60) % 2 ? 0.3 : 1);
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
    this.drawSwing(s);
    if (this.windView.visible) this.drawWind();
    this.trees.update(this.time.now / 1000, delta / 1000, tuning, s);
    this.leaves.update(this.time.now / 1000, Math.min(delta / 1000, 0.05), tuning);
    this.hanging.update(this.time.now / 1000, Math.min(delta / 1000, 0.05), tuning);
    this.look.update(Math.min(delta / 1000, 0.05), tuning.light);
    this.dogs.face(this.active.x, this.active.y - 8);
    for (const d of this.brains) d.update(this.time.now, this.physics.world.drawDebug);
    if (this.grass) {
      const start = performance.now();
      const forces = [footForce(s.x, s.y, this.party.active.body.w)];
      const changed = this.grass.update(this.cameras.main.worldView, this.time.now / 1000, delta / 1000, tuning, forces);
      const ms = performance.now() - start;
      if (this.readout && this.game.getFrame() % 30 === 0)
        this.readout.textContent = `${STRESS_BLADES} blades · ${this.grass.pushed} pushed · ${changed} re-posed in ${ms.toFixed(2)} ms · ${this.game.loop.actualFps.toFixed(0)} fps`;
    }
  }

  /** Placeholder for the wrench: a pale arc sweeping across the front during the active part, fading in recovery. */
  private drawSwing(s: CharSprite) {
    const g = this.swingFx.clear(), sw = this.swing;
    if (!sw) return;
    const d = sw.def, into = sw.t - d.windup;
    if (into < 0) return;
    const half = ((d.arc / 2) * Math.PI) / 180, a = Math.atan2(this.facing.y, this.facing.x);
    const sweep = Math.min(1, into / d.active), fade = into <= d.active ? 1 : 1 - (into - d.active) / d.recovery;
    g.lineStyle(2, 0xe6faf6, 0.9 * fade).beginPath().arc(s.x, s.y - 6, d.radius - 6, a - half, a - half + 2 * half * sweep).strokePath();
  }

  /** One arrow per tile in view, pointing where the wind blows there: length is its strength, orange where a gust is passing. */
  private drawWind() {
    const g = this.windView.clear();
    const view = this.cameras.main.worldView;
    const t = this.time.now / 1000;
    for (let y = Math.floor(view.y / TILE) * TILE + TILE / 2; y < view.bottom; y += TILE)
      for (let x = Math.floor(view.x / TILE) * TILE + TILE / 2; x < view.right; x += TILE) {
        const w = windAt(x, y, t, tuning);
        g.lineStyle(1, gust(x, y, t, tuning) > 0.3 ? 0xf2a846 : 0x8edcf2).lineBetween(x, y, x + w.x * 12, y + w.y * 12);
        g.fillStyle(0x241520).fillRect(x - 0.5, y - 0.5, 1, 1);
      }
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
