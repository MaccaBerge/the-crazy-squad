# Nature blueprint

How the living parts of the world work: the weather, the wind, the grass and the trees. It builds on the [world blueprint](world-blueprint.md) (Tiled maps, layers, depth) and the [world art style](world-art-style.md) (cool nature ramps, calm ground). Water and combat get their own blueprints later.

## Decisions

- **Weather is a preset per level** and stays the same for the whole level, like "sunny, light breeze" or "storm: dark, rainy, strong wind".
- **One wind for everything.** A deterministic function of place and time drives the grass, the trees and anything else that sways.
- **Grass is its own system, separate from the tiles.** Tiles can still have static grass drawn in. The moving grass is drawn in code on top.
- **Grass size is flexible:** a single tuft, a patch or a whole field. Fields need real performance work.
- **Everything that moves bends the grass correctly:** characters, dogs, thrown things, anything with a body.
- **Trees are big, majestic and a little mystic,** PixelLab images with thick, detailed trunks that sway in the wind. Most trees stay modest; only a couple are huge.
- **Grass is thin single blades,** one sprite per blade, like DaFluffyPotato's.
- **Canopies fade** when a character is behind them.
- **Falling leaves** drift off trees in the wind.
- **Bushes, flowers, reeds and hanging things** (signs, washing lines, flags) also move with the wind.
- **Not now:** cutting or burning grass, and trees rustling when bumped. The design leaves room for both.

---

## 1. Principles

1. **Pixel perfect.** Nothing rotates or scales smoothly. A blade bends by switching between a few pre-drawn poses; a leaf bundle sways by whole pixels. Every pixel stays on the palette.
2. **Deterministic.** Wind and grass layout come from functions of position, time and a seed, never `Math.random()` at runtime. The same level looks the same every time, and online play later can't drift.
3. **Visual only.** Grass and leaves never affect gameplay: no collisions, no slowdown. They react to the game; the game doesn't read them. (Hiding in tall grass, if we want it, is a gameplay zone in Tiled, not the grass system.)
4. **Data in Tiled.** Weather, grass areas and trees are placed in Tiled, like everything else in a level.
5. **Cheap when idle.** Most of a field is out of view or untouched; that part must cost almost nothing.

---

## 2. Weather

A level's weather is a property on the map in Tiled: `weather = "sunny"`. Presets live in one data file:

| Preset | Wind strength | Gusts | Light | Extras |
|---|---|---|---|---|
| `calm` | very low | none | normal | – |
| `sunny` | low | rare, soft | normal, warm tint | – |
| `breezy` | medium | regular | normal | leaves drifting (later) |
| `overcast` | medium | regular | slightly darker, cool tint | – |
| `storm` | high | frequent, strong | dark, cool tint | rain (later) |

A preset is plain data, in `src/nature/weather.ts`:

```ts
interface WindParams { windBase: number; windGust: number; gustEvery: number; windDir: number }
```

The light tint and darkness get added to presets in build step 9.

Rain, falling leaves and lightning are extras for later. The tint and darkness use one camera-wide colour multiply, so the palette rule still holds for the art itself.

---

## 3. Wind

One wind field, used by everything that sways:

```ts
windAt(x, y, t, params): { x, y }   // the wind vector there, length 0..1 (full strength)
gust(x, y, t, params): number       // 0..1, how much of a gust is passing right now
prevailing(t, params): number       // the overall direction right now, radians
```

The wind is alive in three layers, so it never looks like one pulse marching one way:

- **Veering:** the prevailing direction wanders slowly around `windDir`, up to `windVeer` degrees either way. Two slow sines, about 30 s and 90 s, so it never loops visibly. Light air wanders most (calm 70°) and a storm least (20°).
- **Eddies:** a large, slow swirl field, about a screen across, bends the direction from place to place by up to 60% of `windVeer`. It drifts downwind, so you can watch a bend in the wind roll across a field.
- **Base sway:** two sines with different speeds and wavelengths roll downwind (DaFluffyPotato's `sin(t/60 + x/100)`, summed). The waves and eddies roll along the weather's own `windDir`, so far-off spots don't sweep as the wind veers.
- **Gust puffs:** each gust is a separate blob, about 140 px long and 300 px wide.
  - It grows, travels at 70–110 px/s along its own heading (the prevailing wind give or take 50°), and dies out within 5 s.
  - Every 320 px square of the world releases puffs on its own deterministic clock, so puffs cover a level of any size, and a spot feels about one gust every `gustEvery` seconds.
  - Gusts push the way their puff heads, so they cross a field at angles.
- **Weather settings:** `windBase`, `windGust`, `gustEvery`, `windDir` and `windVeer` come from the preset (section 2), and each has a slider in the T panel.
- **Debug view:** V draws one arrow per tile pointing where the wind blows there (orange where a gust is passing).
- **Who uses what:**
  - grass, tree clumps and hanging things lean with the sideways part of the wind (`x`);
  - falling leaves drift with the whole vector;
  - trees shed with its strength;
  - flags fly to the side of the prevailing direction.
- **Cheap:** it's sampled per grass tile, tree clump, leaf and hanging thing, not per blade; the whole scene stays around 2 ms per frame.

It lives in `src/nature/wind.ts` with unit tests:
- the same input gives the same output;
- it stays within full strength and mostly blows its way;
- the direction veers within `windVeer`;
- eddies bend it across the land;
- gusts come and go, travel downwind and head different ways.

---

## 4. Grass

### What a blade is

- **A thin single blade,** one sprite each, about **1–3 px wide and 6–14 px tall**, in fern, moss or teal from the cool ramps, with a 1-step-darker base.
- Each blade type has **about 7 pre-drawn poses**: straight, and three steps of lean each way. Bending picks a pose, so blades stay pixel perfect. Poses can be drawn by hand or generated by code that shears the straight blade one pixel per row and snaps to the palette.
- **A few blade types** (short, tall, flower stalk, reed) give variety. Because each blade is its own sprite, a field has many of them; the performance plan below is sized for that. Leaning further also makes a blade one ramp step darker, like DaFluffyPotato's, because you see more of its shaded side.

### Where grass grows

- In Tiled, a **`Grass` object layer** holds rectangles or polygons: grass areas. Properties: `density` (blades per tile), `types` (which blades), `height` (short or tall), `seed`.
- Areas are rectangles or polygons. `density` defaults to 6 blades per tile, `seed` defaults to the object's id, `flowers` sets the share of flowers (default 0.04), `kind: "reeds"` makes a reed bed (70% reeds, the rest grass), and `kind: "autumn"` grows autumn grass: dry olive, golden and rust blades and seed heads, with 15% still green.
- The art is in `src/nature/bladeShapes.ts`: 6 grass blades, 3 flowers and 2 reeds, typed in as pixel rows on the cool ramps, with a weight for how often each is picked. Code bends them into the poses. The map test rejects ellipses, points and odd densities.
- At level load, a **seeded scatter** fills each area with blades. Blades get a small random base lean and a random pose offset, so they don't all look alike.
- Static grass painted on the ground tiles under them makes the area look full even where blades are sparse.

### How it moves

Each blade's lean is:

```
lean = baseLean + windAt(x, y, t).x * flexibility + push
```

then rounded to the nearest pose.

- **Push:** every moving body (characters, dogs, thrown things) is a **force**: a position and a radius. Blades inside the radius lean away from the centre, more the closer they are. When the body leaves, the blade **springs back** over a short time (a damped spring), so you see a trail closing behind you.
- **Who pushes:** anything with a body registers itself as a grass force. Nothing else has to know the grass exists.
- **Stepping on grass:** blades right under the feet can flatten to their most-bent pose for a moment.

### Depth

Blades are sorted with the characters by y (`DEPTH.actors + y` in `src/world/constants.ts`). Blades below a character's feet draw in front of them, so a character really stands *in* the grass. Tall grass can hide a dog's legs.

How (step 4): blades are split into 4 px horizontal strips, one GPU layer each, at depth `DEPTH.actors` + the strip's top y. A blade up to 3 px below the feet can still draw behind them, which isn't noticeable. The test map has about 180 strips and still holds 60 fps with 20,000 blades.

### Performance

A field can hold **tens of thousands of blades**, so:

- **One GPU layer for all blades.** Phaser 4's `SpriteGPULayer` draws up to about a million quads in one draw call. Each blade is one member; changing its pose is changing its frame.
- **Chunks.** Blades are grouped into 16×16-pixel tiles of the grass area. Only chunks near the camera update.
- **Idle chunks are cheap.** A chunk with no force nearby only follows the wind, which is the same for the whole chunk: compute it once per chunk, and only update the blades whose pose actually changed.
- **Forces are few.** Only chunks a force overlaps run the per-blade push and spring.
- **Y-sorting:** blades are sorted once at load, in strips; actors slot between strips by depth.
- **Stress test before art:** a debug map with **~20,000 blades** and several moving bodies has to hold 60 fps on a normal laptop before we build on it. If `SpriteGPULayer` doesn't fit (sorting with actors is the risk), the fallback is DaFluffyPotato's trick: pre-render each chunk's layout per wind pose and draw whole chunks as images.
- **Stress test result (step 2, on the dev Mac):** open the game with `?grass=20000`. 20,000 blades in a storm hold 60 fps, and the grass update takes about 0.1–1 ms a frame. 100,000 blades also hold 60 fps. Only blades whose pose changes are re-uploaded: about 50–100 a frame at 20,000. Not yet checked: a slower laptop, and sorting blades with the characters (step 4).

---

## 5. Trees

### How a tree is drawn

- **Types:** big trees (spreading oak, gnarled), smaller ones (young oak, slender tree, small pine, autumn maple) and bushes (round, berry, flowering). Most trees should be the smaller ones, with only a few of the big two.
- **Autumn versions:** `npm run art` builds `autumn-<name>.png` for the young oak, slender tree and bushes (`art/trees/autumn.mjs`). It swaps each green, teal and moss tone for the autumn tone at the same step, stopping short of the palest gold. A test checks the files are up to date. Together with the maple, autumn grass and leaf litter they make autumn corners.

- **One PixelLab image per tree type** (`create_object_pro_flash`, 160×160, one direction, low top-down, the nature palette, a character sprite as style anchor). The images live in `public/assets/trees/<type>.png`; their PixelLab ids are in `art/trees/pixellab.json`.
- **On the palette, no soft edges:** a test checks every tree image like the characters and tilesets.
- **Per type, in `src/nature/treeTypes.ts`:** where the trunk meets the ground (`base`), the trunk hitbox (`block`), and which rows sway (`swayFrom`, `sway`).
- We tried Slynyrd's leaf bundles drawn by code first; the PixelLab trees looked far better, so bundles are dropped.

### How it moves

- **Leaf clumps** (DaFluffyPotato's foliage trick): when the level starts, each canopy is cut into clumps. The brightest leaf spots seed them, and the lit leaves around grow into each one (`src/nature/leafClumps.ts`). The darker leaves behind stay put; under each clump they become a single shade, so a moving clump uncovers shadow, not holes.
- **Each clump moves as one piece** by whole pixels: with the wind where it sits (so gusts roll across the canopy), further near the top, up to `sway` px, plus a rustle of its own that grows with the wind (none in still air, sometimes lifting it 1 px in a storm). Brighter clumps are drawn in front.
- We tried shifting pixel rows first; it looked like pixels shuffling along a line, not leaves moving.
- Each tree has its own canvas texture, redrawn only when a clump moves. The lean is the sideways part of the wind, times a small per-tree stiffness so neighbours don't move in lockstep.

### Walking behind trees

- Trees are **points on a `Trees` object layer** in Tiled, with the tree type as the object's type. The point is where the trunk meets the ground. The map test rejects unknown types.
- **Depth:** a tree sorts with the actors by its base y, so you walk in front of the trunk below it and behind the canopy above it.
- **Trunk collision:** a static body at the base blocks movement; the canopy doesn't.
- **Canopy fade:** when the local player's feet are above the tree's base and an opaque tree pixel is just above them, the tree fades to 45%, and back when they leave.

### Falling leaves

- **Who sheds:** every tree type has a `shed` rate in `TREE_TYPES`: leaves per second in a light breeze. Big trees shed more than small ones, bushes least, and autumn versions 1.5× their green ones. A tree's `shed` property in Tiled (a float, 0–10) overrides its type's rate; the map test checks it.
- **Wind sets the pace:** the rate grows with the wind at the tree, from 0.3× in still air to 2× in full wind (`shedRate`).
- **Where a leaf starts and lands:** it leaves from a random pixel of the canopy's leaf clumps, in that pixel's colour. It lands somewhere on the ground under the canopy.
- **The fall** (`src/nature/leafFall.ts`):
  - it swings back and forth like a pendulum, hanging at each end of the swing and falling fastest through the middle;
  - meanwhile, the wind where it is carries it downwind;
  - it tumbles through three 4×3 poses (flat, tilted left, tilted right).
- **On the ground:** it lies for 4 s, then fades over about a second.
- **Cost:** a pool of at most 160 leaves keeps the cost fixed.
- **Leaf litter:** autumn trees (types with `litter`) keep a carpet of fallen leaves under them, already there when the level starts: 70 under the maple, fewer under smaller trees and bushes. Each new leaf that lands joins the carpet, and the oldest one fades. Landed leaves lie just above the ground decor, under grass and characters.
- **Not yet:** landed leaves skittering in gusts, and trees rustling when bumped.

---

## 6. Other things in the wind

All of these use the same `windAt()`:

- **Bushes:** small PixelLab images on the `Trees` layer (round, berry, flowering, and their autumn versions), swaying like a small tree. They block movement like a trunk.
- **Flowers:** a grass blade type (a stalk with a flower on top in berry, violet or autumn), scattered in grass areas and pushed like grass.
- **Reeds:** a tall grass blade type for the water's edge, ready for the water blueprint.
- **Hanging things:** signs, flags and washing lines, drawn by code on the palette (`src/nature/hangingShapes.ts`) and placed on a **`Hanging` object layer** in Tiled. The map test checks their types and shapes.
  - **Sign** (a point where the post meets the ground): a plank hanging from an arm on two chains. The plank is stiff, so it moves as one piece; only the chains slant.
  - **Flag** (a point): the cloth streams out on the downwind side of the pole and ripples a little faster in strong wind (kept slow and low: a faster or higher ripple flickers). In still air it hangs limp, bunched against the pole. It flies to the side the weather blows to; when the wind at it dips the other way for a moment it goes limp rather than flipping, and when the weather turns it sags in before it swings over (`flagStep`).
  - **Washing line** (a rectangle whose bottom edge runs between the two posts): a sagging rope with a shirt, socks, a towel and a sheet pegged along it, repeated to fill the width. Each piece swings on its own.
  - **Swinging:** every swinging piece is a pendulum pulled towards the sideways wind (`swingStep`). It overshoots and swings back, so gusts set it rocking, and it lies still in calm air.
  - **Drawing:** each object has its own small canvas, redrawn only when its pixels change.
  - **Not yet:** posts don't block movement, and the art could later be swapped for PixelLab pieces.

---

## 7. Code layout

```
src/nature/
  weather.ts     presets and the level's current weather
  wind.ts        windAt(x, y, t), gust, prevailing   + wind.test.ts
  forces.ts      the list of moving bodies that push nature
  grass.ts       scatter, chunks, poses, the GPU layer   + grass.test.ts (scatter is seeded)
  treeTypes.ts   base, hitbox and sway per tree type
  leafClumps.ts  cutting a canopy into clumps, and how far each moves   + leafClumps.test.mjs
  leafFall.ts    how a falling leaf moves, and how fast trees shed   + leafFall.test.ts
  leaves.ts      dropping, drawing and recycling falling leaves
  hangingShapes.ts  drawings and pendulum swing of signs, flags, washing lines   + hangingShapes.test.ts
  hanging.ts     placing and swinging them from the Hanging layer
  trees.ts       placing, swaying and fading trees
art/nature/
  blades/        blade poses (on the palette)
art/trees/
  pixellab.json  PixelLab ids of public/assets/trees/*.png
```

`LevelScene` reads `weather`, the `Grass` layer and the `Trees` layer from the map, creates the systems and calls their `update`. Bodies add themselves to `forces` when they spawn.

---

## 8. Build order

1. **Wind and weather presets,** with a debug view in the T panel (draw the wind field as arrows, switch presets live).
2. **Grass stress test:** 20,000 placeholder blades, wind only, measure fps.
3. **Pushing:** forces from the characters, spring-back, flattening under feet.
4. **Grass from Tiled:** the `Grass` layer, seeded scatter, depth with actors.
5. **Real blade art** on the cool ramps, plus flowers and reeds.
6. **Trees:** two PixelLab trees, leaf-clump sway, trunk collision, canopy fade. Then more tree types (mostly smaller) and bushes.
7. **Falling leaves.**
8. **Hanging things:** signs, flags and washing lines.
9. **Weather look:** tint and darkness per preset.

Each step is its own PR.

---

## Sources

- DaFluffyPotato's pygame-grass (MIT): blade images, tile caching, `apply_force`, wind as a sine over time and position, darkening with lean. Tree sway by moving leaf clumps, from his foliage animation.
- Slynyrd, *Pixelblog 44: Top Down Trees* (2023): leaf bundles, sphere shading, light-order layering, trunk and shadow.
- Phaser 4 `SpriteGPULayer` docs: per-member frames, large member counts.
