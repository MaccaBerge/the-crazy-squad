import * as Phaser from 'phaser';
import { DEPTH } from '../world/constants';
import type { MapObject } from '../world/spawner';
import { type Flag, flagPixels, flagStep, isHangingKind, lineClothes, linePixels, type Pendulum, type Px, signPixels, swingStep } from './hangingShapes';
import type { WindParams } from './weather';
import { prevailing, windAt } from './wind';

// Hanging things (nature blueprint §6) from the map's `Hanging` layer: signs and flags are points where the post meets
// the ground; a washing line is a rectangle whose bottom edge runs between its two posts. Each has its own small canvas,
// redrawn only when its pixels change.

interface Thing {
  draw: (t: number) => Px[];
  swing: (lean: number, dt: number, windSide: number) => void; // lean: sideways wind here; windSide: the weather's side
  tex: Phaser.Textures.CanvasTexture;
  box: { left: number; top: number };
  x: number;
  y: number;
  drawn: number; // hash of the pixels on the canvas now
}

const hash = (px: Px[]) => px.reduce((h, p) => (Math.imul(h, 31) + p.x * 977 + p.y * 13 + p.color) | 0, 7);

export class Hanging {
  private things: Thing[] = [];

  constructor(private scene: Phaser.Scene, objects: MapObject[]) {
    for (const o of objects) {
      if (!isHangingKind(o.type)) continue; // the map test rejects unknown types
      const flex = 0.8 + ((o.id * 7919) % 100) / 250; // things differ a little in how far they swing
      const x = Math.round(o.x ?? 0), y = Math.round((o.y ?? 0) + (o.type === 'line' ? (o.height ?? 0) : 0));
      if (o.type === 'sign') {
        const p: Pendulum = { a: 0, v: 0 };
        this.add(o.id, x, y, { left: -6, top: -26, w: 26, h: 26 }, () => signPixels(p.a), (lean, dt) => swingStep(p, lean, dt, flex));
      } else if (o.type === 'flag') {
        const f: Flag = { strength: 0, side: 1 };
        this.add(o.id, x, y, { left: -14, top: -34, w: 30, h: 34 }, (t) => flagPixels(f.strength, f.side, t),
          (lean, dt, windSide) => flagStep(f, lean, windSide, dt, flex));
      } else {
        const width = Math.max(24, Math.round(o.width ?? 0));
        const pieces: Pendulum[] = lineClothes(width).map(() => ({ a: 0, v: 0 }));
        this.add(o.id, x, y, { left: -6, top: -20, w: width + 14, h: 20 },
          () => linePixels(width, pieces.map((p) => p.a)),
          (lean, dt) => pieces.forEach((p, i) => swingStep(p, lean, dt, flex * (0.75 + ((i * 3) % 5) / 8))));
      }
    }
  }

  private add(id: number, x: number, y: number, box: { left: number; top: number; w: number; h: number },
    draw: Thing['draw'], swing: Thing['swing']) {
    const key = `hanging:${id}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key); // left over from before a level restart
    const tex = this.scene.textures.createCanvas(key, box.w, box.h)!;
    this.scene.add.image(x + box.left, y + box.top, tex).setOrigin(0).setDepth(DEPTH.actors + y);
    this.things.push({ draw, swing, tex, box, x, y, drawn: 0 });
  }

  update(t: number, dt: number, weather: WindParams) {
    const side = Math.cos(prevailing(t, weather)); // flags fly to the side the wind is blowing to overall
    for (const thing of this.things) {
      thing.swing(windAt(thing.x, thing.y - 20, t, weather).x, dt, Math.abs(side) < 0.1 ? 0 : Math.sign(side));
      const px = thing.draw(t);
      const h = hash(px);
      if (h === thing.drawn) continue;
      thing.drawn = h;
      const ctx = thing.tex.getContext();
      const img = ctx.createImageData(thing.tex.width, thing.tex.height);
      for (const p of px) {
        const x = p.x - thing.box.left, y = p.y - thing.box.top;
        if (x >= 0 && y >= 0 && x < img.width && y < img.height) img.data.set([p.color >> 16, (p.color >> 8) & 255, p.color & 255, 255], (y * img.width + x) * 4);
      }
      ctx.putImageData(img, 0, 0);
      thing.tex.refresh();
    }
  }
}
