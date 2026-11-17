# Art style

Rich top-down pixel art: warm characters and props in a cooler, lush nature (deep blue-violet shade, teal and fern greens). Nothing should look flat or grey.

The palette lives in [`art/palette.mjs`](../art/palette.mjs).

Tiles and world objects follow these rules plus the ones in [world-art-style.md](world-art-style.md).

## Rules

1. **Strict palette.** Every pixel of every asset is a color from `art/palette.mjs`. Generated art (PixelLab or anything else) is snapped onto the palette before it goes in the game.
2. **No black, no grey, no pure white.** The darkest warm color is plum `#241520`, the darkest cool one is night blue `#1c1440`; the lightest is cream `#fff6dc`. Stones are purple-grey, not neutral.
   - **Warm for us, cool for nature.** Characters, props and buildings use the warm ramps. The cool ramps (dusk, teal, fern, moss, violet) are for nature: forest shade, canopies, ground cover. The contrast keeps the squad readable on any ground.
3. **Hue-shift the ramps.** Shadows lean toward plum and red, highlights toward yellow. Never darken or lighten by just adding black or white.
4. **Tinted outlines.** A shape is outlined with its ramp's `outline` color (the darkest tone of that ramp or a warm dark next to it), not one shared black line. Sand edges are outlined in wood brown, leaves in plum, and so on.
5. **Calm ground, few accents.** Large areas are the middle steps of sand, leaf, moss or fern. Autumn and berry are accents that should pop because the base is softer.

## Sizes

- Tiles: 16×16 (`TILE` in `src/world/constants.ts`).
- Characters: 32×32 frames.

## Ramps

| Ramp | Use |
|------|-----|
| shadow | outlines, deepest shadows |
| wood | bark, trunks, crates, buildings |
| sand | paths, open ground |
| leaf | grass, bushes, tree tops |
| autumn | autumn trees, fire, warm accents, gold |
| berry | flowers, magic, highlight accents |
| stone | rocks, ruins, metal |
| water | water, sky, ice |
| skin | character skin |
| light | brightest highlight |
| dusk | deep forest shade, night, darkest canopy tones |
| teal | canopies, cool water edges, foliage highlights |
| fern | lush grass and leaves |
| moss | dry grass, mossy ground, olive foliage |
| violet | flowers, berries and magic in the wild |
