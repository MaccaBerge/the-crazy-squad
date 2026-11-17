# Art style

Warm, rich top-down pixel art. Even the darkest colors are warm. Nothing should look flat or grey.

The palette lives in [`art/palette.mjs`](../art/palette.mjs).

## Rules

1. **Strict palette.** Every pixel of every asset is a color from `art/palette.mjs`. Generated art (PixelLab or anything else) is snapped onto the palette before it goes in the game.
2. **No black, no grey, no pure white.** The darkest color is plum `#241520`; the lightest is cream `#fff6dc`. Stones are purple-grey, not neutral.
3. **Hue-shift the ramps.** Shadows lean toward plum and red, highlights toward yellow. Never darken or lighten by just adding black or white.
4. **Tinted outlines.** A shape is outlined with its ramp's `outline` color (the darkest tone of that ramp or a warm dark next to it), not one shared black line. Sand edges are outlined in wood brown, leaves in plum, and so on.
5. **Warm ground, few accents.** Large areas are sand and leaf. Autumn and berry are accents that should pop because the base is softer.

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
