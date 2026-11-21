# Dog AI blueprint

How the dogs think: noticing the squad, chasing, attacking fairly, moving as a pack, and boss fights. It builds on:
- the [players, input and camera blueprint](players-input-camera-blueprint.md): dogs are driven by a `DogAI` controller that produces the same `Intent` as the player
- the [characters and abilities blueprint](characters-abilities-blueprint.md): dog attacks are abilities with windups
- the collision blueprint: soft separation, hitboxes, damage
- the [world blueprint](world-blueprint.md): navigation grid, patrol paths, zones

---

## 1. Principles

1. **Dogs play by the player's rules.** A dog is an entity with a body, health and abilities, driven by `Intent`. Its AI only decides *what to press*. Movement, collision and damage are the same code the squad uses.
2. **Sense → decide → act.** Perception (what the dog knows), decision (a small state machine) and action (turning a goal into an `Intent`) are kept separate, so tuning one doesn't tangle the others.
3. **Fair before smart.** Every attack is telegraphed, only a few dogs attack at once, and dogs don't attack from off screen. A fair dumb dog is more fun than an unfair clever one.
4. **Breeds are data.** A new breed is mostly a definition file: stats, senses, which states it uses, and its attacks.

---

## 2. Perception

`src/ai/perception.ts`, updated about 10 times a second per dog, with dogs spread across frames:

| Sense | How |
|---|---|
| **Sight** | The target is within `sightRange` and a line to it doesn't cross a `Walls` tile (the same line check as hitscan). An optional view cone for patrolling dogs, which see 360° once alerted. |
| **Hearing** | Gameplay emits **noise events** with a position and loudness, such as attacks, explosions, abilities like the air horn, and breaking things. Dogs within range hear them. |
| **Memory** | The last known target position and when it was seen. Dogs search there when they lose sight. |
| **Alerts from other dogs** | An alerted dog **barks** (a noise event), which wakes dogs nearby. Packs react together without any group code. |

Dogs only perceive the **character on the map**, since off-stage squad members don't exist in the world.

---

## 3. Decision: the state machine

`src/ai/dogBrain.ts`: a small finite state machine with named states, written as plain data plus functions so it can be unit-tested without Phaser.

```
            sees target                    in range + has token
 idle/patrol ──────────► alert ─► chase ──────────────────────► windup ─► attack ─► recover ─┐
     ▲   heard noise          │     │  no token: hover in ring                                  │
     └── investigate ◄─ lost ─┘     └──── low HP (some breeds) ─► flee                          │
     ▲                                                                                          │
     └──────────── gave up / too far from home (leash) ─► return ◄───────────────────────────┘
 any state ── hit hard ─► stagger ── (back to chase)          any state ── 0 HP ─► defeated
```

| State | Behaviour |
|---|---|
| `idle` | Stand, sniff around, play an idle animation |
| `patrol` | Walk a **patrol path** (a Tiled polyline the dog references), with pauses |
| `investigate` | Walk to a heard noise or last-seen spot, look around, then give up |
| `alert` | Short reaction: a "!" over the head, a bark, a brief pause of **0.2–0.4 s**. The player gets a moment to react. |
| `chase` | Move toward the target, using pathfinding when there's no direct line |
| `hover` | In range but without an **attack token** (section 5): circle at a distance and wait |
| `windup` | The **telegraph**: the attack's windup phase, with its own animation and sound. It lasts at least 0.3 s, longer for heavy attacks. |
| `attack` | The ability's active phase, where hitboxes exist |
| `recover` | The ability's recovery. The dog is **open to hits**, which is the reward for dodging. |
| `stagger` | Interrupted by a hit (if the attack was interruptible) |
| `flee` | Run away from the target, for timid breeds at low HP or when `scared` |
| `return` | Go back home when past the **leash distance** or after giving up |
| `defeated` | Death or knocked-out animation, then removed |

Statuses from the ability system override the brain: `stunned` freezes it, `scared` forces `flee`, and `distracted` makes it chase the treat.

---

## 4. Action: from goals to intents

The brain sets a **goal** (move to a point, keep a distance, face something, use an ability). `src/ai/steering.ts` turns it into an `Intent`:
- **Direct steering** when there's a clear line: move toward the point.
- **Pathfinding** when there isn't (section 6). Follow the path, aiming at the next cell centre.
- **Separation:** steer away from nearby dogs on top of the movement, so packs spread out instead of stacking (soft separation in the collision blueprint handles actual overlaps).
- **Ring movement** for `hover`: move around the target at a chosen radius.
- **Stuck detection:** no progress for about 1 s means get a new path, or take a small random sidestep.

Because the output is an `Intent`, dogs accelerate and slide with the same feel as the squad.

---

## 5. Pack fairness: attack tokens

To stop the whole pack hitting you in the same instant, the **target holds a small number of attack tokens**. A dog must take a token to start an attack, and gives it back when the attack ends or is interrupted. This pattern is widely credited to DOOM (2016).

| Token | Starting count | Used by |
|---|---|---|
| melee | 2 | Bites, nips |
| ranged | 2 | Thrown or spat attacks |
| heavy | 1 | Charges, slams |

- Dogs without a token **hover** in a ring around the target, ready to step in. The fight still looks busy, but hits arrive at a readable pace.
- When several dogs want a token, the one that's closest, has a clear line and has waited longest wins. A much better candidate can take a token from a dog still in `chase`, but never from one already in `windup`.
- **No off-screen attacks:** a dog can't take a token while it's off screen.
- The token counts are the main **difficulty dial** (easy: 1 melee, hard: 3).

`src/ai/tokens.ts` is a pure, unit-tested allocator.

---

## 6. Navigation

From the world blueprint's navigation grid (walkable cells per mover kind):
- **A\*** for one dog or a few needing a path. It's recomputed at most a few times per second, and only when the target moved more than a tile or the dog got stuck.
- **A flow field** once there are many dogs (around 15+): one grid of "which way to the character" computed a few times per second, and every dog just reads its cell. This is how swarm games handle hundreds of enemies cheaply. Since only one squad member is on the map, one flow field covers every dog.
- **Path smoothing:** skip waypoints when there's a straight line, so dogs don't zigzag cell by cell.
- **Special movement** for breeds, like a dachshund squeezing through `SmallGap` tiles, uses a different mover kind with its own walkable grid.

Start with direct steering only, and add A\* once walls trap dogs in the first real level.

---

## 7. Breeds

The first five dogs, picked from the concept sheet. Their art is in `art/dogs/` (PixelLab, 32×32, 8 directions, Marcus's style). They hold **no weapons**: guns, the shield, the club and the bombs are separate sprites placed by code, so they can aim freely, recoil and telegraph.

| Dog | Role | Attacks | Special |
|---|---|---|---|
| **Heavy Gunner** (Rottweiler) | Tank, dangerous up close | Pump shotgun: a wide, short cone. Slow pump between shots. | Barely knocked back. Never runs; slow and heavy is the threat. |
| **K-9 Cop** (German Shepherd) | Blocker | Baton swing; shield bash when you get close | The riot shield blocks shots from the front. He turns slowly, so you flank him. |
| **Long Shot** (Dachshund) | Sniper | Sniper rifle. A red laser line shows his aim before he fires. | Hides far away and backs off when you close in. |
| **Bruiser** (Bulldog) | Charger | **Charge:** a long wind-up, then a straight dash. Club swing up close. | Can't steer while charging. **Dizzy** for a moment if he hits a wall: your window to punish him. Takes a heavy token. |
| **Mad Bomber** (Pug) | Area denial | Lobs a lit bomb in an arc over cover. A ground circle and a faster-blinking fuse warn where it lands. | Small and quick, keeps away. You hear his snort (a noise event) before you see him. |

Later ideas: a **Chihuahua** swarm (fast, fragile, always in packs) and a **boss dog** with phases (section 8).

### 7.1 Speed and traits

Like the squad's `stats`, dog speeds are **multipliers** on one shared movement tuning, so the T panel still tunes them all at once. Size sets the starting point; traits can break it (the pug is the smallest and the fastest).

| Dog | Speed | Accel | Traits |
|---|---|---|---|
| Heavy Gunner | 0.7 | 0.5 | `heavy` (barely pushed), `noRun` |
| K-9 Cop | 1.0 | 1.0 | `shieldFront`, slow `turnRate` |
| Long Shot | 0.8 | 0.8 | `keepsDistance` |
| Bruiser | 0.8 (2.0 charging) | 0.7 | `heavy`, `chargeLocksSteering`, `dizzyOnWall` |
| Mad Bomber | 1.15 | 1.3 | `keepsDistance`, `snorts` |

All numbers are starting points for tuning in play.

### 7.2 Animations

Every dog shares a set of moves, plus one to three of its own for its attack. Only the **body** is animated in PixelLab; weapons, muzzle flash, recoil, bombs and lasers are code. Getting hit starts as code too (a white flash and knockback).

| Animation | Who | PixelLab clip |
|---|---|---|
| Idle | All | `breathing-idle` |
| Walk (played faster, it's also the jog) | All | `walking` |
| Run | All but the Heavy Gunner | `running-6-frames` |
| Death | All | `falling-back-death` |
| Heavy, stomping walk (replaces his walk) | Heavy Gunner | custom |
| Shield bash: a short lunge | K-9 Cop | custom |
| Crouch-aim and crouched sneak | Long Shot | `crouching`, `crouched-walking` |
| Charge wind-up, charge, dizzy | Bruiser | custom, `running-8-frames`, custom |
| Throw and panicked backpedal | Mad Bomber | `throw-object`, custom |

**Directions:** like the squad, only 5 are generated (south, south-east, east, north-east, north) and the left-facing ones are mirrored.

**Cost:** ready-made clips cost 1 generation per direction, and custom ones about 1 at 32 px, so about 5 generations per animation. The shared set is 19 animations (95) and the unique ones 9 (45): **about 140 generations** for all five dogs.

```ts
// src/dogs/types.ts
type BreedDef = {
  id: string; sprite: string;
  stats: { maxHp: number; speed: number; accel: number; decel: number; mass: number }; // speed and accel are multipliers (7.1)
  traits: string[];              // e.g. 'heavy', 'keepsDistance' (7.1)
  body: { w: number; h: number }; hurtbox: { w: number; h: number };
  mover: 'walker' | 'small' | 'flyer';
  senses: { sight: number; hearing: number; cone?: number };
  leash: number;                 // max distance from home before giving up
  states: DogState[];            // which states this breed uses (no flee for bulldogs…)
  attacks: { ability: AbilityId; token: 'melee' | 'ranged' | 'heavy'; range: [number, number] }[];
  fleeBelowHp?: number;
};
```

---

## 8. Bosses

- A boss is a dog with a **pattern script** instead of free choice: a list of attacks with weights, cooldowns and conditions ("slam when the player is close", "summon chihuahuas at 50% HP").
- **Phases** change the list at HP thresholds, with a short invulnerable "phase change" moment that's clearly shown.
- **Arena:** a `CameraBounds` zone locks the camera, and closing doors (signals) lock the room until the boss is defeated.
- Bosses ignore attack tokens for their own attacks. Their adds still use them.
- Fairness still applies: every boss attack is telegraphed, and fake-outs (an exaggerated windup followed by a different attack) are used sparingly, maybe once per phase.

---

## 9. Encounters

- Most dogs are **placed in Tiled** on the `Entities` layer with their breed, patrol path and home.
- **Ambushes:** a `Trigger` zone spawns or wakes a group when entered.
- **Waves** for arena moments: a `WaveSpawner` entity with a list of waves (breed and count) that waits until a wave is mostly defeated before sending the next.
- A **max active dogs** cap per level (about 30 to start) keeps performance and readability in check.

---

## 10. Debug view

The **B** debug overlay from the collision blueprint also shows, per dog:
- the current state name above its head
- sight range and cone, the last known target position, and the current path
- whether it holds an attack token

---

## 11. Code layout

```
src/
  ai/
    perception.ts     sight, hearing, memory, barks
    dogBrain.ts       state machine (tested)
    steering.ts       goals → Intent, separation, ring, stuck detection
    tokens.ts         attack token allocator (tested)
    nav.ts            A* + flow field (tested on small grids)
    noise.ts          noise events
  dogs/
    types.ts          BreedDef
    chihuahua.ts  bulldog.ts  dachshund.ts  boss-*.ts
    dogAI.ts          the DogAI controller tying it together
```

---

## 12. Build order

0. **Dog animations:** the shared set for all five, then the unique ones (7.2), built into sheets like the squad's.
1. **First dog:** `DogAI` with idle → alert → chase → windup → attack → recover, direct steering, sight without walls, one simple attack, and the debug labels.
2. **A small pack:** separation steering, attack tokens with hover rings, barks, and sight blocked by walls.
3. **First real level:** patrol paths, investigate and noise, leash and return, A\*.
4. **The rest of the five:** Bruiser charge with the heavy token, then K-9 Cop's shield, Long Shot's laser and Mad Bomber's lobbed bombs.
5. **Big fights:** flow field, wave spawner, the first boss with phases.

---

## Sources

- [Enemy attacks and telegraphing (Game Developer)](https://gamedeveloper.com/design/enemy-attacks-and-telegraphing): telegraph vs windup
- [Enemy AI behaviours (tech-studies)](https://iagodantasf.github.io/tech-studies/roadmaps/skill-based/openclaw/lessons/gameplay-systems/enemy-ai-behaviours) and [build a Godot 4 action-adventure, lesson 5: enemy AI and state patterns (gamineai)](https://gamineai.com/courses/build-godot-4-action-adventure-from-scratch/lessons/lesson-5-enemy-ai-and-state-patterns): named states (idle, pursue, windup, attack, recover, stagger, retreat), and separating perception, decision and action
- [Telegraphed attack pattern (Starship Survivors wiki)](https://starship-survivors-wiki.pages.dev/gameplay/concepts/telegraphed-attack-pattern) and [the art of the fakeout in combat design (Wayline)](https://www.wayline.io/blog/the-art-of-the-fakeout-combat-design): telegraphs only matter if there's time to react, and fake-outs used sparingly
- [Orchestrating enemy behaviours in a top-down shooter (remvst)](https://remvst.substack.com/p/orchestrating-enemy-behaviors-in) and [Phaser enemy AI guide (abratabia)](https://www.abratabia.com/phaser/ai-enemies.php)
- [Attack token system: group combat that feels fair (StraySpark)](https://www.strayspark.studio/blog/attack-token-system-ue5-group-combat-that-feels-fair), [Making combat feel good: fair, readable AI (itch.io devlog)](https://lghts.itch.io/iron-reclamation/devlog/1092177/making-combat-feel-good-fair-readable-and-responsive-ai), [How do simultaneous enemy attacks work? (Signals and Light)](https://signalsandlight.substack.com/p/how-do-simultaneous-enemy-attacks) and [Battle circle AI (Envato Tuts+)](https://code.tutsplus.com/battle-circle-ai-let-your-player-feel-like-theyre-fighting-lots-of-enemies--gamedev-13535t): token pools on the target, token counts, scoring and stealing, spectator rings
- [Reynolds' steering behaviours](https://www.cs.princeton.edu/courses/archive/spr01/cs598b/papers/reynolds00.pdf): separation steering
