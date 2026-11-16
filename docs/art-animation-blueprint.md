# Art and animation pipeline blueprint

How sprites, animations, tiles and effects are made, named, exported and played. The goal: **anyone can draw or replace art without touching code**, and the game always runs, using placeholders where art is missing.

It builds on the [world blueprint](world-blueprint.md) (16 px tiles, Tiled tilesets) and the [characters and abilities blueprint](characters-abilities-blueprint.md) (ability phases drive animations).

---

## 1. Style rules

| Rule | Value | Why |
|---|---|---|
| Tile size | 16×16 | Set in the world blueprint |
| Character frame | **24×24 canvas**, character about 14–16 px wide and 18–22 px tall, **feet at the bottom centre** | A bit taller than a tile gives room for hair, hats and expression, while staying readable at 320×240 |
| Dogs | Chihuahua 16×16, bulldog and dachshund 24×24, boss 48×48 or larger | Size tells you the threat at a glance |
| Palette | One shared limited palette, for example a free 32-colour palette from Lospec | Art drawn by different people still looks like one game |
| Outlines | Dark 1 px outline on characters and dogs, none on ground tiles | Characters stand out from the floor |
| Light | From the top-left | Consistent shading |
| Perspective | "Top-down" in the classic 3/4 view: you see the front and the top of things | The standard for this kind of game |
| No rotation or non-integer scaling of pixel art | | Rotated or scaled pixels look smeared. Flip horizontally only. |

### From your photos to sprites

At 24×24 a face is a few pixels, so each person is defined by **2–3 standout features** (hair shape and colour, glasses, beard, a signature hoodie or cap) plus their main clothing colours.
1. For each person, write down those features from the photos.
2. Draw the **idle-down** frame (facing the camera) for all four first, side by side, and compare. They should be recognisable *and* look like one squad.
3. Once all four of you are happy with that, draw the other directions and animations.

---

## 2. Directions and facing

- **4 drawn directions: down, up, side.** "Left" is "side" flipped, so only **3 are drawn**. The research is consistent that 4 directions read fine even with 8-way movement, at half the work of 8.
- Facing is taken from the movement or aim direction and **snapped to the nearest of the 4**. On exact diagonals, keep the previous facing, so the sprite doesn't flicker between two.
- The movement code keeps the full direction for aiming, so abilities can still go diagonal. Only the sprite snaps.

---

## 3. Animation list

### Each character

| Animation | Directions | Frames | Timing | Notes |
|---|---|---|---|---|
| `idle` | 3 | 2 | 400–500 ms per frame | A breathing bob |
| `walk` | 3 | 4 | 120–150 ms per frame | The classic 4-frame cycle |
| `attack` | 3 | 3–5 | Follows the ability phases | Windup, strike (active) and recovery frames |
| `ability1`, `ability2` | 3, or 1 if direction doesn't matter | 3–6 | Follows the phases | Can reuse `attack` at first |
| `hurt` | 1–3 | 1–2 | Short | Plus a white flash done in code |
| `downed` | 1 | 1–2 | (none) | |

That's about **35–50 frames per character**, roughly 160–200 for all four. Draw `idle` and `walk` first. Everything else can fall back to them (section 6).

### Each dog breed

`idle`, `run`, `windup` (the **telegraph**: crouch, raised hackles, a bright pose, and it must read clearly), `attack`, `hurt` and `defeated`, in 3 directions where it matters. Bosses have more, per attack.

### Effects (one-shot, no directions)

`swap-poof`, `hit-spark`, `dust` (on start or stop and dashes), `stun-stars`, `pickup-sparkle`, `explosion`… These are small sprite animations, or Phaser particles where it's just dots.

### Animations follow ability phases

The ability runner says when each phase happens, and the animation is **timed to match**: windup frames during `windup`, strike frames during `active`, and so on. An artist can then change frame counts without changing gameplay timing. The animation's frame duration is calculated from the phase length.

---

## 4. Tools and files

**Recommended tool: [Aseprite](https://www.aseprite.org/)** (paid, or free if compiled from source). **LibreSprite** is a free fork, and **Piskel** (free, in the browser) works for simple sprites. Phaser 4 loads Aseprite exports directly with `load.aseprite` and creates the animations from its tags.

### File layout

```
art/                              source files, committed
  characters/marcus.aseprite …
  dogs/chihuahua.aseprite …
  effects/effects.aseprite
  tilesets/terrain.aseprite …
public/assets/
  sprites/marcus.png + marcus.json …   exported, what the game loads
  tilesets/terrain.png …               (world blueprint)
```

### Naming

- **One file per character or dog**, named by its id (`marcus`, `chihuahua`).
- **Aseprite tags are the animation names:** `idle-down`, `idle-up`, `idle-side`, `walk-down`, …, `attack-side`, `hurt`, `downed`.
- The game builds keys as `${sprite}/${anim}-${direction}`, so code never lists frames.

### Export

From Aseprite: *File → Export Sprite Sheet*, Layout **Packed**, Output **JSON Data** with **Array** and **Tags** ticked, both files saved to `public/assets/sprites/`. The same thing from the command line:

```bash
aseprite -b art/characters/marcus.aseprite --sheet public/assets/sprites/marcus.png --data public/assets/sprites/marcus.json --format json-array --list-tags --sheet-pack
```

An `npm run art:export` script can export every changed file at once. Add it when there are enough files to be worth it.

Using **Piskel** instead: export a PNG sprite sheet on a fixed grid, and add a small `marcus.anims.json` listing tag names and frame ranges. The loader reads either format.

---

## 5. Tiles

- Tilesets follow the world blueprint rules: one image, 16×16, no margin or spacing, tile properties set in Tiled.
- **Edges and transitions** (grass to water, path edges) use Tiled's **terrain sets** (Wang tiles), so you paint "water" and Tiled picks the right edge tiles. Draw the edge tiles as a set: 4 sides, 4 outer corners and 4 inner corners per transition.
- **Animated tiles** (water ripple, torches) are set up in Tiled's tile animation editor, and Phaser plays them automatically.
- Things you can walk behind, like treetops and roof edges, are separate tiles placed on the `Above` layer.

---

## 6. In the game

### Animation controller

`src/art/animator.ts` picks the animation every frame from the **entity's state**, never the other way round:

```
downed? → downed
hurt recently? → hurt
ability phase? → that ability's animation, timed to the phase
moving? → walk-<dir>
otherwise → idle-<dir>
```

### Fallbacks and placeholders

- **Missing animation → fallback:** `ability1` falls back to `attack`, which falls back to `idle`. A missing direction uses `down`. In development, a console warning names what's missing, once.
- **Missing sprite entirely → generated placeholder:** a coloured rectangle with the character's initial (M, K, C, J), or a brown oval for dogs. The game always runs, and art can be added one piece at a time.

### Origin at the feet

Sprites use origin `(0.5, 1)`, the bottom centre, which is the feet. Then:
- the y-sort from the world blueprint uses the sprite's `y` directly
- the feet hitbox from the collision blueprint lines up without guessing offsets
- swapping characters of different heights keeps the feet in the same place

### Flash, tint and effects in code

Hit flash (white tint for 1–2 frames), invulnerability blink, shadows (a small dark oval under every actor) and the swap puff are done in code or effects, so artists don't draw them per character.

### Pixel-perfect rules (recap)

`pixelArt: true` and `roundPixels: true` are on, art is only ever drawn as textures, and nothing is rotated or scaled except by whole numbers.

---

## 7. Text and UI art

- Use a **pixel bitmap font** (free ones exist on itch.io and Lospec), loaded with Phaser's `BitmapText`, so text is crisp at 320×240. The current debug text uses a browser font, which is fine for development only.
- **Portraits** for the HUD and dialogue: 32×32 heads of each character. They can be the most detailed art of each of you.

---

## 8. Credits and licences

Any art, font or sound not made by you goes in `CREDITS.md` with its author and licence. Use only clearly licensed assets, ideally CC0 or CC-BY. This matters once the game link is shared.

---

## 9. Build order

1. **With the four placeholder characters:** the animator with fallbacks, generated placeholders (coloured rectangles with initials), origin at the feet, and shadows.
2. **When the photos come in:** choose the palette, then draw `idle-down` for all four and review together, then `walk` and `idle` in 3 directions, then load them through `load.aseprite`.
3. **With the first dog:** a chihuahua with `run`, `windup` and `attack`, and the hit spark and swap puff effects.
4. **Later:** terrain sets for water and paths, animated tiles, the bitmap font, portraits, and the `art:export` script.

---

## Sources

- [Pixelblog 22: top-down character sprites](https://www.slynyrd.com/blog/2019/10/21/pixelblog-22-top-down-character-sprites) and [Pixelblog 55: top-down character animation (Raymond Schlitter)](https://www.slynyrd.com/blog/2025/3/24/pixelblog-55-top-down-character-animation): 3/4 view, directions, walk cycles
- [Pixelblog 8: intro to animation](https://slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation): frame timing
- [How many sprites do different perspectives need (cxong)](https://cxong.github.io/2022/03/how-many-sprites-do-different-perspectives-need) and [sprite allocation for top-down directions (nesdev)](https://nesdev.nes.science/f21/t6703.xhtml): 4 directions are enough for 8-way movement
- [Sprite animation frame counts (sprite-ai)](https://www.sprite-ai.art/blog/sprite-animation-frames): 4-frame walks, 2–4-frame idles, 3–6-frame attacks with windup, strike and recovery, and adjusting timing when frames change
- [8-direction 6-frame character base (itch.io)](https://brendon-bancer.itch.io/top-down-character-base-8-directions-6-frames-32x32): how fast 8 directions multiply the frame count
- Phaser 4.2.1 guides bundled at `node_modules/phaser/skills/animations/SKILL.md` and `loading-assets/SKILL.md`: `load.aseprite`, atlases vs sprite sheets, `anims.create`
