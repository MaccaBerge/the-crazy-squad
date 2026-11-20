# Cutscene blueprint

How the game tells its story while you play: **comic cutscenes** (Christian's comic pages, one panel at a time) and **in-engine cutscenes** (the live game takes the camera for a moment, like panning over to show the dogs guarding the next area). Both are lists of steps played by one runner.

It builds on the [game flow blueprint](game-flow-blueprint.md) §6 (story moments as data, skippable, remembered in the save), the [world blueprint](world-blueprint.md) §9 (`Zones` layer, `Trigger` zones, object references) and the [players, input and camera blueprint](players-input-camera-blueprint.md) §5 (camera rig, pixel rules).

---

## 1. Words

| Word | Meaning here |
|---|---|
| **In-engine cutscene** | A cutscene the game plays live with its own map, characters and dogs, not a picture or video. Also called a real-time or scripted cutscene. |
| **Reveal shot** | An in-engine cutscene that pans the camera to show what's ahead (enemies, a boss, a locked gate), then back. Film calls a shot that sets up a new place an *establishing shot*. |
| **Trigger zone** | An invisible rectangle on the map that starts something when a player walks in. |
| **Comic cutscene** | Christian's comic panels, shown full screen one at a time. |
| **Letterbox** | Black bars sliding in at the top and bottom. The usual signal for "you're watching now, not playing". |

---

## 2. Principles

1. **Cutscenes are data, not code.** A cutscene is a named list of steps in `src/story/cutscenes.ts`. Where it starts and what the camera looks at live in the Tiled map, so Christian can place and adjust them while building levels.
2. **One runner for both kinds.** A comic panel is just one more step type, so a level intro can show comic panels and then a reveal shot.
3. **Short and skippable.** Reveal shots last 2–4 s. Every cutscene can be skipped, and skipping lands on the same end state as watching.
4. **Each plays once.** Walking back through a trigger or restarting from a checkpoint doesn't replay it. The save remembers which story cutscenes you've seen.
5. **The world keeps living but can't hurt you.** Wind, grass, leaves and idle dogs keep moving, so the shot feels live. Nobody can attack, take damage or notice the player.
6. **Use them sparingly.** Only where the danger or the place really changes. If every corner has one, players stop watching.

---

## 3. Steps

Extends `StoryStep` from the game flow blueprint:

```ts
type Target = EntityRef | Point; // a map object (Tiled object reference) or a position

type CutsceneStep =
  // camera
  | { pan: { to: Target; ms: number; ease?: string } } // move the camera to look at a target
  | { track: { who: EntityRef; ms: number } }         // follow a moving actor for a while
  | { back: { ms: number } }                          // pan back to the player, then normal follow resumes
  | { shake: number }                                  // add camera trauma
  // timing and text
  | { wait: number }                                   // ms
  | { caption: { text: string; ms: number } }          // big title, e.g. "THE DOG MAFIA"
  | { say: Speaker; text: string }                     // text box with portrait (Dialogue scene)
  | { panels: string[] }                               // comic panels, one at a time (§7)
  // actors
  | { move: { who: EntityRef; to: Target } }           // walk an actor somewhere
  | { act: { who: EntityRef; anim: string } }          // play an animation: a bark, the boss flicking his cigar
  | { wake: EntityRef[] }                              // these dogs start hunting once control returns
  | { sound: string };
```

Example, a reveal shot for the forest gangsters:

```ts
'forest-gangsters': [
  { pan: { to: 'boss', ms: 1200, ease: 'Sine.easeInOut' } },
  { act: { who: 'boss', anim: 'taunt' } },
  { caption: { text: 'THE DOG MAFIA', ms: 1500 } },
  { back: { ms: 800 } },
],
```

`'boss'` names an object in the map (§4), not a position in code.

Every step has two ways to run: **play** (animated, over time) and **finish** (jump straight to its end state). Skipping calls `finish` on the current step and every step after it, so a skipped cutscene still moves its actors, wakes its dogs and returns the camera.

---

## 4. Starting a cutscene

**From the map.** A `Trigger` zone on the `Zones` layer (world blueprint §9) with these properties:

| Property | Type | What it does |
|---|---|---|
| `cutscene` | string | Id of the cutscene to play |
| `once` | bool, default `true` | Play only the first time anyone enters |
| `refs` | object references | Names the map objects the steps point at, e.g. `boss` → the gangster boss dog, `gate` → a `CameraPoint` object |

`CameraPoint` is a plain point object on the `Entities` layer for places the camera should look at that aren't an actor (a gate, the castle in the distance).

**From the level.** `LevelDef.intro` and `outro` (game flow blueprint §3) start one when the level begins or ends. Bosses can start one when their fight begins.

---

## 5. While a cutscene plays

| Part | What happens |
|---|---|
| **Input** | The controller's intent is ignored, so the player slows to a stop with the normal decel. Buffered presses are cleared at the end, so a press during the cutscene doesn't fire an attack or swap afterwards. Only skip is read. |
| **Player** | Invulnerable, can't swap. Swap cooldown, ability cooldowns and stamina pause. |
| **Dogs** | AI skips sight and attacks; they idle or do what the steps tell them. Dogs named in `wake` start hunting when control returns. |
| **Physics and nature** | Keep running. Don't use `world.pause()` for cutscenes: one flag (`cutscene` active) in `LevelScene.step()` decides what's frozen. |
| **HUD** | Slides out, letterbox bars (about 16 px each) slide in over 200 ms, and both reverse at the end. |
| **Camera** | `rig` stops following (`cam.stopFollow()`), steps use `cam.pan()`. `back` pans to the player and calls `rig.follow()` again. Camera bounds still apply, so a target near the map edge stops at the edge. |

**Zoom: no smooth zooming.** The camera blueprint's pixel rule (fixed zoom 1, no in-between zoom levels) holds in cutscenes too. If a shot needs to be closer, cut to 2× in one frame and cut back, never tween.

---

## 6. Skipping and remembering

- The first press of attack, interact or pause shows a small "skip ▸" prompt; a second press skips. Accidental presses don't skip something the player wanted to watch.
- Skipping runs `finish` on the remaining steps (§3), then hands back control.
- **Once per run:** a seen trigger stays seen through checkpoint restarts.
- **Once per save, for story cutscenes:** ids go into `save.story` (game flow blueprint §5). Reveal shots only need once per run. On a second visit they're quick, and players have already learned what they show.

---

## 7. Comic cutscenes

- **One image per panel**, cut out of Christian's pages: `public/assets/cutscenes/<episode>/<page>-<nn>.png`. A cutscene lists them in order with one `panels` step.
- **Shown as an HTML `<img>` over the canvas, not inside Phaser.** The game canvas is only 240 px tall with `pixelArt` on, so the comic art would be shrunk to 240 px and lose its detail. The overlay is fit to the window and fades between panels (about 200 ms).
- Press to go to the next panel; skip (§6) ends the whole run.
- **Text in the images** is the simplest start. Its limits: typos can't be fixed without redrawing, and the game can't be translated. Splitting text out of the art (drawn bubbles, text from data) can wait until it matters.

---

## 8. Co-op later

Online play isn't built yet. When it is: the first player to enter a trigger starts it for everyone, every player's input is frozen, and skip needs every player to press. Cutscenes run on the host and are sent to the others like any other event. Until then, assume one local player.

---

## 9. Code layout

```
src/story/
  steps.ts        CutsceneStep types
  runner.ts       plays a step list: play / finish per step, skip, done (tested with a fake clock)
  cutscenes.ts    all cutscenes as data (tested: every id used by a map or level exists)
  letterbox.ts    bars + HUD slide
  panels.ts       HTML overlay for comic panels
src/world/zones.ts   Trigger zone → runner (world blueprint §9)
```

`LevelScene` owns one `runner?`. In `step()`: while it runs, intent is treated as idle and dogs get `frozen: true`.

Tests:
- Steps play in order; `finish` gives the same end state as playing.
- Skip in the middle still wakes dogs and returns the camera.
- A `once` trigger doesn't play again after a checkpoint restart.
- Presses made during a cutscene don't fire afterwards.

---

## 10. Build order

1. **First:** fix the stuck hit freeze (hitstop resumes from a timer that can fire early and leave physics paused). Cutscenes freeze and resume things too, so this must be reliable.
2. **Reveal shot MVP:** runner with `pan`, `wait`, `back`, input lock, invulnerability, letterbox and skip. Started by one hard-coded rectangle on the test map.
3. **Trigger zones from Tiled:** read `Trigger` objects from the `Zones` layer with `cutscene`, `once` and `refs`, plus `CameraPoint`. This is the first piece of world blueprint §9 `zones.ts`.
4. **Actors and text:** `caption`, `act`, `move`, `wake`, `shake`, `sound`.
5. **Comic panels:** the HTML overlay and the first episode's panels.
6. **Save:** seen story cutscenes in `save.story`, once the save system exists.

---

## Open questions (for Christian)

- Which places get a reveal shot in each episode, and what each one shows.
- Caption style for area and enemy names (big title card, or small text in the letterbox bar).
- Keep the comic text in the images, or split it out later.

---

## Sources

- Phaser 4.2.1 cameras guide, bundled at `node_modules/phaser/skills/cameras/SKILL.md`: `cam.pan(x, y, duration, ease)`, `zoomTo`, `stopFollow` / `startFollow`
- [Tiled object properties](https://doc.mapeditor.org/en/stable/manual/custom-properties/): object reference properties, used for `refs`
