# World, grid and tiles blueprint

How The Crazy Squad builds its world: the grid, maps, layers, collision, drawing order and everything placed on the map. The goal is that adding a new enemy, weapon, turret, building, water, bridge, staircase, portal or anything else is a small, predictable change, usually **one Tiled class plus one TypeScript file**.

This is a plan, not a list of things to build now. Each section says what to build first and what to wait on until a level needs it.

---

## 1. Core principles

1. **Levels are data, behaviour is code.** Maps are drawn in the **Tiled** editor. Code never hard-codes where walls or enemies are. Code only defines what a `Dog` or a `Portal` *does*.
2. **Tiles for the static world, entities for everything that acts.** Ground, walls and water are tiles. Anything that moves, reacts, can be destroyed or has state (enemies, doors, turrets, pickups, switches) is an entity placed on an object layer.
3. **Properties over special cases.** Whether a tile blocks movement, is water or slows you down comes from properties on the tile in the tileset, never from checking tile numbers in code.
4. **Composition over inheritance.** Entities are built from small, reusable parts (health, team, hitbox, interactable…), not from deep class trees like `Enemy → FlyingEnemy → FlyingShootingEnemy`.
5. **Everything is pixel-exact.** World visuals are textures (tilemap layers, sprites, images), never `Graphics` or shapes, because Phaser 4 only snaps textured objects to whole pixels. We learned this from the stutter bug.
6. **Fixed names and numbers live in one place.** Layer names, depth bands, tile size and collision categories are constants in `src/world/constants.ts`.

---

## 2. Grid and units

| Thing | Value | Why |
|---|---|---|
| Tile size | **16×16 px** | The pixel-art standard for top-down games, with plenty of free tilesets at this size |
| Game resolution | **320×240 px** (20×15 tiles) | Already set up. The game scales up to fit the window. |
| Character sprite | 16×16 (up to 16×24 for tall characters) | Fits the grid, and a tall sprite can overlap the tile above for a sense of depth |
| World units | **Pixels** for positions and physics, **tiles** for map and AI logic | Phaser works in pixels, while pathfinding and placement think in tiles |

Rules:
- Positions are stored in pixels. Convert to tiles only when you need to: `tileX = Math.floor(x / TILE)`, and from tile to pixel centre: `x = tileX * TILE + TILE / 2`. Both live as helpers in `src/world/grid.ts`.
- Movement is **free (pixel-based)**, not locked to the grid. That's what we tuned in `movement.ts`. The grid is for building the world, not for restricting the player.
- Scale up only by **whole numbers** (×2, ×3…) where possible. `Scale.FIT` can give in-between sizes, and if pixels ever look uneven, switch to integer zoom.

---

## 3. Map authoring: Tiled

We use **[Tiled](https://www.mapeditor.org/)** (free). It has the most established path into Phaser, which loads Tiled JSON directly. LDtk is nicer to use in some ways, but it has no maintained Phaser 4 importer, so we'd have to write and maintain one.

### Files

```
assets/
  maps/            level-01.tmj, level-02.tmj, house-interior.tmj …   (Tiled JSON maps)
  tilesets/        terrain.png + terrain.tsj, buildings.png + buildings.tsj …
  sprites/         marcus.png, dog-chihuahua.png …
tiled/
  crazy-squad.tiled-project   (shared custom classes and enums, committed to git)
  templates/                  dog-chihuahua.tx, portal.tx …   (reusable objects)
```

### Required Tiled settings

These matter. Phaser's Tiled parser **does not resolve templates or custom-class defaults**, and it **can't load "collection of images" tilesets**.
- Export as **JSON** (`.tmj`).
- In *Preferences → Export*, turn on **Embed tilesets**, **Detach templates** and **Resolve object types and properties**. The exported file then contains everything, and Phaser sees the default values from our custom classes.
- Each tileset is **one image** (a sprite sheet), 16×16 tiles, with no margin or spacing.
- Always open maps through the `.tiled-project` file, so everyone uses the same custom classes.

### Custom classes and enums (in the Tiled project)

Every kind of object gets a **Tiled custom class** with typed fields and defaults. This is how a level designer (any of the four of you) places a turret and sets its fire rate without touching code.

Examples:
- `Dog` with fields `breed: DogBreed (enum)`, `patrol: object (reference to a path)`
- `Turret` with fields `fireRate: float = 1.0`, `range: int = 96`, `team: Team (enum)`
- `Portal` with fields `target: object`, `map: string`
- `Door` with fields `locked: bool`, `key: string`
- Enums: `Team = player | dog | neutral`, `DogBreed = chihuahua | bulldog | dachshund | boss`, `Terrain = ground | shallowWater | deepWater | ice | pit | lava`

In Tiled, the object's **Class** field holds the class name. Phaser reads it as the object's `type`.

---

## 4. Layer convention

Every map uses the same layer names, top to bottom in Tiled, which is the reverse of drawing order:

| Layer (exact name) | Kind | Contents | Drawn |
|---|---|---|---|
| `Zones` | object layer | Invisible areas: building interiors, stairs, portals, hazards, level exit, camera limits | not drawn |
| `Entities` | object layer | Everything that acts: player spawns, dogs, turrets, doors, pickups, switches | y-sorted with characters |
| `Roofs` | group of tile layers, one per building: `Roofs/house-1` | Roofs that hide when you walk inside | above everything |
| `Above` | tile layer | Things you walk *behind*: treetops, wall tops, bridge railings, archways | above characters |
| `Walls` | tile layer | Solid things: walls, rocks, fences, building outer walls | under characters |
| `Decor` | tile layer | Floor details: flowers, cracks, rugs, path edges | under characters |
| `Ground` | tile layer | Base terrain: grass, floor, sand, water | bottom |

Rules:
- A map may leave out layers it doesn't need. The loader skips missing layers quietly.
- More layers are allowed (`Ground2` for overlapping terrain), but **collision and terrain only come from `Ground` and `Walls`**.
- For **multiple floors**, wrap the layers in groups: `Floor0/Ground`, `Floor0/Walls`, `Floor1/Ground`… See [section 9](#9-elevation-stairs-and-bridges). Phaser gives group children names like `Floor0/Ground`.

---

## 5. Tile properties: collision and terrain

Tile behaviour is set **per tile in the tileset** (Tiled's tileset editor → tile properties), so it's set once and applies everywhere that tile is used.

| Property | Type | Meaning |
|---|---|---|
| `collides` | bool | Blocks walking. Used on `Walls` tiles: `layer.setCollisionByProperty({ collides: true })`. |
| `terrain` | `Terrain` enum | What the ground is: `ground`, `shallowWater`, `deepWater`, `ice`, `pit`, `lava`… |
| `blocksShots` | bool (default = `collides`) | For low walls or water you can shoot across but not walk through |

For odd shapes like a round rock or a diagonal wall, draw the shape with Tiled's **collision editor** and use `setCollisionFromCollisionGroup()`. Use this sparingly, because full-tile collision is simpler and more predictable.

### Terrain rules table

Terrain doesn't block movement directly. Instead, **each kind of mover has rules** (`src/world/terrain.ts`):

```ts
// shortcut: illustrative values, tune in play-testing
export const terrainRules: Record<Terrain, { speed: number; blocks: MoverKind[]; damagePerSec?: number }> = {
  ground:       { speed: 1,   blocks: [] },
  shallowWater: { speed: 0.6, blocks: [] },
  deepWater:    { speed: 0.5, blocks: ['walker'] },      // swimmers allowed, walkers not
  ice:          { speed: 1,   blocks: [] },              // movement code lowers decel on ice
  pit:          { speed: 1,   blocks: ['walker'] },      // flyers cross
  lava:         { speed: 0.5, blocks: [], damagePerSec: 20 },
};
```

Every entity has a `mover: 'walker' | 'swimmer' | 'flyer'`. Each frame it looks up the terrain under its **feet**, multiplies `maxSpeed` by `speed`, and adjusts accel/decel for ice. This is how water, ice, mud and lava all become a one-line table entry instead of new code. A character ability like "Jonas can swim" is just a different `mover` value.

Blocking terrain such as deep water and pits is turned into collision when the map loads, **per mover kind**. Walkers get a collider against those tiles, and flyers don't.

---

## 6. Drawing order (depth)

Fixed depth bands in `src/world/constants.ts`:

| Band | Depth | What |
|---|---|---|
| Ground | 0 | `Ground` layer |
| Decor | 100 | `Decor` layer |
| Walls | 200 | `Walls` layer |
| **Actors** | 1000 + y | Characters, dogs, turrets, pickups, projectiles: **y-sorted** |
| Above | 5000 | `Above` layer |
| Roofs | 6000 | `Roofs/*` |
| Effects | 7000 | Overlays like screen flashes and weather |
| UI | 9000 | HUD, tuning panel. Camera-fixed with `setScrollFactor(0)`. |

**Y-sorting** is the standard top-down trick. An actor's depth is `ACTORS + its feet y`, updated every frame, so whoever is lower on screen draws in front. A character walking behind a tree draws behind it, and walking in front draws in front.

For multiple floors, add `floor × 10000` to every band, so everything on floor 1, like someone on a bridge, draws above everything on floor 0.

---

## 7. Physics bodies (hitboxes)

Covered in full by the [collision blueprint](collision-blueprint.md): feet-only bodies, separate body / hurtbox / hitbox / sensor shapes, the collision matrix, corner assist, soft pushing between actors, the damage pipeline and projectiles.

---

## 8. Entities

### The model

`src/entities/Entity.ts` is a thin base class around a Phaser sprite with:
- `id`: the Tiled object id, so other objects can reference it
- `floor`, `mover`, `team`
- an optional list of **components**, small objects with `update(dt)` that add behaviour:

| Component | Gives the entity |
|---|---|
| `Health` | HP, damage, death, invulnerability frames |
| `Hurtbox` / `Hitbox` | Can be hit / deals damage on overlap |
| `TerrainAware` | Speed and blocking from the terrain table |
| `Interactable` | "Press E" prompt and an `onInteract` |
| `Signals` | Sends and receives `activate` / `deactivate` (doors, switches, plates) |
| `Brain` | AI behaviour (patrol, chase, flee), swappable per enemy |
| `Weapon` | Fires projectiles or swings, with cooldowns and ammo |

Adding behaviour means adding a component to an entity, not writing a new subclass. A turret is `Health + Hurtbox + Weapon + Brain(aimAtNearest)`. A destructible crate is `Health + Hurtbox`.

We deliberately **don't use a full ECS library** like bitECS. Phaser already gives us objects, groups and physics, and an ECS would be a second system to learn for no gain at this size.

### The registry and spawner

`src/entities/registry.ts` maps **Tiled class name → factory**:

```ts
export const registry: Record<string, EntityFactory> = {
  PlayerSpawn: spawnPlayer,
  Dog: spawnDog,
  Turret: spawnTurret,
  Door: spawnDoor,
  Pickup: spawnPickup,
  // new things are added here: one line each
};
```

`src/world/spawner.ts` reads the `Entities` layer with `map.getObjectLayer('Entities')`, converts each object's property list into a plain object (Phaser keeps Tiled properties as `[{ name, type, value }]`), and calls the matching factory. An object whose class isn't in the registry logs a warning with its id and position, and the level still loads.

We **don't** use Phaser's `createFromObjects`. It creates plain sprites, while we need our own factories, typed properties and object references.

### References between objects

Tiled supports **object reference** properties: you click another object on the map. The spawner resolves those ids after everything is created, so a `Switch` can point at a `Door`, a `Portal` at its exit portal, and a `Dog` at its patrol path, a polyline object.

---

## 9. Zones (triggers)

The `Zones` layer holds invisible rectangles and polygons with a class. `src/world/zones.ts` turns each one into a static overlap area and tracks which entities are inside, giving `onEnter`, `onExit` and `onStay`. Zone kinds are registered the same way as entities:

| Zone class | What it does |
|---|---|
| `Interior` | Fades out its `roof` layer (`Roofs/<name>`) when a player is inside, and back in when all players have left |
| `Stairs` | Changes the floor of whoever walks through it (see below) |
| `Portal` | Teleports to `target` (another portal on this map) or loads `map` at its named spawn |
| `LevelExit` | Ends the level when **all four players** are inside |
| `Hazard` | Damages whoever stands in it (spikes, fire) |
| `CameraBounds` | Limits the camera to this area while the player is inside (rooms, arenas) |
| `Trigger` | Sends `activate` to its targets on enter: traps, cutscenes, dog ambushes |

---

## 10. Recipes: how the planned features fit

### Buildings you can walk into

Standard top-down technique: **the roof hides when you're inside.**
1. Draw the building's floor on `Ground` and its outer walls on `Walls`, with a gap for the door.
2. Draw its roof on its own layer `Roofs/house-1`, covering the interior.
3. Put an `Interior` zone over the inside with `roof = house-1`.
4. When a player enters, the roof fades to alpha 0, and when everyone leaves, it fades back.

For big buildings or dungeons, use a **separate interior map** instead: a `Portal` at the door with `map = house-interior`. Use roof-hiding for small houses and portals for large interiors.

### Water, ice, mud, lava

Make a tile with the right `terrain` property, and add or tune the row in the terrain table. No other code.

### Bridges

A bridge crosses water or a pit on the **same floor**. The bridge tiles' `terrain` is `ground`, so you walk on them, and the railings go on `Above`. For a bridge you can walk **under**, use two floors (below).

### Stairs and elevation (multiple floors)

This is the classic Pokémon-style model, simplified:
- Every entity has `floor` (0, 1, 2…). Each floor has its own `FloorN/Ground` and `FloorN/Walls` layers.
- An entity collides only with its **own floor's** walls. This uses a `processCallback` on the collider that checks `entity.floor === layerFloor`.
- A `Stairs` zone has `lower` and `upper` floors and an `up` direction (for example `north`). While inside, the entity counts as being on both floors, so it collides with neither. On exit, it takes the floor on the side it left by.
- **Walk under a bridge:** the bridge is on `Floor1`, and the river and its banks are on `Floor0`. The y-sort bands put floor 1 above floor 0, so someone crossing the bridge draws above someone walking under it.

**Build this only when a level needs it.** Until then, everything is floor 0 and the `FloorN/` groups can be left out.

### Portals

A `Portal` zone with `target` set to another `Portal` moves the player to it on the same map, and with `map` set it loads another map and spawns at the portal named `spawn`. Add a short cooldown so you don't bounce straight back.

### Enemies (dogs)

1. Tiled: add a `Dog` class (or more breeds via the `DogBreed` enum), plus a template per breed.
2. Code: `src/entities/dogs/` with one file per breed, picking components: `Health`, `Hurtbox`, `Brain(chase)`, `TerrainAware`.
3. Register the class in `registry.ts`.

Placing more dogs is purely Tiled work from then on.

### Turrets

An entity with `Weapon + Brain(aimAtNearest)` and `team`. A player-built turret and a dog turret are the same code with a different `team`.

### Weapons and projectiles

Weapons aren't map objects. They're `Weapon` components that fire **projectiles**. Projectiles come from a **pooled** Phaser group, reused instead of created each shot, collide with `Walls` (or tiles with `blocksShots`) on their own floor, and hit hurtboxes of the other team. Weapon pickups lying on the map are `Pickup` entities with `item = <weapon id>`.

### Doors, keys, switches, pressure plates

All of these use `Signals`. A `Switch` or `PressurePlate` sends `activate` to its `targets`, and a `Door` opens on `activate`. A locked `Door` checks the interacting player's inventory for its `key`. Teamwork puzzles where all four players must stand on plates are just plates plus a `Trigger` that waits for all of them.

### Destructible walls and changing the map

Small changes, like a wall being blown up, use `layer.putTileAt()` / `removeTileAt()` on the tile layer. Collision updates with it. Anything with HP or animation is an entity instead.

---

## 11. Enemy navigation

- Build a **navigation grid** from the tile layers when the map loads: a cell is walkable for a given mover kind if `Walls` doesn't collide and the terrain rules allow it.
- **One dog or a few:** A* pathfinding on that grid. Write a small one, or use a small library such as `easystarjs`.
- **Many dogs chasing the same players:** a **flow field**, one map from all cells toward the nearest player, recomputed a few times per second. This is how swarm games handle hundreds of enemies cheaply.
- Dogs steer toward the next cell centre with the same acceleration movement as the players, so they feel physical.

Start with "run straight at the nearest player", and add A* when walls start trapping dogs.

---

## 12. Levels and scenes

- One Tiled map per level. `src/levels.ts` lists them in order: `[{ key: 'level-01', name: 'The Backyard' }, …]`.
- One generic `LevelScene` loads any map by key, builds layers, collision, zones and entities, places the four players at the `PlayerSpawn` objects, and sets camera and physics bounds to the map size.
- Phaser's `TilemapLayer` (CPU) is the default. `TilemapGPULayer` is faster, but it's limited to one tileset per layer and needs manual refreshes after edits, so only switch a layer to it if a huge map gets slow.

---

## 13. Code layout

```
src/
  main.ts                 game config, scene list
  movement.ts             acceleration movement (exists)
  tuning.ts               dev sliders (exists)
  levels.ts               ordered level list
  scenes/
    LevelScene.ts         loads a map and runs a level
  world/
    constants.ts          TILE, layer names, depth bands, collision categories
    grid.ts               tile ↔ pixel helpers
    loadMap.ts            tilemap + layers + collision from Tiled
    terrain.ts            terrain rules table
    zones.ts              zone system + zone registry
    spawner.ts            reads Entities layer, calls registry
    nav.ts                navigation grid / pathfinding (later)
  entities/
    Entity.ts             base class
    registry.ts           Tiled class → factory
    components/           Health, Hurtbox, Hitbox, Weapon, Brain, Signals, Interactable, TerrainAware
    players/              marcus.ts, kristian.ts, christian.ts, jonas.ts
    dogs/                 chihuahua.ts, bulldog.ts …
    props/                door.ts, turret.ts, pickup.ts, switch.ts …
```

---

## 14. Checklist: adding a new kind of thing

1. **Tiled:** add a custom class with fields and defaults in `crazy-squad.tiled-project`, and optionally a template in `tiled/templates/`.
2. **Code:** one file in `src/entities/…` (or `src/world/zones/…` for a zone) that combines existing components. Write a new component only if no existing one fits.
3. **Register:** one line in `registry.ts`.
4. **Test:** if it has logic, like damage maths or a state machine, add a small Vitest test next to it.
5. **Place:** put it on a map in Tiled and play.

New tile behaviour is simpler still: set a tile property, plus a row in the terrain table if it's new terrain.

---

## 15. Build order

Build what's needed now, and nothing ahead of its first use:

1. **Now (next PR):** `constants.ts`, `grid.ts`, a first tileset (placeholder colours are fine), `loadMap.ts` with `Ground` / `Decor` / `Walls` / `Above`, tile-property collision, y-sorting, and the test world moved into a Tiled map.
2. **With the four characters:** feet-only hitboxes, `PlayerSpawn`, the entity base, the registry and spawner.
3. **With the first dog:** `Health`, `Hurtbox` / `Hitbox`, a simple chase `Brain`.
4. **With the first level that needs them:** terrain rules and water, zones (`Interior`, `Portal`, `LevelExit`), signals and doors.
5. **Only when a level design asks for it:** multiple floors, stairs, walk-under bridges, A* / flow fields.

---

## Sources

- [Phaser 4 tilemaps guide (bundled with Phaser 4.2.1 at `node_modules/phaser/skills/tilemaps/SKILL.md`)](https://unpkg.com/phaser@4.2.1/skills/tilemaps/SKILL.md): layer creation, collision by property, collision groups, object layers, GPU layer limits
- Phaser 4.2.1 source, `src/tilemaps/parsers/tiled/ParseObject.js`: object properties are kept as Tiled's raw list, and templates aren't resolved
- [Tiled manual: custom properties, classes and enums](https://doc.mapeditor.org/en/latest/manual/custom-properties/) and [working with objects](https://tiled.readthedocs.io/manual/objects/)
- [Tiled 1.9 release notes (object types merged into custom classes)](https://thorbjorn.itch.io/tiled/devlog/397225/tiled-19-released)
- [Pixel-art ledges, stairs and bridges in a tile world](https://blakecrosley.com/blog/pixel-art-elevation-ledges-bridges): Pokémon's per-cell elevation, stair transitions and bridges
- [Sprite draw order for top-down games with floors and bridges (gamedev.net)](https://comic.gamedev.net/forums/topic/707079-sprites-draw-order-sorting-for-top-down-2d-game-with-floors-and-bridges)
- [Hiding roofs when the player goes inside (Godot forum)](https://forum.godotengine.org/t/how-to-make-tiles-transparent-when-the-player-goes-behind-them/44438) and [(Construct forum)](https://www.construct.net/en/forum/construct-3/how-do-i-8/remove-roofs-top-down-rpg-159735)
- [Creating height levels in a top-down 2D game (Godot forum)](https://forum.godotengine.org/t/how-to-create-different-height-levels-in-a-top-down-2d-game/47906)
- [Tiled vs LDtk discussion (r/gamedev)](https://redlib.hackliberty.org/r/gamedev/comments/1l5vhrw/tiled_vs_ldtk/mwk0zd4/?context=3)
- [Using Tiled's collision editor with Arcade physics (Phaser forum)](https://phaser.discourse.group/t/using-tiled-collision-editor-with-arcade-physics/9977)
