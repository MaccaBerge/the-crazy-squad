import * as Phaser from 'phaser';
import type { Vec } from '../movement';
import { DEPTH } from '../world/constants';
import { drawLightning, type Lightning, lightning, SLOWMO, streakColor } from './slowmo';

const TRAIL_MS = 600; // how far back the lightning trail reaches
const ARC_EVERY = 30; // ms between new arcs off the body
const LIGHT = 'speed-light';
type Sprite = Phaser.GameObjects.Sprite & { body: Phaser.Physics.Arcade.Body };
type Arc = { l: Lightning; born: number; life: number };

/**
 * Christian's slow-mo, on him: arcs of lightning crackling off his body and swept back as he runs, a trail of live
 * lightning strands along his path, glowing afterimages, and warm orange light round him that lights up the ground.
 * Everything is in the suit colours and drawn additively, so it reads as light, not paint.
 */
export class SpeedFx {
  private glow: Phaser.GameObjects.Graphics;
  private core: Phaser.GameObjects.Graphics;
  private light: Phaser.GameObjects.Image;
  private trail: (Vec & { t: number })[] = [];
  private arcs: Arc[] = []; // relative to his chest, so they ride along with him
  private nextArc = 0;
  private nextGhost = 0;
  private lastGhost: Vec = { x: 0, y: 0 };
  private streak?: Phaser.GameObjects.RenderTexture;
  private stamps: Phaser.GameObjects.Image[] = []; // one per pose: the texture draws them all at render(), so they can't share one
  private poses: (Vec & { frame: string | number; flip: boolean; t: number })[] = [];

  constructor(private scene: Phaser.Scene) {
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.effects + 1);
    this.core = scene.add.graphics().setDepth(DEPTH.effects + 2);
    if (!scene.textures.exists(LIGHT)) {
      // A round light in a few hard steps instead of a smooth gradient: it scales up into chunky pixel rings.
      const tex = scene.textures.createCanvas(LIGHT, 32, 32)!, ctx = tex.getContext();
      for (const [r, a] of [[16, 0.12], [13, 0.22], [10, 0.35], [7, 0.55], [4, 0.8]]) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(), ctx.arc(16, 16, r, 0, Math.PI * 2), ctx.fill();
      }
      tex.refresh();
    }
    this.light = scene.add.image(0, 0, LIGHT).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.effects - 2.75).setScale(2.25).setTint(SLOWMO.orange).setVisible(false);
  }

  /**
   * Per rendered frame. `k` is how strong slow-mo is right now (0 off, 1 full). `bolts` off: afterimages carry the look,
   * either as one merged `streak`, or as copies one every `gap` px (~10+ separate figures, ~2 blended).
   */
  update(now: number, s: Sprite, k: number, { bolts = true, gap = 2, streak = false } = {}) {
    this.drawStreak(now, s, k, !bolts && streak);
    const glow = this.glow.clear(), core = this.core.clear();
    if (k <= 0) {
      this.light.setVisible(false);
      this.trail = [];
      this.arcs = [];
      return;
    }
    const v = s.body.velocity, speed = v.length(), moving = speed > 10, chest = { x: s.x, y: s.y - 13 };
    const back = moving ? { x: -v.x / speed, y: -v.y / speed } : { x: 0, y: 0 };

    // Warm light round him, flickering with the electricity.
    this.light.setVisible(true).setPosition(chest.x, chest.y).setAlpha(k * (0.5 + 0.12 * Math.sin(now / 45) + Math.random() * 0.1));

    // Trail: live strands of lightning along where he just ran, re-jagged every frame so they writhe, fading behind.
    if (!bolts) (this.trail = []), (this.arcs = []);
    if (moving && bolts) this.trail.push({ x: chest.x, y: chest.y, t: now });
    this.trail = this.trail.filter((p) => now - p.t < TRAIL_MS);
    if (this.trail.length > 3) {
      const pts = this.trail.filter((_, i) => i % 3 === 0 || i === this.trail.length - 1);
      for (let strand = 0; strand < 3; strand++) {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], fade = 1 - (now - a.t) / TRAIL_MS;
          const w = (p: Vec, j: number) => ({ x: p.x + (Math.random() * 2 - 1) * 2 * (1 - j * 0.5), y: p.y + (strand - 1) * 3 + (Math.random() * 2 - 1) * 2 });
          drawLightning(glow, core, lightning(w(a, 0), w(b, 1), { depth: 2, jag: 0.35, fork: 0.1 }), k * fade * (strand === 1 ? 1 : 0.75), { thin: true });
        }
      }
    }

    // Arcs off his body: they start on him and reach out, swept behind him when he runs. Each lives a few frames.
    if (bolts && now >= this.nextArc) {
      this.nextArc = now + ARC_EVERY;
      for (let n = 0; n < 2; n++) {
        const from = { x: (Math.random() * 2 - 1) * 5, y: (Math.random() * 2 - 1) * 10 };
        const ang = Math.random() * Math.PI * 2, reach = 7 + Math.random() * 11;
        const to = { x: from.x + Math.cos(ang) * reach + back.x * 12, y: from.y + Math.sin(ang) * reach * 1.3 + back.y * 12 };
        this.arcs.push({ l: lightning(from, to, { depth: 3, jag: 0.3, fork: 0.2 }), born: now, life: 60 + Math.random() * 80 });
      }
    }
    this.arcs = this.arcs.filter((a) => now - a.born < a.life);
    for (const a of this.arcs) {
      const flick = Math.random() < 0.15 ? 0.3 : 1; // the odd frame dims, so it crackles
      drawLightning(glow, core, a.l, k * flick * (1 - (now - a.born) / a.life), { at: chest, thin: true });
    }

    // Afterimages: copies of him left behind as he runs. With the lightning they're a faint orange glow; without, they
    // carry the look: brighter, longer, and cooling from gold through orange to red as they fade, a speedster's streak.
    if (moving && !(streak && !bolts) && (bolts ? now >= this.nextGhost : Phaser.Math.Distance.BetweenPoints(s, this.lastGhost) >= gap)) {
      this.nextGhost = now + 45;
      this.lastGhost = { x: s.x, y: s.y };
      const ghost = this.scene.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(0.5, 1).setFlipX(s.flipX).setDepth(s.depth - 0.5)
        .setTint(bolts ? SLOWMO.orange : SLOWMO.gold).setTintMode(Phaser.TintModes.FILL).setBlendMode(Phaser.BlendModes.ADD).setAlpha((bolts ? 0.2 : 0.5 * Math.min(1, gap / 5)) * k * s.alpha); // closer copies overlap more, so each is fainter; they fade with his i-frame flicker too, or they pile into a white blob
      const ramp = [SLOWMO.gold, SLOWMO.orange, SLOWMO.red];
      this.scene.tweens.add({
        targets: ghost, alpha: 0, duration: bolts ? 200 : 380,
        onUpdate: (tw) => bolts || ghost.setTint(ramp[Math.min(2, Math.floor(tw.progress * 3))]), // stepped, not blended: pixel art
        onComplete: () => ghost.destroy(),
      });
    }
  }

  /**
   * One merged afterimage: every frame, his last STREAK_MS of poses are drawn as solid silhouettes into one texture,
   * oldest first, so where they overlap the newest wins instead of piling up. Each is coloured by its age (gold → orange
   * → red) and darkened toward black, and the texture is drawn additively, where black is see-through: one shape with a
   * colour gradient and a fade along it.
   */
  private drawStreak(now: number, s: Sprite, k: number, on: boolean) {
    if (!on || k <= 0) {
      this.poses = [];
      this.streak?.setVisible(false);
      return;
    }
    if (!this.streak) {
      this.streak = this.scene.add.renderTexture(0, 0, STREAK_W, STREAK_H).setBlendMode(Phaser.BlendModes.ADD);
    }
    if (s.body.velocity.length() > 10) this.poses.push({ x: s.x, y: s.y, frame: s.frame.name, flip: s.flipX, t: now });
    this.poses = this.poses.filter((p) => now - p.t < STREAK_MS);
    const cx = Math.round(s.x), cy = Math.round(s.y - 16), left = cx - STREAK_W / 2, top = cy - STREAK_H / 2;
    const rt = this.streak.setVisible(true).setPosition(cx, cy).setDepth(s.depth - 0.5).setAlpha(k).clear();
    this.poses.forEach((p, i) => {
      const stamp = (this.stamps[i] ??= new Phaser.GameObjects.Image(this.scene, 0, 0, s.texture.key).setOrigin(0.5, 1).setTintMode(Phaser.TintModes.FILL));
      stamp.setTexture(s.texture.key, p.frame).setFlipX(p.flip).setTint(streakColor((now - p.t) / STREAK_MS));
      rt.draw(stamp, Math.round(p.x - left), Math.round(p.y - top));
    });
    rt.render();
  }
}

const STREAK_MS = 380; // how far back the merged afterimage reaches
const STREAK_W = 192, STREAK_H = 192; // px, centred on his middle: room for the ~70 px streak in any direction
