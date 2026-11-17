// The game's one palette. Every pixel of every asset must be one of these colors (see docs/art-style.md).
// Each ramp runs dark → light; `outline` is the color drawn around shapes made of that ramp.

export const ramps = {
  shadow: { colors: [0x241520, 0x3a1f2e, 0x5a2d3e, 0x7a4050], outline: 0x241520 },
  wood:   { colors: [0x4a2a2a, 0x6e3b30, 0x955536, 0xbb7845], outline: 0x3a1f2e },
  sand:   { colors: [0xb88d62, 0xd2ad80, 0xe6cc9e, 0xf6e8c4], outline: 0x6e3b30 },
  leaf:   { colors: [0x2c4632, 0x3e6a38, 0x5e9640, 0x8ebe48, 0xc8e46c], outline: 0x241520 },
  autumn: { colors: [0x7a2a36, 0xb4443a, 0xde7438, 0xf2a846, 0xffd77a], outline: 0x3a1f2e },
  berry:  { colors: [0x5c1f48, 0x943464, 0xd0607a, 0xf29a9a], outline: 0x241520 },
  stone:  { colors: [0x4a3c4e, 0x6c5a68, 0x94848a, 0xbcaea8], outline: 0x3a1f2e },
  water:  { colors: [0x2e4c84, 0x3d7cc4, 0x5eaee8, 0x8edcf2, 0xe6faf6], outline: 0x241520 },
  skin:   { colors: [0x8a5038, 0xb8754e, 0xd89a6c, 0xf0c49a], outline: 0x4a2a2a },
  light:  { colors: [0xfff6dc], outline: 0x7a4050 },
};

/** Every allowed color, as 0xRRGGBB. */
export const colors = [...new Set(Object.values(ramps).flatMap((r) => r.colors))];

/** True if 0xRRGGBB is in the palette. */
export const inPalette = (rgb) => colors.includes(rgb);

/** The palette color closest to 0xRRGGBB (plain RGB distance), for snapping generated art onto the palette. */
export function nearest(rgb) {
  const ch = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const [r, g, b] = ch(rgb);
  let best = colors[0], bestD = Infinity;
  for (const c of colors) {
    const [r2, g2, b2] = ch(c);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best;
}
