import * as Phaser from 'phaser';
import { ShimmerNode } from './shimmer';
import { ShockwaveNode } from './shockwave';

const registered = new WeakSet<Phaser.Game>();

/**
 * Our own shader filters (shader blueprint §3), added to the renderer once per game. Returns false without WebGL
 * (Canvas fallback): then there are no filters, and effects just skip.
 */
export function registerFilters(game: Phaser.Game) {
  if (game.renderer.type !== Phaser.WEBGL) return false;
  if (registered.has(game)) return true;
  const nodes = (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).renderNodes;
  nodes.addNodeConstructor('FilterShockwave', ShockwaveNode);
  nodes.addNodeConstructor('FilterShimmer', ShimmerNode);
  registered.add(game);
  return true;
}
