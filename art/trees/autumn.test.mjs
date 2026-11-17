import fs from 'node:fs';
import { expect, test } from 'vitest';
import { decode } from '../png.mjs';
import { AUTUMN_OF, autumnize } from './autumn.mjs';

test.each(AUTUMN_OF)('autumn-%s.png is up to date with %s.png (run npm run art)', (name) => {
  const green = decode(fs.readFileSync(`public/assets/trees/${name}.png`));
  const built = decode(fs.readFileSync(`public/assets/trees/autumn-${name}.png`));
  expect([built.w, built.h]).toEqual([green.w, green.h]);
  expect(Buffer.from(built.px).equals(Buffer.from(autumnize(green.px)))).toBe(true);
});
