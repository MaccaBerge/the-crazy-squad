import type { CharacterDef } from '../characters/types';
import { Ability } from '../abilities/ability';
import { Health } from '../collision/hits';
import type { Action } from '../input/actions';
import { Stamina, type StaminaTuning } from './stamina';

export const SWAP_ACTIONS = ['swap1', 'swap2', 'swap3', 'swap4'] as const satisfies readonly Action[];
export type SwapAction = (typeof SWAP_ACTIONS)[number];
export type SwapResult = 'ok' | 'cooldown' | 'same' | 'no-room' | 'downed';

/**
 * The four squad members: who's on the map, the swap cooldown, health and going down (players blueprint §2).
 * Pure logic. The scene moves sprites around when a swap succeeds.
 */
export class Party {
  activeIndex = 0;
  cooldownLeft = 0;
  /** One per member, kept and refilling while off stage. */
  readonly stamina: Stamina[];
  /** One per member, kept while off stage. A downed member (0 HP) stays out. */
  readonly health: Health[];
  /** Each member's ability1, recharging while off stage (blueprint §5). */
  readonly abilities: (Ability | undefined)[];

  constructor(
    readonly members: readonly CharacterDef[],
    // swapSafe: seconds the incoming member can't be hit, so swapping into a crowd isn't an instant hit
    private readonly tuning: { swapCooldown: number; swapSafe?: number } & StaminaTuning,
  ) {
    this.stamina = members.map(() => new Stamina(tuning));
    this.health = members.map((m) => new Health(m.stats.maxHp));
    this.abilities = members.map((m) => m.ability1 && new Ability(m.ability1));
  }

  get active() {
    return this.members[this.activeIndex];
  }

  /** 1 right after a swap, 0 when swapping is allowed again. */
  get cooldownFraction() {
    return this.tuning.swapCooldown > 0 ? this.cooldownLeft / this.tuning.swapCooldown : 0;
  }

  /** `sprinting`: the active member holds sprint while moving. Returns whether they actually sprint this step. */
  tick(dt: number, sprinting = false): boolean {
    this.cooldownLeft -= dt;
    if (this.cooldownLeft < 1e-6) this.cooldownLeft = 0; // float leftovers from many small steps
    for (const h of this.health) h.tick(dt);
    for (const a of this.abilities) a?.tick(dt);
    return this.stamina.map((s, i) => s.tick(dt, sprinting && i === this.activeIndex))[this.activeIndex];
  }

  /** The member index a swap action asks for. */
  targetFor(action: SwapAction): number {
    return Number(action.slice(4)) - 1;
  }

  /** The next member in `step` direction who isn't downed, or undefined if nobody else is standing. */
  private nextStanding(step: 1 | -1): number | undefined {
    const n = this.members.length;
    for (let k = 1; k < n; k++) {
      const i = (this.activeIndex + step * k + n * k) % n;
      if (!this.health[i].down) return i;
    }
  }

  /** Swap to `target` if allowed. `fits` says whether that member's body has room where the active one stands. */
  trySwap(target: number, fits: (def: CharacterDef) => boolean): SwapResult {
    if (target === this.activeIndex) return 'same';
    if (this.health[target].down) return 'downed';
    if (this.cooldownLeft > 0) return 'cooldown';
    if (!fits(this.members[target])) return 'no-room';
    this.enter(target);
    return 'ok';
  }

  /**
   * The active member just went down: swap to the next one standing, ignoring the cooldown (and starting it again).
   * Returns false when the whole squad is down.
   */
  forceSwap(): boolean {
    const next = this.nextStanding(1);
    if (next === undefined) return false;
    this.enter(next);
    return true;
  }

  private enter(target: number) {
    this.activeIndex = target;
    this.cooldownLeft = this.tuning.swapCooldown;
    this.health[target].protect(this.tuning.swapSafe ?? 0);
  }
}
