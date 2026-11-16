import type { CharacterDef } from '../characters/types';
import type { Action } from '../input/actions';

export const SWAP_ACTIONS = ['swapNext', 'swapPrev', 'swap1', 'swap2', 'swap3', 'swap4'] as const satisfies readonly Action[];
export type SwapAction = (typeof SWAP_ACTIONS)[number];
export type SwapResult = 'ok' | 'cooldown' | 'same' | 'no-room';

/**
 * The four squad members: who's on the map and the swap cooldown (players blueprint §2).
 * Pure logic. The scene moves sprites around when a swap succeeds.
 */
export class Party {
  activeIndex = 0;
  cooldownLeft = 0;

  constructor(
    readonly members: readonly CharacterDef[],
    private readonly tuning: { swapCooldown: number },
  ) {}

  get active() {
    return this.members[this.activeIndex];
  }

  /** 1 right after a swap, 0 when swapping is allowed again. */
  get cooldownFraction() {
    return this.tuning.swapCooldown > 0 ? this.cooldownLeft / this.tuning.swapCooldown : 0;
  }

  tick(dt: number) {
    this.cooldownLeft -= dt;
    if (this.cooldownLeft < 1e-6) this.cooldownLeft = 0; // float leftovers from many small steps
  }

  /** The member index a swap action asks for. */
  targetFor(action: SwapAction): number {
    const n = this.members.length;
    if (action === 'swapNext') return (this.activeIndex + 1) % n;
    if (action === 'swapPrev') return (this.activeIndex - 1 + n) % n;
    return Number(action.slice(4)) - 1;
  }

  /** Swap to `target` if allowed. `fits` says whether that member's body has room where the active one stands. */
  trySwap(target: number, fits: (def: CharacterDef) => boolean): SwapResult {
    if (target === this.activeIndex) return 'same';
    if (this.cooldownLeft > 0) return 'cooldown';
    if (!fits(this.members[target])) return 'no-room';
    this.activeIndex = target;
    this.cooldownLeft = this.tuning.swapCooldown;
    return 'ok';
  }
}
