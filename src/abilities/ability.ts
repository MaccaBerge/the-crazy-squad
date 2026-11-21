/** A signature ability (characters & abilities blueprint §4). `id` says which effect the scene runs. */
export type AbilityDef = { id: 'slowmo'; cooldown: number; duration: number };

/**
 * ready ─(start)─► active ─(runs out, or ended early)─► cooldown ─► ready. Pure, so it ticks off stage too.
 * shortcut: no windup, recovery or charges yet (blueprint §4); add them when an ability needs them.
 */
export class Ability {
  /** Seconds of effect left; 0 when not active. */
  left = 0;
  cooldownLeft = 0;

  constructor(readonly def: AbilityDef) {}

  get active() {
    return this.left > 0;
  }

  get ready() {
    return !this.active && this.cooldownLeft === 0;
  }

  /** 1 right when the cooldown starts, 0 when ready. */
  get cooldownFraction() {
    return this.def.cooldown > 0 ? this.cooldownLeft / this.def.cooldown : 0;
  }

  /** Starts it if ready. Returns whether it started. */
  start() {
    if (!this.ready) return false;
    this.left = this.def.duration;
    return true;
  }

  /** Ends it now (swapped out); the cooldown starts as if it ran out. */
  end() {
    if (!this.active) return;
    this.left = 0;
    this.cooldownLeft = this.def.cooldown;
  }

  tick(dt: number) {
    if (this.active) {
      this.left -= dt;
      if (this.left < 1e-6) (this.left = 0), (this.cooldownLeft = this.def.cooldown);
      return;
    }
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    if (this.cooldownLeft < 1e-6) this.cooldownLeft = 0; // float leftovers from many small steps
  }
}
