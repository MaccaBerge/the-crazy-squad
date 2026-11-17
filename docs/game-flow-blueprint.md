# Game flow and progress blueprint

The frame around the levels: screens, getting from the title to the cat, pausing, checkpoints, saving progress, story moments and settings. It builds on the [world blueprint](world-blueprint.md) (levels are Tiled maps, zones), the [players, input and camera blueprint](players-input-camera-blueprint.md) (pause on blur, swapping, going down) and the [art blueprint](art-animation-blueprint.md) (portraits, bitmap font).

---

## 1. Principles

1. **One scene per screen, with the HUD and overlays running alongside.** Phaser scenes can run in parallel, so the HUD, pause menu and dialogue sit on top of the level without the level knowing about them.
2. **Levels are a list of data.** Adding a level means adding a Tiled map and one entry in `levels.ts`.
3. **Saves are versioned from day one.** Every save has a version number and a migration path. Retrofitting this later is the most common web-game save mistake.
4. **The game works without saving.** Private windows and cleared browser data happen. The game then plays fine and just doesn't remember progress.

---

## 2. Screens (scenes)

```
Boot ─► Preload ─► Title ─┬─► Level select ─► Level ──┬─► Level complete ─► Level select / next
                          │        ▲                   ├─► (all four down) ─► restart at checkpoint
                          │        └── Story moment ◄──┘
                          ├─► Settings
                          └─► Credits
 Running on top of Level: HUD (always) · Pause (Esc) · Dialogue (story moments)
```

| Scene | What it does |
|---|---|
| `Boot` | Loads the tiny assets the loading screen needs (font, logo) |
| `Preload` | Loads shared assets (characters, dogs, effects, UI) with a progress bar. Level-specific maps and tilesets load when a level starts. |
| `Title` | Logo, "Press any key", and options: continue, new game, settings, credits |
| `LevelSelect` | A **map of the route to Jonas' cat**: a path of level nodes from home to the rescue. Locked, unlocked and completed nodes, plus collectibles found per level. |
| `Level` | The generic level scene from the world blueprint. Loads a map by key and runs it. |
| `HUD` | Runs on top of `Level`: portraits, health, swap and ability cooldowns |
| `Pause` | Runs on top of and pauses `Level`: resume, restart from checkpoint, settings, quit to map |
| `Dialogue` | Runs on top of `Level` (or the map) for story moments |
| `LevelComplete` | Short results: time, collectibles, "next level" |
| `Settings` | Volume, screen shake, and later key bindings |
| `Credits` | You four, plus anything in `CREDITS.md` |

Scene changes use a short camera **fade** (about 200 ms).

---

## 3. Levels

```ts
// src/levels.ts
type LevelDef = {
  id: string;            // 'backyard'
  map: string;           // Tiled map key, see the world blueprint
  name: string;          // 'The Backyard'
  intro?: StoryId;       // story moment before the level
  outro?: StoryId;       // story moment after
  unlockAfter?: string;  // level id that must be completed first (default: the previous one)
  music?: string;
};
export const levels: LevelDef[] = [ /* in route order, ending with the cat rescue */ ];
```

- The route is **linear to start**, with an optional side level here and there later.
- A level ends at a `LevelExit` zone (world blueprint) or when a goal is met, such as defeating a boss or freeing something.
- The **final level** ends with rescuing Jonas' cat, followed by the ending story moment and credits.
- A test checks that every `LevelDef.map` exists, so the existing map check also covers every level.

---

## 4. Checkpoints and going down

- **`Checkpoint`** is a zone class in Tiled. Touching it saves a **checkpoint record** for this level run, with a small effect and sound:
  - position, and which character is active
  - each squad member's health, with downed members brought back at partial health (players blueprint)
  - **permanent level progress:** doors opened, switches flipped, collectibles taken, bosses beaten, by entity id
- **All four down** means a short "squad down" screen, then the level reloads from scratch and the checkpoint record is applied. The player is placed there, and permanent progress is re-applied, so opened doors stay open and taken collectibles stay gone. Ordinary dogs come back.
- This is the standard checkpoint model in action games: simple and predictable, with no need to save every dog's state.
- Checkpoint records last for the current level run only. **Quitting a level mid-way** starts it from the beginning next time. Mid-level saves can be added later if levels get long.

---

## 5. Saving progress

### What's saved

```ts
// src/save/types.ts
type SaveV1 = {
  version: 1;
  completed: Record<LevelId, { bestTime: number; collectibles: string[] }>;
  unlocked: LevelId[];
  story: Record<StoryId, true>;    // story moments already seen (so they can be skipped)
  playTime: number;
};
// Settings are saved separately: they apply even if progress is reset.
type SettingsV1 = { version: 1; musicVolume: number; sfxVolume: number; shake: 'full' | 'reduced' | 'off' };
```

### Where and when

- In the browser's **localStorage** under `crazy-squad/save` and `crazy-squad/settings`. That's plenty for this small JSON, and IndexedDB isn't needed.
- **Saved** when a level is completed, a story moment finishes, or settings change. Not on every frame.
- **Writes are safe:** write the new save, keep the previous one as `crazy-squad/save.bak`, and if the main save fails to read or validate, fall back to the backup.
- **Every read is wrapped in error handling.** If storage is blocked or full, the game continues without saving and shows a one-time note.

### Versions and migrations

- `src/save/migrate.ts` has a chain `v1 → v2 → …`. When the save format changes, bump the version and add one function that upgrades the old shape.
- `src/save/validate.ts` checks the shape after loading. Unknown level ids, for example from a deleted level, are dropped instead of crashing.
- Both are **unit-tested** with sample saves from each version.

### Later, maybe

**Export / import save** as a file, a cheap way to move progress between computers. Cloud saves only if online play gets built.

---

## 6. Story moments

The story is light but matters: it's why you're chasing the dogs.

- A story moment is **data**: a list of steps run by the `Dialogue` scene and a small script runner.
  ```ts
  type StoryStep =
    | { say: CharacterId | 'cat' | 'dog-boss'; text: string }  // text box with portrait
    | { pan: { to: EntityRef; ms: number } }                   // camera pan (camera blueprint)
    | { move: { who: EntityRef; to: Point } }                  // walk an actor somewhere
    | { wait: number }
    | { sound: string };
  ```
- **Text boxes** at the bottom of the screen, with the speaker's portrait and name. Text types out, a press shows it all at once, and the next press continues.
- **Every story moment can be skipped**, and the save remembers which ones have been seen.
- Gameplay is paused during story moments. They're local only, so they don't affect online play later.
- Idea for the opening: the dogs grab Jonas' cat, a quick chase, the dogs escape, and the route map appears.

---

## 7. Pause and focus

- **Esc / P / Start** opens `Pause`. It pauses the level scene, including physics, timers and animations, and the swap cooldown, ability cooldowns and statuses all freeze.
- The game **auto-pauses** when the window loses focus or the tab is hidden (input blueprint).
- The pause menu shows the controls, so a friend picking up the game can learn them there.

---

## 8. Audio (light)

- **Music** per level or area (`LevelDef.music`), cross-fading on scene changes. **Sound effects** for every ability, hit, bark, pickup, swap and UI action.
- Two volume sliders (music, effects) in Settings.
- Browsers block audio until the first click or key press. The "Press any key" title screen exists partly for this.
- Sounds are named by what they're for (`swap`, `hit-light`, `bark-small`) and listed in `CREDITS.md` if not made by you.

---

## 9. Collectibles and replay (optional)

To make levels worth replaying, each level could hide a few **cat treats** (collectibles). The level select shows how many you found, plus a best time. Collecting them all might unlock a bonus, like a costume or a secret level. Decide this once the first real level exists.

---

## 10. Code layout

```
src/
  scenes/
    Boot.ts  Preload.ts  Title.ts  LevelSelect.ts  Level.ts
    Hud.ts  Pause.ts  Dialogue.ts  LevelComplete.ts  Settings.ts  Credits.ts
  levels.ts            the level list (tested: every map exists)
  save/
    types.ts           SaveV1, SettingsV1
    storage.ts         safe read/write with backup and error handling
    migrate.ts         version upgrades (tested)
    validate.ts        shape checks (tested)
  story/
    stories.ts         all story moments as data
    runner.ts          runs StoryStep lists
  audio/
    audio.ts           music + effects helpers, volume from settings
```

---

## 11. Build order

1. **Soon (with the four characters):** split today's single scene into `Boot` → `Preload` → `Level` + `HUD`, add the `Pause` overlay with auto-pause, and add `levels.ts` with the test map.
2. **With the first real level:** `Checkpoint` zones, restart from checkpoint when all four are down, `LevelExit` → `LevelComplete`.
3. **With two or more levels:** `Title`, `LevelSelect` route map, save and settings with versioning and tests.
4. **With the story written:** `Dialogue` and the story runner, the opening and ending, portraits.
5. **Polish:** music and sound, collectibles, credits, export / import save.

---

## Sources

- Phaser 4.2.1 scenes guide, bundled at `node_modules/phaser/skills/scenes/SKILL.md`: `scene.launch` / `run` for parallel scenes (HUD, pause), `start` / `switch`, pausing and sleeping
- [What are save systems (abratabia)](https://www.abratabia.com/game-saves/what-are-save-systems.php), [localStorage saves (abratabia)](https://www.abratabia.com/game-saves/localstorage-saves.php) and [game save best practices for the web (bugnet)](https://bugnet.io/blog/game-save-best-practices-web): checkpoints at natural breakpoints, version fields from the start, migrations, validation, browser storage limits and eviction, export / import
- [Save system design (endless-idle wiki)](https://endless-idle-wiki.pages.dev/dev/design/saves): migration chains, storing the highest unlocked level
- [Using checkpoints and savegames (Whimsy)](https://whimsywebsite.netlify.app/n/making-games/checkpoints-and-savegames): checkpoint vs save game
