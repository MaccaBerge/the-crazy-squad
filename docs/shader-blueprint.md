# Shader blueprint

How the game uses **shaders**: small programs on the graphics card that change the finished picture, like a ripple that bends the screen or a mood colour over the whole level. They're the last layer of the look, on top of the sprites, tiles and effects we draw ourselves.

It builds on the [art style](art-style.md) (palette, pixel rules), the [players, input and camera blueprint](players-input-camera-blueprint.md) §5 (camera rig, pixel rules) and the [characters and abilities blueprint](characters-abilities-blueprint.md) §4 (abilities). The first user is Christian's slow-mo (§7).

---

## 1. Words

| Word | Meaning here |
|---|---|
| **Shader** | A tiny program the graphics card runs once for every pixel on screen, every frame. Ours are *fragment shaders*: given a pixel's position, they say what colour it ends up. Written in GLSL, a C-like language. |
| **Filter** | Phaser 4's name for a shader applied to a whole camera (or one object). Our orange screen-edge glow is already a built-in filter (Vignette). |
| **Controller** | The JavaScript side of a filter: an object with the settings (`radius`, `strength`…) that game code changes each frame. |
| **Render node** | The graphics side of a filter: it holds the shader and copies the controller's settings into it. |
| **Uniform** | A setting passed from the controller into the shader, the same for every pixel in one frame (a radius, a time). |
| **Internal / external** | A camera's two filter lists. *Internal* runs in the world's own space before the camera zoom; *external* runs on the finished screen. Screen effects (ripples, colour) go external. |
| **Displacement** | Moving where a pixel reads its colour from, so the picture bends (ripples, shimmer). |

---

## 2. Principles

1. **Pixel art first.** Every shader keeps the look of hand-placed pixels:
   - It runs at the game's own resolution (240 px tall), before the browser scales the canvas up, so its output is already in chunky game pixels. A shader never adds detail finer than one game pixel.
   - Displacement moves pixels by **whole pixels** only (offsets rounded), so sprites bend in steps instead of smearing.
   - Colours come from the palette or the effect's colour ramp. No smooth gradients across big areas, no soft bloom or blur, no film grain, no chromatic aberration.
2. **Short and readable.** Screen-bending effects last a fraction of a second and are tied to something the player did (an ability, a heavy hit). Lasting effects (colour grading, lights) are subtle.
3. **Off by default for everything that isn't designed.** A shader only runs while its effect is live: an idle shockwave costs nothing because its filter is switched off.
4. **Every effect has a toggle and tuning values** in the T panel, like the rest of the game feel, so we can compare with and without while testing.
5. **The game works without them.** If WebGL isn't there (Phaser falls back to Canvas), filters don't exist. Effects check for that and simply skip; nothing else depends on them.
6. **Math in TypeScript, drawing in GLSL.** Anything we can compute outside the shader (where the ring is now, how strong) lives in plain TypeScript functions with tests. The GLSL stays small: read settings, bend or colour, done.

---

## 3. How it works in Phaser 4

A filter is three pieces:

```
game code ──sets──► Controller (settings) ──each frame──► Render node ──uniforms──► GLSL shader ──► screen
```

- **Controller:** `class Shockwave extends Phaser.Filters.Controller`. Holds the settings and `active`. Added to a camera with `cam.filters.external.add(controller)`.
- **Render node:** `class extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader`, built with the GLSL source. Its `setupUniforms(controller, drawingContext)` copies the settings into the shader. `drawingContext.width/height` is the size it draws at, which the shader needs to work in whole pixels.
- **Registration:** once per game, `renderer.renderNodes.addNodeConstructor('FilterShockwave', ShockwaveNode)`. The controller names its node by that string.
- **GLSL:** starts with Phaser's two template lines (`#pragma phaserTemplate(shaderName)` and `(fragmentHeader)`), reads the picture from `uMainSampler` at `outTexCoord`, and uses `boundedSampler(...)` so reads past the edge come back empty instead of smeared.

Order matters: filters in a list run one after another. Ours go after the vignette, so the glowing edges bend with the ripple.

---

## 4. Files

```
src/fx/
  filters.ts      registerFilters(game): adds every render node once; filtersReady(scene) for the Canvas fallback
  shockwave.ts    Shockwave controller + node + GLSL, and shockwaveAt(t) — the ring's radius and strength over time (tested)
  shimmer.ts      Shimmer controller + node + GLSL (heat haze behind a fast runner)
  *.test.ts       tests for the TypeScript math
```

Shader source sits next to its controller as a template string, so there's no extra build setup. When a shader grows past ~40 lines it moves to its own `.frag` file imported with Vite's `?raw`.

Scenes own the controllers: `LevelScene` creates them in `create()` (a restart clears the camera's filters, then adds them again) and drives them in `update()`.

---

## 5. The effects, in build order

| # | Effect | Where it's used | Shader | Notes |
|---|---|---|---|---|
| 1 | **Shockwave** | Slow-mo starting, later heavy hits, dog knockouts, boss slams | Ring that pushes pixels outward as it grows, with a faint warm edge | First one: proves the pipeline. |
| 2 | **Heat shimmer** | Behind Christian while he runs in slow-mo; later fire, desert heat | Pixels in a soft circle wobble ±1 px in stepped waves | Tests a lasting, local effect. |
| 3 | **Colour grade** | Weather and time of day (dusk, storm, night) | Remap every colour through a small ramp per mood (Phaser's GradientMap or our own) | Could replace part of today's weather overlays. Kept inside the palette. |
| 4 | **Lights** | Night levels: torches, glowing eyes, Christian lighting the ground | Phaser 4's built-in lights with normal maps from PixelLab | Biggest upgrade, biggest job: every lit sprite needs a normal map. Its own blueprint first. |
| 5 | **Transitions** | Into cutscenes and between levels | Pixel dissolve or wipe (Phaser's Wipe, or a dither pattern) | Built together with the cutscene runner. |

Not planned: bloom, blur, grain, chromatic aberration, CRT scanlines (§2.1).

### 5.1 Shockwave

Settings (controller): centre (screen px), `radius` (px), `thickness` (px), `strength` (px of push at the ring's middle), `color` and `edge` (how much the ring brightens).

Shader, per pixel:
1. Distance `d` from the centre, in game pixels.
2. `x = (d − radius) / thickness`. Outside −1…1 the pixel is untouched.
3. Push along the direction from the centre by `strength × (1 − x²) × sign`, a smooth bump that's zero at the ring's edges, **rounded to whole pixels**.
4. Read the picture there, and add `color × edge × (1 − |x|)` so the ring catches a little light.

Over time (`shockwaveAt(t)`, TypeScript): the radius grows fast then slows (ease-out), the strength fades to 0, so the ring snaps out and dies. When it ends, the controller goes inactive.

### 5.2 Heat shimmer

Settings: centre and `radius` (px), `strength` (px, 1–2), `time`.

Shader: inside the circle, offset each row sideways by `round(strength × sin(row × freq + time) × falloff)`, so rows of pixels shift left/right in 1 px steps, like hot air. The falloff fades it out toward the edge of the circle. Rows, not single pixels, so it reads as waves.

---

## 6. Tuning and toggles

Each effect gets T-panel values, named after it:

| Value | Default | Meaning |
|---|---|---|
| `fxShockwave` | 1 | 0 turns shockwaves off |
| `waveRadius` | 160 | px the ring reaches |
| `waveStrength` | 4 | px it pushes at its peak |
| `waveMs` | 450 | how long one lasts |
| `fxShimmer` | 1 | 0 turns the shimmer off |
| `shimmerStrength` | 1 | px rows shift |

---

## 7. First use: Christian's slow-mo

- **Start:** a shockwave from Christian the moment slow-mo kicks in (after the 80 ms freeze), with an orange edge from the suit ramp. Speedster "pop": time breaks around him.
- **While running:** a heat shimmer just behind him, following him, strength scaled by how fast he's going (none when standing). It sits under the afterimages, so the streak and the bent air read together.
- **End:** a smaller, quicker shockwave as time snaps back, together with the held knockback landing.

Everything else about slow-mo (shade, light, afterimages, edge lightning, zoom) stays as it is.

---

## 8. Testing

- **TypeScript math** (ring radius and strength over time, screen position): unit tests in `src/fx/*.test.ts`.
- **Shaders:** can't be unit-tested in Node. Checked in the browser by stepping frames and taking screenshots: ring position, whole-pixel steps, no smear at the screen edge, nothing left on screen after it ends.
- **Performance:** at 240 px tall the screen is ~100 000 pixels; a filter is a fraction of a millisecond. Check the frame time with slow-mo running on the busiest map.

---

## 9. Risks and open questions

- **Phaser 4's filter API is new** and thinly documented. If custom nodes misbehave, fall back to the built-in Displacement filter with a generated ring texture (less exact, same idea).
- **Camera zoom:** slow-mo zooms in. External filters run after the zoom, so the centre has to be in screen pixels, not world pixels (`(x − worldView.x) × zoom`).
- **Does it look like pixel art?** If whole-pixel displacement still looks too smooth, step the ring itself (radius in 2 px steps).
- Colour grading (§5 #3) and lights (#4) need their own design pass with Christian before building.
