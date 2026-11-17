# World art style

How the world's tiles and objects are drawn so that they belong together and with the characters. It builds on [art-style.md](art-style.md) (the palette, tinted outlines, hue-shifted ramps) and the [art and animation blueprint](art-animation-blueprint.md) (16×16 tiles, 3/4 view, light from the top-left, Tiled tilesets).

## Direction

- **Setting:** the route to Jonas's cat starts in a Norwegian neighbourhood (backyards, wooden houses and fences, gardens, roads) and gets wilder on the way: forest edge, forest, fields, water.
- **Season:** late summer. Green is the base; autumn colours are accents (a few orange or red trees, fallen leaves, berries).
- **Ground:** rich and detailed, but calm in value, so the characters still stand out (rule 4).
- **Objects:** a tinted outline around the outer silhouette only.

## Rules

Every world asset follows all of these. They're also the review checklist.

1. **One pixel is one pixel.** Never scale an asset up or down, and never mix resolutions. The smallest detail is 1 px, and details are about the same size on every object.
2. **Same view for everything.** Classic 3/4 top-down: you see the top and the front of things. Front faces (walls, fence boards, trunks, crate sides) are drawn straight up; top faces are squashed to about half their real depth. No side faces from an angle, and no true perspective.
3. **Same light for everything.** Light comes from the top-left:
   - top faces are the lightest,
   - left-facing parts are a step darker,
   - front faces and right-facing parts are the darkest,
   - highlights sit on top-left edges, shadows on bottom-right edges.
4. **The ground stays in the middle.** Ground tiles use the **two or three middle steps** of their ramp: never the ramp's darkest step, the outline colours, or the lightest highlight. Texture comes from small clusters of those middle tones (blades, pebbles, cracks, 2–4 px each), not single-pixel noise. Characters and objects use the full ramp plus outlines, so they always read above even a busy ground.
5. **Outlines on objects, not on ground.**
   - Objects get a 1 px outline around the outer silhouette in their ramp's `outline` colour.
   - Inner details (planks, windows, leaf clumps) are separated by shading, not lines.
   - Ground tiles and ground transitions never get outlines.
   - Flat things lying on the ground (puddles, leaf piles, rugs) are ground, not objects: no outline.
6. **Shading steps.** At most 3 tones of a ramp per material, plus one highlight. Use soft edges between tones (a few stepped pixels), not dithering. Mix ramps only where materials meet: wood frame, stone base.
7. **Contact shadows, not cast shadows.** Objects get a short shadow at their base, one ground tone darker, spreading down-right. There are no long cast shadows. Actors already get their shadow oval from code.
8. **Accents are rare.** Autumn and berry colours cover a small part of any screen: one orange tree among greens, flowers in small clusters, a red door. If everything pops, nothing does.
9. **Scale follows the characters.** The characters are about 14 px wide and 28–30 px tall (just under 2 tiles).

| Object | Size |
|---|---|
| Door | 1 tile wide, about 2 tiles tall, so a character fits through |
| Fence | 1 tile tall |
| Hedge or bush | 1–2 tiles |
| Crate | 1 tile |
| Rock | ½–2 tiles |
| Small tree | 2×3 tiles |
| Big tree | 3×4 tiles or more |
| House wall | 2–3 tiles per storey, plus the roof |

10. **Tall things split in two.** Anything a character can walk behind is drawn as two parts: the base, on the `Walls` or `Decor` layer, where the hitbox is, and the top, on the `Above` layer. Treetops and roofs are tops; trunks and wall bottoms are bases. The base is what blocks movement.

## Materials

Which ramps each material uses. Ground tiles use only the middle steps (rule 4).

| Material | Ramps | Notes |
|---|---|---|
| Grass | leaf (middle steps) | Tufts and blades as small clusters; sparse flowers in berry or autumn |
| Dirt and paths | sand, wood for the darker patches | Pebbles in stone |
| Gravel and road | stone, sand | Light on top-left edges of the bigger stones |
| Wood (fences, houses, crates) | wood | Planks shown by shading, not lines; the light top edge of each board |
| Painted wood (house walls) | berry or autumn for the classic red or yellow Norwegian house, wood for the trim | Keep it one or two steps from the ramp's lightest |
| Stone and rock | stone | Purple-grey, never neutral grey; moss in leaf |
| Leaves and tree tops | leaf; autumn for accent trees | Clumps lit top-left, a dark leaf tone under each clump |
| Water | water | Lighter near the edges, a light ripple line; a sand or stone shore |
| Metal (bins, signs, bikes) | stone, water for the shine | Small and rare |

## How we make them

1. **Style test first.** Before making whole tilesets, make one small Backyard scene: a grass tileset with its edge to a dirt path, a fence piece, a bush, a small tree, a rock, a crate and a piece of house wall. Stand the four characters in it and check every rule above. Adjust the rules (or the palette) here, while it's cheap.
2. **Generate, then fix.** PixelLab generates candidates (asking for approval first, like the characters). Everything is snapped onto the palette and checked against the rules; small fixes are done by hand.
3. **Palette check in the build.** `art/build.mjs` checks only character sprites today. It gets the same strict palette check for tilesets and objects before the first one goes in, so an off-palette pixel fails the build.
4. **Then by area, in route order:** Backyard, neighbourhood street, forest edge, forest, fields and water. Each area's tileset is finished and tested in a map before the next one starts.
