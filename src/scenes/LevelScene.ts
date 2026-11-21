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
import { DEPTH, TILE, TILE_LAYERS } from '../world/constants';
import { loadMap, preloadMap } from '../world/loadMap';
import { spawnEntities } from '../world/spawner';
import { DOG_KINDS, Dogs, isDogKind, preloadDogs } from '../dogs/dogs';
import { BREEDS } from '../dogs/breeds';
import { DogAI } from '../dogs/dogAI';
import type { Vec } from '../movement';
import { comboStep, inArc, type Swing, swingPhase } from '../combat/swing';
import { ringSlots, separation } from '../ai/separation';
import { HUNTING } from '../ai/dogBrain';
import { SLOWMO } from '../abilities/slowmo';
import { SpeedFx } from '../abilities/speedFx';
import { registerFilters } from '../fx/filters';
import { Shimmer } from '../fx/shimmer';
import { Shockwave, shockwaveAt } from '../fx/shockwave';

const MAP = new URLSearchParams(location.search).get('map') ?? 'test'; // dev: ?map=backyard
// Dev: ?grass=20000 covers the map in that many blades, with an fps readout (nature blueprint §8, step 2).
const STRESS_BLADES = Number(new URLSearchParams(location.search).get('grass')) || 0;
const NUDGE_SPEED = 0.6; // corner assist sideways speed, as a share of top speed
const HURT = 0.18; // seconds a hit pushes you around before your input counts again
const SPARK = 140; // ms a hit spark lasts
const SLOW_IN = 0.12; // s for the world to ease down into slow-mo (it snaps back at the end)
const ATTACK_SLOW = 0.4; // share of walking speed while swinging: you can creep, not run (combat blueprint §3)

/** Live-tunable values (T panel). Character stats multiply the movement values. */
// Walking is the default; holding sprint raises speed to sprintSpeed while stamina lasts.
// animSpeed: multiplier on walk/run playback, to match feet to ground.
export const tuning = {
  walkSpeed: 62, sprintSpeed: 115, accel: defaultMove.accel, decel: defaultMove.decel, ...defaultStamina,
  cameraLerp: 0.15, lookahead: 24, swapCooldown: 4, animSpeed: 1,
  iframes: 0.8, swapSafe: 0.3, // s: can't be hit again after a hit / right after swapping in
  hitstop: 50, heavyHitstop: 80, // ms the world freezes when a hit lands (combat blueprint §5)
  packSpace: 22, packPush: 1.5, // px dogs keep between them, and how hard they steer apart
  warnRange: 160, // px a dog that's after you warns packmates across, even ones that can't see you
  packRing: 18, // px from you to each hunting dog's spot in the ring (inside their reach, so they can still bite)
  slowmo: 0.3, // world speed during Christian's slow-mo (everything but him)
  slowmoSpeed: 1.6, // and his own speed and acceleration then, so he looks even faster next to the slowed world
  speedLightning: 0, // 1: lightning off his body and along his trail during slow-mo; 0: afterimages only (testing)
  streak: 1, // 1: the afterimage is one merged shape with a colour and fade gradient; 0: separate copies, ghostGap apart
  fxShockwave: 1, waveRadius: 160, waveStrength: 4, waveMs: 450, // shader ring when slow-mo starts and ends (shader blueprint §6)
  fxShimmer: 1, shimmerStrength: 1, // heat haze behind Christian while he runs in slow-mo
  ghostGap: 2, // px between afterimages: 2 blends them into one smooth streak, 10 or 14 shows separate figures
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
  private pack: Phaser.GameObjects.GameObject[] = []; // thinking dogs' sprites; colliders read this array live, so spawned dogs just join it
  private nav?: SolidAt;
  private sight?: SolidAt;
  private spawned = 0;
  private hurt = 0;
  private swing?: { def: Swing; step: number; t: number; hit: Set<DogAI> };
  private combo = { step: -1, since: 0 }; // the last combo step swung, and s since it ended
  private sparks: { x: number; y: number; at: number; big: boolean }[] = []; // hit sparks, drawn for SPARK ms
  private swingFx!: Phaser.GameObjects.Graphics;
  private frozenUntil = 0;
  private knock: Vec = { x: 0, y: 0 };
  private readout?: HTMLDivElement;
  private slowmo = false; // Christian's slow-mo is running
  private slow = 1; // world speed now: eases down to tuning.slowmo while slow-mo runs
  private worldT = 0; // s of world time, the clock nature runs on: slowed in slow-mo
  private shade!: Phaser.GameObjects.Rectangle; // darkens the world, but not the lightning drawn above it
  private vignette!: Phaser.Filters.Vignette;
  private baseZoom = 1;
  private speedFx!: SpeedFx;
  private wave?: Shockwave; // undefined without WebGL: no shaders then
  private shimmer?: Shimmer;
  private waveFrom = { x: 0, y: 0, at: -Infinity, size: 1 }; // world point, start time, and 1 = full size

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
    this.combo = { step: -1, since: 0 };
    this.sparks = [];
    this.frozenUntil = 0;
    this.slowmo = false;
    this.slow = 1;
    this.worldT = 0;
    const { map, layers, colliders } = loadMap(this, MAP);
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
    this.pack = this.brains.map((d) => d.sprite);
    const blockers = [...colliders, ...this.trees.bodies, ...this.dogs.sprites];
    this.physics.add.collider(this.sprites, [...blockers]);
    this.physics.add.collider(this.sprites, this.pack);
    this.physics.add.collider(this.pack, blockers);
    this.physics.add.collider(this.pack, this.pack); // dogs bump into each other: nobody gets pushed, the overlap is split
    // What dogs can't see through: tiles with blocksSight (default: colliding Walls tiles, see the world blueprint) and
    // trees whose type has blocksSight.
    const tileBlocksSight: SolidAt = (tx, ty) => TILE_LAYERS.some((name) => {
      const tile = layers[name]?.getTileAt(tx, ty);
      const own = (tile?.properties as { blocksSight?: boolean } | undefined)?.blocksSight;
      return !!tile && (own ?? (name === 'Walls' && tile.collides));
    });
    this.sight = this.navGrid(map.width, map.height, this.trees.sightBlocks, tileBlocksSight);
    const nav = (this.nav = this.navGrid(map.width, map.height, [...this.trees.bodies, ...this.dogs.sprites.map((d) => d.body as Phaser.Physics.Arcade.Body)]));
    for (const d of this.brains) Object.assign(d, { nav, sight: this.sight });
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

    // Dev: the mouse wheel or -/+ zooms the view out and in, 0 resets. For testing only: below 1× the pixels shimmer.
    const cam = this.cameras.main;
    this.speedFx = new SpeedFx(this);
    // Slow-mo's look: the world darkens under the lightning and the screen edges glow orange. Off until it runs
    // (filters cleared first: a restart reuses the camera).
    this.shade = this.add.rectangle(0, 0, 1, 1, 0xffffff).setOrigin(0).setDepth(DEPTH.effects - 3).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    cam.filters.internal.clear();
    this.vignette = cam.filters.internal.addVignette(0.5, 0.5, 0.9, 0, SLOWMO.orange, Phaser.BlendModes.ADD).setActive(false);
    cam.filters.external.clear();
    this.wave = this.shimmer = undefined;
    this.waveFrom.at = -Infinity;
    if (registerFilters(this.game)) {
      this.shimmer = cam.filters.external.add(new Shimmer(cam)) as Shimmer;
      this.wave = cam.filters.external.add(new Shockwave(cam)) as Shockwave;
    }
    const zoomTo = (z: number) => cam.setZoom(Phaser.Math.Clamp(z, 0.25, 3));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => zoomTo(cam.zoom * Math.exp(-dy * 0.002))); // smooth on trackpads too
    this.input.keyboard!.on('keydown-MINUS', () => zoomTo(cam.zoom / 1.25));
    this.input.keyboard!.on('keydown-PLUS', () => zoomTo(cam.zoom * 1.25));
    this.input.keyboard!.on('keydown-ZERO', () => zoomTo(1));

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
    const ability = this.party.abilities[this.party.activeIndex];
    // A press on the cooldown stays buffered, like swapping; one with no ability to use is dropped.
    if (intent.pressed.has('ability1') && (!ability || ability.start())) {
      this.controller.consume('ability1');
      if (ability?.def.id === 'slowmo') this.startSlowmo();
    }
    if (this.slowmo && !this.party.abilities.some((a) => a?.active)) this.endSlowmo();
    this.slow = this.slowmo ? this.slow + (tuning.slowmo - this.slow) * Math.min(1, dt / SLOW_IN) : 1;
    for (const d of this.brains) d.timeScale = this.slow;

    const s = this.active;
    const pack = this.brains.filter((d) => !d.out), feet = pack.map((d) => d.sprite);
    // Every dog that's after you gets its own spot round you. The closest ones that fit (packSpace apart) take the inner
    // ring, within biting reach; the rest wait in an outer ring and step in as spots free up (dog AI blueprint §5).
    const hunters = pack.filter((d) => HUNTING.has(d.state)).sort((a, b) => Phaser.Math.Distance.BetweenPoints(a.sprite, s) - Phaser.Math.Distance.BetweenPoints(b.sprite, s));
    const fit = Math.max(1, Math.floor((Math.PI * 2 * tuning.packRing) / tuning.packSpace));
    const slots = new Map<DogAI, Vec>();
    for (const [ring, group] of [[tuning.packRing, hunters.slice(0, fit)], [tuning.packRing + tuning.packSpace, hunters.slice(fit)]] as const)
      ringSlots(s, group.map((d) => d.sprite), ring).forEach((p, i) => slots.set(group[i], p));
    // The nav grid also counts off-map tiles, trunks and standing dogs as blocked: a spot there would send a dog searching for nowhere.
    const open = (p?: Vec) => (p && this.nav && !this.nav(toTile(p.x), toTile(p.y - 3)) ? p : undefined);
    // Dogs that can see you warn every packmate within warnRange, so the whole gang comes, not only the ones with you in
    // sight. A warned dog passes it on only once it sees you itself, so the news never spreads further than the eyes.
    const trackers = pack.filter((d) => d.seesTarget).map((d) => d.sprite);
    const told = (d: DogAI) => trackers.some((o) => o !== d.sprite && Phaser.Math.Distance.BetweenPoints(o, d.sprite) <= tuning.warnRange);
    pack.forEach((d, i) => d.step(dt, s, tuning, (push, damage) => this.hit(push, damage), { crowd: separation(feet, i, tuning.packSpace), slot: open(slots.get(d)), told: told(d) }));
    for (const d of this.brains) if (d.out) d.step(dt, s, tuning, () => {}); // knocked out: only its timers run
    if (!this.active.active) return; // squad wiped, restarting
    this.attack(intent.pressed.has('attack'), dt);
    if (this.hurt > 0) {
      // Knocked back: the push fades out and your input waits, so the hit reads.
      this.hurt = Math.max(0, this.hurt - dt);
      s.body.setVelocity(this.knock.x * (this.hurt / HURT), this.knock.y * (this.hurt / HURT));
      return;
    }
    const p = this.moveParams(this.party.active, this.sprinting && !this.swing);
    if (this.slowmo) (p.maxSpeed *= tuning.slowmoSpeed), (p.accel *= tuning.slowmoSpeed); // legs speed up too: animation follows speed
    if (this.swing) p.maxSpeed *= ATTACK_SLOW;
    // Exhausted (bar just ran dry): walk slower. Animation speed still compares to the normal walk, so the legs look heavy.
    p.maxSpeed *= this.party.stamina[this.party.activeIndex].speedFactor;
    const v = stepVelocity(s.body.velocity, intent.move, dt, p);
    const b = s.body;
    const nudge = cornerNudge({ x: b.x, y: b.y, w: b.width, h: b.height }, intent.move, b.blocked, this.solid);
    if (nudge?.x) v.x = nudge.x * p.maxSpeed * NUDGE_SPEED;
    if (nudge?.y) v.y = nudge.y * p.maxSpeed * NUDGE_SPEED;
    b.setVelocity(v.x, v.y);
    const sw = this.swing;
    if (sw?.def.lunge && swingPhase(sw.def, sw.t) === 'active')
      b.setVelocity((this.facing.x * sw.def.lunge) / sw.def.active, (this.facing.y * sw.def.lunge) / sw.def.active);

    if (this.swing) return; // facing is locked from windup to the end of recovery, so a swing can't turn mid-arc
    if (intent.move.x || intent.move.y) {
      const len = Math.hypot(intent.move.x, intent.move.y);
      this.facing = { x: intent.move.x / len, y: intent.move.y / len };
    }
    this.dir = snapDir(this.dir, intent.move);
  }

  /** The active character's basic attack (combat blueprint §3): start it on a press, hit dogs in the arc while it's active. */
  private attack(pressed: boolean, dt: number) {
    const steps = this.party.active.attack;
    if (!this.swing) this.combo.since += dt;
    if (pressed && !this.swing && this.hurt <= 0) {
      this.controller.consume('attack'); // while swinging the press stays buffered, so mashing chains swings
      const step = steps && comboStep(steps.length, this.combo.step, this.combo.since);
      if (steps && step !== undefined) this.swing = { def: steps[step], step, t: 0, hit: new Set() };
    }
    const sw = this.swing;
    if (!sw) return;
    sw.t += dt;
    const phase = swingPhase(sw.def, sw.t);
    if (phase === 'done') {
      this.combo = { step: sw.step, since: 0 };
      return void (this.swing = undefined);
    }
    if (phase !== 'active') return;
    const s = this.active, f = this.facing;
    for (const d of this.brains) {
      if (d.out || sw.hit.has(d) || !inArc(sw.def, s, f, d.sprite)) continue;
      sw.hit.add(d);
      if (!d.takeHit(sw.def.damage, { x: f.x * sw.def.knockback, y: f.y * sw.def.knockback })) continue;
      this.freeze(sw.def.hitstop ?? (sw.def.heavy ? tuning.heavyHitstop : tuning.hitstop));
      this.sparks.push({ x: d.sprite.x - f.x * 5, y: d.sprite.y - 10 - f.y * 3, at: this.time.now, big: !!sw.def.shake });
      if (sw.def.shake) this.cameras.main.shake(90, 0.006);
    }
  }

  /**
   * Hit freeze: a few ms where nothing moves, so a hit lands with weight.
   * shortcut: pauses the whole physics world, not only the two involved; fine while fights are small.
   */
  private freeze(ms: number) {
    const world = this.physics.world;
    this.frozenUntil = Math.max(this.frozenUntil, this.time.now + ms);
    world.pause(); // update() resumes it
  }

  /** Christian's slow-mo starts: a beat of freeze, then the camera pushes in while the world winds down. */
  private startSlowmo() {
    this.slowmo = true;
    this.freeze(80);
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    this.baseZoom = cam.zoom;
    this.tweens.add({ targets: cam, zoom: this.baseZoom * SLOWMO.zoom, duration: 250, ease: 'Cubic.Out' });
    this.shockwave(this.active, 1);
  }

  /** A shader ring from a character's chest; `size` 1 is the full slow-mo start, smaller for lesser moments. */
  private shockwave(s: CharSprite, size: number) {
    this.waveFrom = { x: s.x, y: s.y - 13, at: this.time.now, size };
  }

  /** Time snaps back (ran out, or swapped out): every saved-up knockback lands at once, and the camera snaps out. */
  private endSlowmo() {
    this.slowmo = false;
    this.slow = 1;
    for (const a of this.party.abilities) a?.end();
    let landed = false;
    for (const d of this.brains) {
      d.timeScale = 1;
      if (!d.release()) continue;
      landed = true;
      this.sparks.push({ x: d.sprite.x, y: d.sprite.y - 10, at: this.time.now, big: true });
    }
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    this.tweens.add({ targets: cam, zoom: this.baseZoom, duration: 160, ease: 'Cubic.In' });
    cam.shake(landed ? 160 : 100, landed ? 0.008 : 0.004);
    this.shockwave(this.active, 0.6); // time snapping back: smaller and quicker
    if (landed) this.freeze(tuning.heavyHitstop);
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
    Object.assign(d, { nav: this.nav, sight: this.sight });
    this.pack.push(d.sprite);
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
   * A tile grid of `base` tiles plus any tile one of `bodies` touches: what dogs path around (trunks, standing dogs) or
   * can't see through (sight blockers).
   * shortcut: built once, so it doesn't know about things that move or appear later; rebuild it when they exist.
   */
  private navGrid(w: number, h: number, bodies: { x: number; y: number; width: number; height: number }[], base: SolidAt = this.solid): SolidAt {
    const blocked = new Uint8Array(w * h);
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) blocked[ty * w + tx] = base(tx, ty) ? 1 : 0;
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
    if (this.slowmo) this.endSlowmo(); // slow-mo is Christian's alone
    this.combo = { step: -1, since: 0 };
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
    this.swing = undefined; // a hit interrupts your attack, and its combo
    this.combo = { step: -1, since: 0 };
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
    // Checked every frame against the clock: a timer here ran on smoothed frame time and could fire early, leaving the world paused for good.
    if (this.frozenUntil && this.time.now >= this.frozenUntil) {
      this.frozenUntil = 0;
      this.physics.world.resume();
    }
    const s = this.active;
    this.worldT += (delta / 1000) * this.slow;
    const worldDt = Math.min(delta / 1000, 0.05) * this.slow;
    // y-sort by feet. In slow-mo he's lifted over the darkening and his own light (SpeedFx), so he stays in full colour.
    // shortcut: that also draws him over tree tops and roofs while it lasts; sort him under Above if it shows.
    s.setDepth(this.slowmo ? DEPTH.effects - 2.5 : DEPTH.actors + s.y);
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
      const sw = this.swing, hit = sw?.def.anim && this.anims.get(`${sprite}/${sw.def.anim}-${row}`);
      if (sw && hit) {
        // The attack animation runs once over the swing, frame picked by how far into it we are.
        const total = sw.def.windup + sw.def.active + sw.def.recovery, n = hit.frames.length;
        s.anims.stop();
        s.setFlipX(flip).setFrame(hit.frames[Math.min(n - 1, Math.floor((sw.t / total) * n))].textureFrame);
      } else s.setFlipX(flip).play(key, true);
      // Playback follows speed, so feet don't slide while speeding up or slowing down. Full rate at sprint speed for the
      // run and at walk speed for the walk (a character without a run plays its walk faster while sprinting).
      const full = this.moveParams(this.party.active, running).maxSpeed;
      s.anims.timeScale = speed > 5 ? Phaser.Math.Clamp((speed / full) * tuning.animSpeed, 0.3, 2) : 1;
    }
    this.rig.update(s.body.velocity, this.moveParams(this.party.active, this.sprinting).maxSpeed, delta / 1000);
    this.drawStamina(s, delta / 1000);
    this.drawSwing(s);
    this.drawSlowmo(s);
    this.drawShaders(s);
    if (this.windView.visible) this.drawWind();
    this.trees.update(this.worldT, (delta / 1000) * this.slow, tuning, s);
    this.leaves.update(this.worldT, worldDt, tuning);
    this.hanging.update(this.worldT, worldDt, tuning);
    this.look.update(Math.min(delta / 1000, 0.05), tuning.light);
    this.dogs.face(this.active.x, this.active.y - 8);
    for (const d of this.brains) d.update(this.time.now, this.physics.world.drawDebug);
    if (this.grass) {
      const start = performance.now();
      const forces = [footForce(s.x, s.y, this.party.active.body.w)];
      const changed = this.grass.update(this.cameras.main.worldView, this.worldT, (delta / 1000) * this.slow, tuning, forces);
      const ms = performance.now() - start;
      if (this.readout && this.game.getFrame() % 30 === 0)
        this.readout.textContent = `${STRESS_BLADES} blades · ${this.grass.pushed} pushed · ${changed} re-posed in ${ms.toFixed(2)} ms · ${this.game.loop.actualFps.toFixed(0)} fps`;
    }
  }

  /**
   * Slow-mo on screen: the world darkens to a warm dusk under the lightning so it blazes, the screen edges glow orange, and
   * SpeedFx puts the lightning, trail and light on Christian. All of it follows how far the world has slowed.
   * The bolts at the screen edges are the HUD's.
   */
  private drawSlowmo(s: CharSprite) {
    const k = this.slowmo && tuning.slowmo < 1 ? Phaser.Math.Clamp((1 - this.slow) / (1 - tuning.slowmo), 0, 1) : 0;
    this.shade.setVisible(k > 0);
    this.vignette.setActive(k > 0);
    this.speedFx.update(this.time.now, s, k, { bolts: tuning.speedLightning > 0, gap: tuning.ghostGap, streak: tuning.streak > 0 });
    if (!k) return;
    const view = this.cameras.main.worldView, c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(SLOWMO.shade), 1, k);
    this.shade.setPosition(view.x - 8, view.y - 8).setSize(view.width + 16, view.height + 16).setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    this.vignette.strength = SLOWMO.edgeGlow * k * (0.85 + 0.15 * Math.sin(this.time.now / 60)); // pulses
  }

  /** Our shader filters (shader blueprint §7): the shockwave ring and the heat haze behind Christian. Positions are screen px. */
  private drawShaders(s: CharSprite) {
    if (!this.wave || !this.shimmer) return;
    const cam = this.cameras.main, view = cam.worldView, now = this.time.now;
    const screen = (x: number, y: number) => [(x - view.x) * cam.zoom, (y - view.y) * cam.zoom];
    const w = this.waveFrom, t = (now - w.at) / (tuning.waveMs * (0.5 + 0.5 * w.size));
    this.wave.setActive(tuning.fxShockwave > 0 && t >= 0 && t < 1);
    if (this.wave.active) {
      const { radius, strength } = shockwaveAt(t, tuning.waveRadius * w.size, tuning.waveStrength * w.size);
      [this.wave.x, this.wave.y] = screen(w.x, w.y);
      Object.assign(this.wave, { radius: radius * cam.zoom, strength, thickness: 10 * cam.zoom });
    }
    const v = s.body.velocity, speed = v.length();
    this.shimmer.setActive(tuning.fxShimmer > 0 && this.slowmo && speed > 10);
    if (this.shimmer.active) {
      [this.shimmer.x, this.shimmer.y] = screen(s.x - (v.x / speed) * 14, s.y - 12 - (v.y / speed) * 14); // just behind him
      Object.assign(this.shimmer, { radius: 18 * cam.zoom, strength: tuning.shimmerStrength * Math.min(1, speed / 150), time: now / 1000 });
    }
  }

  /** Placeholder for the wrench: a pale arc sweeping across the front during the active part, fading in recovery. */
  private drawSwing(s: CharSprite) {
    const g = this.swingFx.clear(), sw = this.swing;
    this.drawSparks(g);
    if (!sw) return;
    const d = sw.def, into = sw.t - d.windup;
    if (into < 0) return;
    const a = Math.atan2(this.facing.y, this.facing.x), f = this.facing;
    const sweep = Math.min(1, into / d.active), fade = into <= d.active ? 1 : 1 - (into - d.active) / d.recovery;
    if (d.streak) {
      // A jab: a short straight streak shooting out in front.
      const from = 4, to = from + (d.radius - from) * sweep, y = s.y - 9;
      g.lineStyle(1, 0xe6faf6, 0.8 * fade).lineBetween(s.x + f.x * from, y + f.y * from, s.x + f.x * to, y + f.y * to);
      return;
    }
    const half = ((d.arc / 2) * Math.PI) / 180;
    g.lineStyle(2, 0xe6faf6, 0.9 * fade).beginPath().arc(s.x, s.y - 6, d.radius - 6, a - half, a - half + 2 * half * sweep).strokePath();
  }

  /** Hit sparks: a burst of short rays where a hit landed, growing and fading over SPARK ms. Big ones for kicks and the wrench. */
  private drawSparks(g: Phaser.GameObjects.Graphics) {
    this.sparks = this.sparks.filter((p) => this.time.now - p.at < SPARK);
    for (const p of this.sparks) {
      const k = (this.time.now - p.at) / SPARK, r = (p.big ? 3 : 2) + k * (p.big ? 6 : 4), rays = p.big ? 8 : 6;
      g.fillStyle(0xfff6dc, 1 - k).fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + (p.big ? 0 : 0.4);
        g.fillStyle(i % 2 ? 0xf2a846 : 0xfff6dc, 1 - k).fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r * 0.7), 1, 1);
      }
    }
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
    if (st.value >= 1 || this.slowmo) return; // slow-mo sprints for free: no bar
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
