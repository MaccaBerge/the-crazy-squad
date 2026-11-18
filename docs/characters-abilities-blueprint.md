# Characters and abilities blueprint

How Marcus, Kristian, Christian and Jonas become playable characters, and how their abilities work. Abilities come from each person's real-life skills. This builds on the [players, input and camera blueprint](players-input-camera-blueprint.md) (one character on the map, swapping with a cooldown, intents) and the collision blueprint (hitboxes, the damage pipeline).

---

## 1. Principles

1. **Characters are data plus a few shared systems.** A character is a definition (stats, body size, sprite, abilities) run by shared code. Adding a fifth character means one new definition file.
2. **Abilities are built from small effects.** Most abilities are a list of building blocks with timing, like "after 0.15 s, spawn a hitbox here" or "dash 48 px". Custom code is the exception.
3. **Dogs use the same system.** A bulldog's charge is an ability like any other. One system means one set of bugs, and every new effect is available to both sides.
4. **One place changes stats.** Speed, damage and cooldowns are changed only through a stat modifier layer, so bonuses stack predictably. Temtem: Swarm's team credits this for keeping 250+ abilities manageable.
5. **Every ability is readable.** It has a clear wind-up, a visible effect and a sound, for both the player and anyone watching.

---

## 2. What a character is

```ts
// src/characters/types.ts
type CharacterDef = {
  id: 'marcus' | 'kristian' | 'christian' | 'jonas';
  name: string;
  sprite: string;                 // texture / animation prefix, see the art blueprint
  body: { w: number; h: number }; // feet hitbox (collision blueprint)
  hurtbox: { w: number; h: number };
  stats: { maxHp: number; speed: number; accel: number; decel: number };
  mover: 'walker' | 'swimmer' | 'flyer';  // terrain rules (world blueprint)
  attack: AbilityId;              // basic attack
  abilities: [AbilityId, AbilityId];
  passive?: PassiveId;            // always-on trait
  verb?: WorldVerb;               // how this character interacts with puzzles
};
```

Each character has:

| Slot | What it is | Input |
|---|---|---|
| **Basic attack** | Short cooldown, always useful | `attack` |
| **Ability 1** | The character's signature move | `ability1` |
| **Ability 2** | A second tool, often defensive or for getting around | `ability2` |
| **Passive** | Always on, like "+20% speed on paths" or "takes less knockback" | (none) |
| **World verb** | A way to interact with the level, used by puzzles: `push`, `squeeze` (fits through small gaps), `swim`, `hack`, `climb`… | `interact`, or automatic |

The **world verb** is what makes "only Jonas can do this" puzzles work. It ties into the world blueprint: `swim` is the `swimmer` mover kind, `squeeze` is a smaller body plus `SmallGap` tiles, and `push` makes `Pushable` entities movable.

---

## 3. Turning real-life skills into characters

Roles and basic attacks were agreed in the [combat blueprint](combat-blueprint.md). For each of you, fill in this table, ideally together, since it's the fun part:

| | Marcus | Kristian | Christian | Jonas |
|---|---|---|---|---|
| Real-life skill or trait | | | | |
| Fantasy ("in the game, this means…") | | | | |
| Role | Control | Bruiser | Fast fighter | Ranged |
| Basic attack | Phone zap (short stun) | Wrench swing | Punch, punch, kick | Bandy shot (orange ball) |
| Ability 1 (signature) | Hack | Mechanic (to design) | Time-slow | Bandy (to design) |
| Ability 2 | | | | |
| Passive | | | | |
| World verb | | | | |

**Process:**
1. Start from the **fantasy**, not the mechanic. "Kristian is the strongest" leads to "Kristian shoves things and dogs around".
2. Give the four of you **different roles**, so swapping matters. A common set:

   | Role | Strong at | Typical tools |
   |---|---|---|
   | Bruiser | Up close, takes hits | Heavy melee, knockback, damage reduction |
   | Ranged | Safe damage | Projectiles, piercing |
   | Control | Managing packs | Stuns, slows, pulls, area effects |
   | Mobility / utility | Getting places, puzzles | Dashes, traps, decoys, healing |

3. Check each ability against **dogs, puzzles and swapping**: what is it good against, which puzzle needs it, and when would you swap *to* this character?
4. Make the **inside jokes** visible: the animation, sound or name sells the reference, while the mechanics stay simple.

**Examples** (placeholders, not decisions):
- Sporty → **Tackle:** dash forward and knock dogs back, briefly invulnerable during the dash.
- Gamer → **Hack:** take over a dog turret for 5 s. World verb `hack` opens electronic doors.
- Musician → **Air horn:** a cone that stuns dogs and makes them flee.
- Cook → **Snack drop:** drop a treat that distracts dogs, or heals whoever picks it up.

---

## 4. Abilities

### Definition

```ts
// src/abilities/types.ts
type AbilityDef = {
  id: string;
  cooldown: number;          // seconds
  charges?: number;          // several uses before the cooldown, default 1
  windup: number;            // seconds before the effect (telegraph)
  active: number;            // seconds the effect lasts (hitbox open, dash moving)
  recovery: number;          // seconds after, where you're committed
  movement: 'free' | 'slowed' | 'locked';  // can you walk while using it?
  effects: TimedEffect[];    // what happens, and when
  custom?: (ctx: AbilityContext) => void; // escape hatch for truly unique abilities
};
type TimedEffect = { at: number; effect: Effect }; // `at` = seconds after start
```

### Phases

Every ability runs through the same small state machine (`src/abilities/runner.ts`, pure and unit-tested):

```
ready ─(pressed)─► windup ─► active ─► recovery ─► (cooldown) ─► ready
```

- **Windup** is the telegraph. It matters most for dogs, but players benefit too, because heavy attacks *feel* heavy with a short windup.
- **Hitboxes only exist during `active`.** This is the standard rule that damage only comes from the active frames of the animation, never during the windup.
- **Buffered presses** (input blueprint) fire as soon as the ability is ready.
- **Getting hit** cancels the windup if the ability is `interruptible`, so dogs can be interrupted and players can be punished.

### Effect building blocks

`src/abilities/effects/` holds reusable effects. Most abilities need nothing else:

| Effect | Does |
|---|---|
| `hitbox` | Shape, offset (rotated to facing), damage, knockback, duration. Goes through the collision blueprint's hit pipeline. |
| `projectile` | Type, speed, count, spread, pierce or bounce. Uses the projectile pools. |
| `dash` | Distance, duration and optional invulnerability. Moves the body through physics, so walls still stop it. |
| `area` | Circle or cone around the user: damage, push, pull, or apply a status |
| `status` | Apply a status to self or targets (below) |
| `heal` / `shield` | Restore HP, or add a temporary shield |
| `spawn` | Place an entity: turret, decoy, trap, treat. Uses the entity registry. |
| `sound` / `vfx` / `shake` | Feedback only, which never changes gameplay |

A new ability is usually just a new list of these. A new **effect** is written only when nothing combines into what's needed, and every ability can then use it.

### Status effects

Shared by players and dogs: `stunned`, `slowed`, `burning`, `scared` (flees), `shielded`, `invulnerable`, `distracted` (dogs chase a treat).
- Each status has a duration and a **stacking rule**. The default is to refresh the duration and not stack the strength.
- Statuses change stats only through the stat modifier layer (next section).
- Shown with small icons over the target and in the HUD.

### Stats and modifiers

`src/abilities/stats.ts`: each character or dog has base stats. **Modifiers** (from passives, statuses or later upgrades) add or multiply, and are applied in one fixed order: base → additive → multiplicative → clamp. Nothing else writes stats directly, which keeps "why is Marcus so fast right now?" answerable.

---

## 5. Swapping and abilities

These rules follow the players blueprint:
- **Off-stage characters' cooldowns keep recharging.**
- **Statuses on a character pause while they're off stage**, so a stun doesn't run out while you're away. Using swapping to dodge a stun is fine, because the swap cooldown limits it.
- **Optional, later:** a **tag-in move**, where each character does a small effect when swapped in, like Kristian landing with a shove. It's a classic tag-team idea that rewards well-timed swaps. Leave it out until basic swapping feels good.

---

## 6. Code layout

```
src/
  characters/
    types.ts            CharacterDef
    marcus.ts  kristian.ts  christian.ts  jonas.ts    one definition each
    index.ts            all four, in swap order
  abilities/
    types.ts            AbilityDef, Effect, status types
    runner.ts           phase state machine, cooldowns, charges (tested)
    stats.ts            base stats + modifier stacking (tested)
    effects/            hitbox.ts, projectile.ts, dash.ts, area.ts, status.ts, spawn.ts …
    defs/               one file per ability, e.g. tackle.ts, airHorn.ts
```

---

## 7. Build order

1. **With the four placeholder characters:** `CharacterDef` for all four with stats and body sizes only, and different placeholder colours and speeds so swapping is visibly different.
2. **With the first dog:** the ability runner, the `hitbox` and `dash` effects, one basic attack per character, statuses `stunned` and `invulnerable`, and the stat layer.
3. **After the skills table is filled in:** signature abilities, passives and world verbs, one character at a time, each tested in a small test map.
4. **Later:** charges, tag-in moves, upgrades between levels.

---

## Sources

- [How the devs designed a scalable ability system for Temtem: Swarm (80.lv)](https://80.lv/articles/how-devs-designed-a-scalable-ability-system-for-temtem-swarm): shared base for cooldowns and activation, a single stat modifier layer
- [Building a data-driven ability and combat system (DEV Community)](https://dev.to/beefedai/building-a-data-driven-ability-combat-system-5217): abilities made from cost, cooldown, targeting and effect parts, plus lifecycle hooks
- [Unity Gameplay Ability System port](https://github.com/LLMUnityGameDevelopment/UnityGameplayAbilitySystem) and [Hyper ability system docs](https://gamesbyhyper.com/docs/combat/ability-system/): cooldowns, charges and designer-friendly ability data
- [Godot ability system pattern (skills.sh)](https://www.skills.sh/jame581/godotprompter/ability-system): abilities as data owned by a component, with signals for start, failure and cooldown
- [Enemy attacks and telegraphing (Game Developer)](https://gamedeveloper.com/design/enemy-attacks-and-telegraphing): telegraph vs windup
- [Building a better single-player and co-op experience (Cellar Door Games)](https://cellardoorgames.com/making-a-better-single-player-and-multiplayer-experience): cooldowns recharging while swapped out
