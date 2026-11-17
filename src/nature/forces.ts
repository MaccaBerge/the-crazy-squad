// Things that push nature aside (nature blueprint §4): an ellipse around a body's feet.
// Anything with a body adds one per frame; the grass doesn't need to know what made it.

export interface Force {
  x: number;
  y: number;
  rx: number; // half-width, px
  ry: number; // half-height, px (squashed: the ground is seen at an angle)
}

/** The force of a body standing with its feet at (x, y), `width` px wide. */
export const footForce = (x: number, y: number, width: number): Force => ({ x, y: y - 1, rx: width / 2 + 3, ry: 5 });
