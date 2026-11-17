import type { Action } from './actions';

// Physical key positions (KeyboardEvent.code), so WASD stays put on Nordic and other layouts.
// 'Shift+X' only matches with Shift held; plain 'X' matches with or without it.
export const MOVE_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const;

/** Held, not pressed: sprinting lasts while one of these is down. */
export const SPRINT_KEYS = ['ShiftLeft', 'ShiftRight'];

export const ACTION_KEYS: Record<Action, string[]> = {
  attack: ['KeyJ', 'Space'],
  ability1: ['KeyK'],
  ability2: ['KeyL'],
  interact: ['KeyE'],
  swapNext: ['Tab'],
  swapPrev: ['Shift+Tab'],
  swap1: ['Digit1'],
  swap2: ['Digit2'],
  swap3: ['Digit3'],
  swap4: ['Digit4'],
  pause: ['Escape', 'KeyP'],
};
