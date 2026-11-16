// Builds every art/characters/*.mjs into public/assets/sprites/<id>.png + <id>.anims.json (art blueprint §4, Piskel-style route).
// `node art/build.mjs --preview <dir>` also writes 8× previews there for review.
import fs from 'node:fs';
import path from 'node:path';
import { sheet } from './png.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/assets/sprites');
const preview = process.argv.includes('--preview') ? process.argv[process.argv.indexOf('--preview') + 1] : null;
fs.mkdirSync(out, { recursive: true });
for (const file of fs.readdirSync(path.join(import.meta.dirname, 'characters'))) {
  const id = path.basename(file, '.mjs');
  const { frames, palette, anims, size, columns } = await import(`./characters/${file}`);
  fs.writeFileSync(path.join(out, `${id}.png`), sheet(frames, palette, size, columns));
  fs.writeFileSync(path.join(out, `${id}.anims.json`), JSON.stringify({ frameWidth: size, frameHeight: size, anims }, null, 2) + '\n');
  if (preview) fs.writeFileSync(path.join(preview, `${id}-preview.png`), sheet(frames, palette, size, columns, 8, 0x2d5a27));
  console.log('built', id);
}
