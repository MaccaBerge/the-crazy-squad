export type StaminaTuning = {
  drainTime: number; // s of sprinting to empty a full bar
  regenTime: number; // s to refill an empty bar
  regenDelay: number; // s after sprinting stops before refilling starts, so tapping Shift can't keep it topped up
  recoverAt: number; // 0..1: a winded character can't sprint again until the bar is back to this
};

export const defaultStamina: StaminaTuning = { drainTime: 3.5, regenTime: 2.5, regenDelay: 0.7, recoverAt: 0.4 };

/** One character's sprint stamina. Pure logic; off-stage characters keep ticking with `sprinting = false`. */
export class Stamina {
  value = 1; // 0..1
  winded = false; // ran dry; no sprinting until `recoverAt`
  private restLeft = 0;

  constructor(private readonly tuning: StaminaTuning) {}

  get canSprint() {
    return !this.winded && this.value > 0;
  }

  /** `sprinting`: sprint held while moving. Returns whether the character actually sprints this step. */
  tick(dt: number, sprinting: boolean): boolean {
    const t = this.tuning;
    if (sprinting && this.canSprint) {
      this.value = Math.max(0, this.value - dt / t.drainTime);
      this.restLeft = t.regenDelay;
      if (this.value === 0) this.winded = true;
      return true;
    }
    this.restLeft -= dt;
    if (this.restLeft <= 0) this.value = Math.min(1, this.value + dt / t.regenTime);
    if (this.winded && this.value >= t.recoverAt) this.winded = false;
    return false;
  }
}
