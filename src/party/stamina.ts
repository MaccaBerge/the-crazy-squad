export type StaminaTuning = {
  drainTime: number; // s of sprinting to empty a full bar
  regenTime: number; // s to refill an empty bar
  regenDelay: number; // s after sprinting stops before refilling starts, so tapping Shift can't keep it topped up
  recoverAt: number; // 0..1: a winded character can't sprint again until the bar is back to this
  exhaustTime: number; // s of exhaustion right after the bar runs dry
  exhaustSlow: number; // walk speed multiplier while exhausted
};

export const defaultStamina: StaminaTuning = { drainTime: 3.5, regenTime: 2.5, regenDelay: 0.7, recoverAt: 0.4, exhaustTime: 1.2, exhaustSlow: 0.7 };

/** One character's sprint stamina. Pure logic; off-stage characters keep ticking with `sprinting = false`. */
export class Stamina {
  value = 1; // 0..1
  winded = false; // ran dry; no sprinting until `recoverAt`
  private restLeft = 0;
  private exhaustedLeft = 0;

  constructor(private readonly tuning: StaminaTuning) {}

  /** Just ran dry: physically spent for `exhaustTime`, walking slower. */
  get exhausted() {
    return this.exhaustedLeft > 0;
  }

  /** Multiplier on walk speed: `exhaustSlow` while exhausted, else 1. */
  get speedFactor() {
    return this.exhausted ? this.tuning.exhaustSlow : 1;
  }

  get canSprint() {
    return !this.winded && this.value > 0;
  }

  /** Empty it at once, as if it just ran dry: winded and exhausted. */
  empty() {
    this.value = 0;
    this.winded = true;
    this.exhaustedLeft = this.tuning.exhaustTime;
    this.restLeft = this.tuning.regenDelay;
  }

  /** `sprinting`: sprint held while moving. Returns whether the character actually sprints this step. */
  tick(dt: number, sprinting: boolean): boolean {
    const t = this.tuning;
    this.exhaustedLeft = Math.max(0, this.exhaustedLeft - dt);
    if (sprinting && this.canSprint) {
      this.value = Math.max(0, this.value - dt / t.drainTime);
      this.restLeft = t.regenDelay;
      if (this.value === 0) [this.winded, this.exhaustedLeft] = [true, t.exhaustTime];
      return true;
    }
    this.restLeft -= dt;
    if (this.restLeft <= 0) this.value = Math.min(1, this.value + dt / t.regenTime);
    if (this.winded && this.value >= t.recoverAt) this.winded = false;
    return false;
  }
}
