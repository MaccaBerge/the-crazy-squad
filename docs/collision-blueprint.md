# Collision blueprint

How things in The Crazy Squad touch, block, hit and detect each other: the four of you against the walls, against each other, against the dogs, and against everything they shoot. It builds on [the world blueprint](world-blueprint.md), which covers maps, layers and tile properties.

Like the world blueprint, this is a plan. Each part says when to build it, in [section 13](#13-build-order).

---

## 1. Principles

1. **Collision is for feel and fairness, not realism.** Every size and rule here is chosen to make the game feel good, and is meant to be tuned by playing.
2. **One shape per job.** Moving, getting hit, hitting and noticing things each use their own shape. Mixing them is the classic source of "I got hit but it didn't touch me" and "I'm stuck on a dog".
3. **Forgiving to players, both ways.** A player's hurtbox is a bit *smaller* than they look, and a dog's hurtbox is a bit *larger* than it looks. Near misses on you miss, and near misses by you land.
4. **Nothing blocks a teammate.** With four players on one screen, a friend standing in a doorway must never trap you. Players push each other softly and never hard-block.
5. **Who collides with whom is data.** A single matrix in one file decides which kinds of shapes interact, not checks scattered around the code.
6. **Arcade physics, used for what it's good at.** Phaser's Arcade physics does fast rectangle and circle checks, tile collision and spatial indexing. We add our own small layers on top for what it doesn't do: soft pushing, corner assist, damage and fast projectiles.

---

## 2. The four kinds of shape

Every entity can have up to four kinds of collision shape:

| Kind | Job | Physics | Example |
|---|---|---|---|
| **Body** | Moving and being blocked | `collide` (separates) | A player's feet against walls |
| **Hurtbox** | Can receive damage | `overlap` (detect only) | A dog's whole body |
| **Hitbox** | Deals damage | `overlap` | A sword swing, a bullet, a chihuahua's bite |
| **Sensor** | Notices something, without blocking or damage | `overlap` or plain distance maths | A dog's "I can see you" range, a "press E" range, a pickup magnet |

- The **body** is the entity's own Arcade body.
- **Hurtboxes, hitboxes and sensors** are separate invisible zone objects (Phaser `Zone` with an Arcade body) that follow their owner every frame. Each one knows its **owner** and **team**.
- A **hitbox lives only as long as the attack.** A sword swing creates a hitbox for a few frames, then removes it. A projectile *is* a hitbox that moves.

---

## 3. Sizes and shapes

### Bodies sit at the feet

The top-down standard: **the body covers only the feet**, a short, wide rectangle at the bottom of the sprite.
- Your head and shoulders can overlap the wall tile above you, which reads as standing *in front of* the wall. That's the depth effect players expect.
- Gaps feel generous. A 10 px wide body fits through a 1-tile (16 px) gap with 3 px to spare on each side, so lining up with doors isn't fiddly.

### Rectangles for bodies

Arcade physics separates bodies from **tiles as rectangles only**, even if a body is set to a circle. Bodies are therefore **rectangles**. Corner assist ([section 5](#5-movement-against-the-world)) gives the rounded-corner feel that people often reach for circles to get.

Hurtboxes, hitboxes and sensors may be **circles** where that fits better (round explosions, bite ranges, aggro radius), because they're only checked against other bodies.

### Starting sizes

All sizes are tunable. Sprite frame sizes come from the [art blueprint](art-animation-blueprint.md): characters are drawn on a **24×24 frame** (the character itself about 14–16 px wide and 18–22 px tall), chihuahuas on 16×16 and bulldogs on 24×24. Boxes are measured against the **drawn** character, not the empty frame around it, and bodies sit at the feet, which is also the sprite's origin.

| Entity | Body (feet) | Hurtbox | Notes |
|---|---|---|---|
| Player | 10×6, bottom-centre | 10×16 | Hurtbox a little smaller than the drawn character: forgiving |
| Chihuahua | 8×5 | 12×10 | Small and fast. Hurtbox larger than it looks: easy to hit. |
| Bulldog | 14×8 | 18×14 | Wide and heavy |
| Boss dog | per design | per design | Can use several hurtboxes, like a weak spot |
| Projectile | none, it *is* a hitbox | none | 4×4 or a circle with radius 2–3 |
| Turret, building | static body, full tile | as needed | Doesn't move |

Shapes are set per entity type in its factory, with `body.setSize(w, h)` and `body.setOffset(x, y)`. Never use the default "whole sprite" body.

---

## 4. Who interacts with whom: the collision matrix

Phaser supports up to 32 **collision categories** (bitmasks). We define them once in `src/collision/categories.ts`:

| Category | What's in it |
|---|---|
| `WORLD` | `Walls` and blocking `Ground` tiles, static props, closed doors |
| `PLAYER` | Player bodies |
| `DOG` | Dog bodies |
| `PLAYER_HURT` | Player hurtboxes |
| `DOG_HURT` | Dog hurtboxes (and anything else the players can damage: crates, dog turrets) |
| `PLAYER_ATTACK` | Player hitboxes and projectiles |
| `DOG_ATTACK` | Dog hitboxes and projectiles |
| `PICKUP` | Items on the ground |
| `SENSOR` | Zones and sensors that should be checked by physics |

The **matrix**: **C** means collide (blocks), **S** means soft push (our own, [section 6](#6-actor-against-actor-soft-pushing)), **O** means overlap (detect only), and empty means never checked.

|  | WORLD | PLAYER | DOG | PLAYER_HURT | DOG_HURT | PICKUP | SENSOR |
|---|---|---|---|---|---|---|---|
| **PLAYER** | C | S | S | | | O | O |
| **DOG** | C | S | S | | | | O |
| **PLAYER_ATTACK** | C¹ | | | | O | | |
| **DOG_ATTACK** | C¹ | | | O | | | |

¹ Only projectiles, and only tiles that block shots (`blocksShots`, which defaults to `collides`). Melee hitboxes **ignore** the world. They're so short-range that hitting through a wall rarely happens, and checking walls would make swings next to a wall feel bad.

Rules:
- The matrix lives as **data** in `categories.ts`. One function applies it, setting each body's category and mask, and creates the colliders and overlaps. A unit test checks that it's consistent.
- **Friendly fire is off.** Player attacks never test player hurtboxes. Turning it on later for a party mode would be one matrix change.
- **Attacks never test attacks.** Bullets pass through each other. If you ever want "shoot down the dog's projectile", that's a deliberate exception added to the matrix.
- Pairs that never interact are never checked, which is also the main performance win.

---

## 5. Movement against the world

### Wall sliding

Arcade separates on the X and Y axes separately, so pushing diagonally into a wall **slides along it**. That's already working in the test map. We keep the behaviour where, while sliding, you move at the speed of the free component, about 71% for a diagonal. If it ever feels bad, the fix is to give the full speed to the free axis when one axis is blocked. That's a few lines in `movement.ts`.

### Corner assist

The standard top-down trick, seen in classic adventure games: if you walk into a wall and **only the edge of your body** catches a corner, the game nudges you sideways around it instead of stopping you dead.
- **When:** the body is blocked on the axis you're pushing, you're only holding that one direction, and shifting the body sideways by **up to 5 px** (half the body width) would clear the obstacle.
- **What:** add a small sideways velocity toward the open side, about 60% of move speed, for that frame. It's a velocity nudge, not a teleport, so it stays smooth.
- **Where:** `src/collision/cornerAssist.ts`, a pure function that takes the body rectangle, the input and a "is this tile solid" query, and returns the nudge. It's unit-tested with small hand-made grids.

This matters most for doors and 1-tile gaps, where clipping a corner by a pixel feels like a bug.

### World bounds

Every body has `collideWorldBounds`, and the world size comes from the map (done in `loadMap.ts`).

### Terrain that blocks only some movers

Deep water and pits block **walkers** but not **flyers** or **swimmers** (see the world blueprint's terrain rules). They use a collider against the `Ground` layer with a `processCallback` that allows the collision only if the tile's terrain blocks this entity's `mover`. One collider covers all terrain kinds.

### Ledges (one-way)

Phaser tiles have per-edge collision flags (`collideUp`, `collideDown`, `collideLeft`, `collideRight`). A ledge tile gets a `ledge` property naming the direction you can jump down (`south`). The loader then turns off collision on that edge only, so you can hop down but not climb up.

### Multiple floors

Each body only collides with its **own floor's** layers, using a `processCallback` that compares `entity.floor` with the layer's floor. Stairs zones change `floor` (world blueprint, section 10).

### Querying terrain under your feet

To find what you're standing on, look up the single tile at the **centre of the feet**: `layer.getTileAtWorldXY(x, feetY)`. Don't use physics overlap against tilemap layers for this. Phaser's overlap with a tilemap layer checks **every** tile under the body, whatever its collision settings, which is slower and gives several answers.

---

## 6. Actor against actor: soft pushing

Hard collisions between moving actors (Arcade `collide`) cause jitter, getting stuck, and friends blocking doorways. The standard fix, used from swarm games to Minecraft's mobs, is **soft separation**: overlapping actors are pushed apart gently over a few frames.

- An **overlap** check (not collide) between actor bodies, using the `S` cells of the matrix.
- For each overlapping pair, push both apart along the line between their centres. The push is proportional to how deep they overlap, capped per frame, and split by **mass**, so a bulldog barely moves while a chihuahua gets shoved.
- The push is added to the next frame's velocity, so walls still stop it, and nobody gets pushed into a wall.
- `src/collision/separation.ts`, with the pair maths as a pure, unit-tested function.

| Pair | Behaviour |
|---|---|
| Player ↔ player | Gentle push, equal mass. You can walk through a crowd of friends, slightly slowed. |
| Dog ↔ dog | Push plus **separation steering** in the dog's AI (steer away from nearby dogs), so packs spread out and surround you instead of stacking into one blob |
| Player ↔ dog | Push by mass. Small dogs get shoved aside, and a charging bulldog shoves you. Damage comes from hitboxes, not from this push. |
| Anything ↔ turret or building | Real collision. These are **static or immovable** bodies in `WORLD`. |

For a boss that must never move, use `immovable` (Arcade never moves it). `pushable = false` is different: the body still gets separated, but it bounces velocity back at whatever hit it.

---

## 7. Damage: from touching to hurting

All damage goes through one pipeline in `src/collision/hits.ts`:

1. **Detect.** A hitbox overlaps a hurtbox of the other team (matrix `O`).
2. **Filter.**
   - **Hit once per attack:** each attack keeps a set of targets it has already hit, so a sword swing passing through a dog over 6 frames hits it once.
   - **Invincibility frames:** after taking damage, a hurtbox ignores hits for a short time (players about 0.6–1.0 s, dogs about 0.1–0.2 s), shown with flashing.
3. **Resolve.** Build a `Hit` with source, target, damage, knockback direction and strength, and flags like `piercing` or `stun`. Pass it to the target's `Health` component. Abilities can change the hit here, for example a shield cutting damage or a heavy character ignoring knockback.
4. **React.**
   - **Knockback:** a velocity impulse away from the source, which decays through the normal movement deceleration. Tuned by feel.
   - **Hitstop:** freeze the whole game for **2–5 frames (about 30–80 ms)**. Use it only on big hits like heavy attacks, kills and boss hits, because with four players everyone feels the freeze.
   - **Hit flash** on the target, plus a sound. Screen shake only for big moments.
   - Events (`hit`, `death`) so the HUD, score and effects can react without the damage code knowing about them.

Damage maths, i-frames and hit-once filtering are pure functions with unit tests. They're where bugs hide and where tuning happens.

---

## 8. Projectiles

- **Pooled:** each weapon type has a Phaser group of reusable projectiles. Firing takes one from the pool and hitting returns it, instead of creating and destroying objects.
- **Small hitboxes** that collide with the world (`blocksShots` tiles) and overlap the other team's hurtboxes.
- **On hit**, depending on the weapon: disappear, **pierce** (keep going, hitting each target once), or **bounce** off walls.
- **Lifetime:** each projectile disappears after a maximum time or distance.
- **No tunnelling:** Arcade has no protection against fast objects skipping through thin walls between frames. **Rule:** a projectile must not move more than **its own size plus half a tile per physics step**. At 60 steps per second with a 4 px bullet, that's (4 + 8) × 60 ≈ **720 px/s** max. For faster shots:
  - **Hitscan** (instant beams or snipers): cast a line with `layer.getTilesWithinShape(line)` for the first wall, then check hurtboxes along the line.
  - Or step the projectile's movement in smaller pieces.

---

## 9. Sensors and triggers

- **Zones** from the map (interiors, portals, stairs, hazards, level exit) are overlap sensors handled by the zone system in the world blueprint, which provides `onEnter` / `onExit`.
- **Small numbers, simple maths.** "Is a player within 80 px?" for a dog's aggro or a "press E" prompt is a plain **distance check**, not a physics body. With 4 players and a few dozen dogs, that's at most a few hundred subtractions per frame. Use physics sensors only when the shape matters or there are many targets.
- **Line of sight** for dogs and turrets: cast a line to the target and check for `Walls` tiles in between, the same as hitscan.

---

## 10. Performance

- Arcade's spatial index (RTree) is on by default and is fine up to thousands of bodies. Phaser recommends turning it off only above ~5000 dynamic bodies.
- The matrix is the main lever: pairs that never interact are never checked.
- Prefer **one collider per pair of groups** (for example `players` vs `walls`) over one per object.
- Physics runs at a **fixed 60 steps per second** (Arcade's default), so collisions behave the same on 60 Hz and 144 Hz screens.

---

## 11. Debug view

A key (**B** for boxes) toggles a debug overlay drawing:
- bodies in blue, hurtboxes in green, hitboxes in red, and sensors and zones in yellow
- the tile under each actor's feet, and corner-assist nudges as short arrows

This uses Arcade's built-in debug drawing plus a small overlay for our own shapes. It stays off by default and isn't in release builds.

---

## 12. Code layout

```
src/collision/
  categories.ts      categories + the matrix as data + applyMatrix()
  cornerAssist.ts    corner nudge (pure, tested)
  separation.ts      soft push between actors (pure pair maths, tested)
  hits.ts            Hit type, hit-once and i-frame filtering, resolve → events (tested)
  projectiles.ts     pooled projectile groups, tunnelling guard, hitscan helper
  debug.ts           the B overlay
```

Components from the world blueprint use these: `Hurtbox` and `Hitbox` create zone objects and register them in the right category, and `Health` receives `Hit`s.

---

## 13. Build order

1. **With the four characters** (world build order step 2): feet bodies, `categories.ts` with the matrix, corner assist, soft player ↔ player pushing, and the debug view.
2. **With the first dog:** dog bodies, dog ↔ dog and player ↔ dog pushing, hurtboxes, melee/contact hitboxes, the damage pipeline (hit-once, i-frames, knockback, flash).
3. **With the first weapon:** projectile pools, `blocksShots`, the tunnelling speed limit, hitstop on big hits.
4. **When a level needs it:** terrain blocking per mover, ledges, multiple floors, hitscan, line of sight.

---

## Sources

- Phaser 4.2.1 Arcade physics guide, bundled at `node_modules/phaser/skills/physics-arcade/SKILL.md` ([online copy](https://unpkg.com/phaser@4.2.1/skills/physics-arcade/SKILL.md)): collision categories (max 32), `immovable` vs `pushable`, tilemap-overlap checking every tile, RTree threshold, fixed 60 fps step, tile bias
- Phaser 4.2.1 source, `src/physics/arcade/tilemap/`: tile separation uses the body rectangle, with no circle handling
- [Hitboxes and hurtboxes (GameMaker / Amazon docs)](https://developer.amazon.com/docs/gamemaker/hitboxes-hurtboxes.html) and [hitbox and hurtbox in Godot 4 (GDQuest)](https://gdquest.com/library/hitbox_hurtbox_godot4): separate shapes, sizes as a tuning lever, larger enemy hurtboxes in single-player games
- [Why some hitboxes are so bad (PC Gamer)](https://www.pcgamer.com/why-some-hitboxes-are-so-bad)
- [Collision layers and masks (GDQuest)](https://www.gdquest.com/library/glossary/collision_layers_and_masks), [Unity layer-based collision](https://docs.unity3d.com/6000.1/Documentation/Manual/LayerBasedCollision.html) and [organising layers and masks (uhiyama-lab)](https://uhiyama-lab.com/en/notes/godot/collision-layers-masks-organization/): the collision matrix, and only enabling the pairs you need
- [TopDown Engine collisions docs](https://topdown-engine-docs.moremountains.com/collisions.html)
- [Moving around corners in a top-down tilemap game (Unity forum)](https://discussions.unity.com/t/moving-freely-around-corners-in-top-down-game-while-using-a-tilemap/589005), [auto-rounding corners (Construct forum)](https://construct.net/en/forum/construct-2/how-do-i-18/auto-round-corners-la-monaco-89715), [corner sliding / wall hugging (GDevelop forum)](https://forum.gdevelop.io/t/wall-hugging-pixel-strafing-automatic-repositioning/49702) and [getting stuck in corners (html5gamedevs)](https://html5gamedevs.com/topic/27667-stuck-in-the-corners-top-down-game): corner assist and nudges
- [Invincibility frames (bugnet)](https://bugnet.io/blog/how-to-implement-invincibility-frames), [knockback that feels good (bugnet)](https://bugnet.io/blog/how-to-implement-knockback-that-feels-good), [The book of bumpslash: player combat](https://buttondown.com/melodicambient/archive/the-book-of-bumpslash-player-combat/) and [hit feedback: hitstop, shake, knockback (uhiyama-lab)](https://uhiyama-lab.com/en/notes/unity/unity-game-feel-hit-feedback/): i-frames, knockback and hitstop
- [Enemies surrounding instead of blocking (Godot forum)](https://forum.godotengine.org/t/how-can-i-make-enemies-surround-their-target-instead-of-blocking-each-other-while-doing-so/6227), [reacting to collisions among chasing entities (gamedev.net)](https://gamedev.net/forums/topic/619843-how-to-react-to-collision-among-entities-chasing-the-player/), [NPCs clumping (Unity forum)](https://discussions.unity.com/t/how-to-prevent-my-npcs-from-clumping-up-while-chasing-a-common-target/825816), [E.T. Returns attack patterns devlog](https://therealmattkain.itch.io/et-returns/devlog/556760/et-returns-postmortemish-part-3-attack-patterns) and [Reynolds' steering behaviours](https://www.cs.princeton.edu/courses/archive/spr01/cs598b/papers/reynolds00.pdf): soft separation, mass-based yielding and separation steering
