import { TILE } from './constants';

/** Pixel position → tile index. */
export const toTile = (px: number) => Math.floor(px / TILE);

/** Tile index → pixel position of that tile's centre. */
export const tileCenter = (tile: number) => tile * TILE + TILE / 2;
