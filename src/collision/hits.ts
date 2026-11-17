// The damage pipeline's pure parts (collision blueprint §7): health, invincibility frames and being downed.
// Detecting the hit and reacting to it (knockback, flash) live with whoever lands it; this only decides what it does.

/** One character's or dog's health. Off-stage characters keep it while away. */
export class Health {
  hp: number;
  private safeLeft = 0;

  constructor(readonly max: number) {
    this.hp = max;
  }

  get down() {
    return this.hp <= 0;
  }

  /** Inside invincibility frames: hits are ignored. */
  get invulnerable() {
    return this.safeLeft > 0;
  }

  get fraction() {
    return this.hp / this.max;
  }

  /** Takes a hit and starts `iframes` seconds of invincibility. Returns the damage actually taken (0 if ignored). */
  take(damage: number, iframes: number): number {
    if (this.down || this.invulnerable || damage <= 0) return 0;
    const taken = Math.min(this.hp, damage);
    this.hp -= taken;
    this.safeLeft = iframes;
    return taken;
  }

  /** Invincible for at least `seconds`, e.g. the safety window right after swapping in. */
  protect(seconds: number) {
    this.safeLeft = Math.max(this.safeLeft, seconds);
  }

  tick(dt: number) {
    this.safeLeft -= dt;
    if (this.safeLeft < 1e-6) this.safeLeft = 0; // float leftovers from many small steps
  }
}
