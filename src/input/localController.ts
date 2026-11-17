import { ACTIONS, type Action } from './actions';
import { ACTION_KEYS, MOVE_KEYS, SPRINT_KEYS } from './bindings';
import type { Intent } from './intent';

/** How long a press stays usable if the action isn't possible yet (players blueprint §4). */
export const BUFFER_MS = 120;

const actionFor = (combo: string, code: string) =>
  ACTIONS.find((a) => ACTION_KEYS[a].includes(combo)) ?? ACTIONS.find((a) => ACTION_KEYS[a].includes(code));

const ALL_CODES = new Set([...Object.values(MOVE_KEYS).flat(), ...SPRINT_KEYS, ...Object.values(ACTION_KEYS).flat().map((k) => k.replace('Shift+', ''))]);

/** Keyboard → Intent for the character the person at this computer controls. */
export class LocalController {
  private held = new Set<string>();
  private buffer = new Map<Action, number>(); // action → time pressed

  keyDown(code: string, shift: boolean, now: number) {
    this.held.add(code);
    const action = actionFor(shift ? `Shift+${code}` : code, code);
    if (action) this.buffer.set(action, now);
  }

  keyUp(code: string) {
    this.held.delete(code);
  }

  /** Forget everything, e.g. when the window loses focus, so no key stays stuck down. */
  clear() {
    this.held.clear();
    this.buffer.clear();
  }

  getIntent(now: number): Intent {
    for (const [a, t] of this.buffer) if (now - t > BUFFER_MS) this.buffer.delete(a);
    const down = (dir: keyof typeof MOVE_KEYS) => MOVE_KEYS[dir].some((c) => this.held.has(c));
    return {
      move: { x: Number(down('right')) - Number(down('left')), y: Number(down('down')) - Number(down('up')) },
      sprint: SPRINT_KEYS.some((c) => this.held.has(c)),
      pressed: new Set(this.buffer.keys()),
    };
  }

  /** Mark a buffered press as used, so it fires once. */
  consume(action: Action) {
    this.buffer.delete(action);
  }

  /** Wire to the browser. Returns a function that removes the listeners. */
  attach(target: Window = window) {
    const down = (e: KeyboardEvent) => {
      if (!ALL_CODES.has(e.code)) return;
      e.preventDefault(); // stop arrows/Space scrolling the page and Tab moving focus
      if (!e.repeat) this.keyDown(e.code, e.shiftKey, performance.now());
    };
    const up = (e: KeyboardEvent) => this.keyUp(e.code);
    const reset = () => this.clear();
    const hidden = () => document.hidden && this.clear();
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', hidden);
    };
  }
}
