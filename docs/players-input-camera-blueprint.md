# Players, input and camera blueprint

How a person controls the squad, how key presses and controller buttons become actions, and what the camera shows. It sits next to the [world blueprint](world-blueprint.md) and the collision blueprint.

## Decisions

- **Singleplayer first.** One person plays on one computer.
- **No local multiplayer or split screen.**
- **Online multiplayer may come later.** Nothing we build now may make that harder. [Section 3](#3-online-ready-architecture) lists exactly what that means in practice.
- **One character on the map at a time.** You play as one of the four and **swap** to another in place. After a swap, you must wait out a **swap cooldown** before swapping again. There are no AI teammates. Later, online, each friend controls one of the four, using the same code path. See [section 2](#2-the-squad-in-singleplayer).

---

## 1. Principles

1. **Characters never read the keyboard.** A character is driven by an **intent**: "move this way, attack, use ability 1". Something else produces that intent: your keyboard, a controller, a dog's AI, or later a network message. This one split is what keeps online play possible.
2. **Gameplay reacts to actions, not keys.** Code checks `attack`, never `Space`. Keys and buttons are mapped to actions in one data file.
3. **There is no global "the player".** There's a *local player* (the person at this computer) who currently controls *a character*. The camera, HUD and input prompts follow `localPlayer.character`, which can change when you swap, and later differs per computer online.
4. **Gameplay state is plain data on entities.** Health, cooldowns, positions and who's downed live in component fields, not in visual properties like "the sprite is half transparent so it must be invulnerable". Plain data can later be sent over the network.
5. **The camera is for the local player only.** It has no effect on gameplay.

---

## 2. The squad in singleplayer

### One character at a time, swap with a cooldown

- **Only the character you're playing is on the map.** The other three are "off stage".
- **Swapping replaces the character in place.** The new character appears where the old one stood, facing the same way, with a short swap effect (a puff of smoke and a sound).
- **Swap cooldown:** after any swap, swapping is locked for a while, about **4 s** to start and tunable in the T panel. This makes *who you're playing right now* a real decision instead of something you flick between every second. The HUD shows the cooldown.
- **Controls:** **Tab** cycles to the next character, **1–4** jump straight to Marcus, Kristian, Christian or Jonas, and **LB / RB** cycle on a controller.
- **You can't swap to a downed character.** If the new character's body doesn't fit where you're standing, for example a wider character in a tight gap, the swap is refused with a "no room" sound. Being pushed to the nearest free spot is the alternative if refusing feels bad.
- **A short safety window:** the incoming character is invulnerable for about 0.3 s, so swapping into a crowd of dogs isn't an instant hit.
- **Every character keeps their own state** while off stage: health, ability cooldowns and anything they carry. **Ability cooldowns keep recharging off stage**, so swapping to use someone whose ability is ready is part of the strategy.
- **Puzzles and fights can need specific characters**, like "only Jonas fits through", "only Kristian can push this", "Christian's ability is best against bulldogs". That's the payoff of each character having abilities from your real-life skills.

### Going down

- When the character you're playing drops to 0 HP, they're **downed** and you're **forced to swap** to the next character who isn't downed. This forced swap **ignores the cooldown** and starts it again.
- A downed character **stays out until the next checkpoint** (or a revive pickup, if we add one), when they come back with some health.
- If **all four** are down, restart from the last checkpoint.

All numbers here (cooldown length, safety window, revive health) are starting values for the tuning panel.

### Online later

Online, each friend controls one character, so all four are on the map at once and swapping isn't used. The code is built so any number of characters can be on the map, each with its own controller. Singleplayer just spawns one at a time. A downed character online could be revived by teammates standing next to them, which can be decided then.

### Alternatives considered

| Option | Why not |
|---|---|
| AI teammates follow you while you control one | Good companion AI is hard to build, and you chose one character at a time |
| Choose one character per level, no swapping | You'd lose the squad feeling and puzzles that need several of you |
| Instant swapping with no cooldown | Swapping becomes button-mashing, and characters' strengths matter less |

---

## 3. Online-ready architecture

The industry lesson is consistent: **multiplayer added at the end usually means rewriting the core**, unless input is separated from the simulation from day one. Age of Empires added networking without rewriting its engine because everything already happened through commands. We do the cheap part of that now and nothing more.

### The flow

```
 Keyboard ─┐
 Gamepad  ─┼─► Controller ─► Intent ─► Character (movement, abilities, physics)
 AI       ─┤    (one per character)
 Network ─ ┘   (later)
```

- **`Intent`** (`src/input/intent.ts`) is a small plain object, made fresh every simulation step:
  ```ts
  type Intent = {
    move: { x: number; y: number };   // length 0..1 (analog sticks can be less than 1)
    aim?: { x: number; y: number };   // optional, for twin-stick or mouse aiming
    pressed: Set<Action>;             // went down this step (buffered, section 4)
    held: Set<Action>;                // currently down
  };
  ```
- **A controller** is anything with `getIntent(character, world): Intent`. There are four kinds now and one later:

  | Controller | Drives |
  |---|---|
  | `LocalController` | The character you control, from keyboard and gamepad |
  | `DogAI` (one per breed) | Dogs. They use the same intent interface, so dogs and players share all movement and ability code. |
  | `RemoteController` (later) | A friend's character online, fed by network messages |

- **`Party`** (`src/party/party.ts`) owns all four characters and their state, decides which one is on the map and which controller drives it, and runs the swap cooldown. A swap removes the current character from the map, puts the next one at the same spot, and gives it `LocalController`.

### Rules that keep online possible (do these now)

| Rule | Why it matters later |
|---|---|
| Characters and abilities only read `Intent` | A remote friend becomes just another controller |
| Every entity has a stable numeric **id** (the Tiled object id for placed things, a counter for spawned ones) | The network refers to things by id |
| Gameplay talks through **events with ids** (`hit`, `downed`, `pickup`) | Events can be sent to other players |
| Gameplay randomness goes through **one seeded random module** (`src/sim/random.ts`). Never `Math.random()` in gameplay code. | The host and clients can agree, and bugs can be replayed |
| No wall-clock time (`Date.now()`) in gameplay. Use the simulation time. | Every computer agrees on timing |
| Gameplay runs in **fixed steps** (Arcade's 60 steps per second). Our movement moves from the scene's `update` into the physics step. | Same behaviour on every computer and frame rate |
| The camera, HUD, sounds and particles **only read** gameplay state, never change it | They can run per computer |

Things we **don't** do now: write network code, make the simulation fully deterministic, or separate all state from Phaser objects. Those are big jobs that only pay off once online is actually built.

### The online path, for when it happens

The pragmatic model for a few friends playing in the browser is **host-authoritative**:
- **One player's browser is the host** and runs the real game, exactly the singleplayer code.
- **Others connect** over WebRTC (peer-to-peer, for example via PeerJS) or through a small relay or server such as Colyseus. They send their **intents** about 60 times a second.
- **The host sends back snapshots** of entity states about 20 times a second. Clients draw other players and dogs about 100 ms in the past, smoothly **interpolated** between snapshots.
- **Your own character is predicted** locally with the same `movement.ts`, and gently corrected when the host's snapshot disagrees. The correction is blended in, not snapped.
- Each client's camera follows its own character, which already works because of `localPlayer.character`.

What it adds then: a network module, `RemoteController`, a snapshot encoder and decoder for components, and an interpolation layer for drawing. Gameplay code stays as it is. Cheating isn't a concern among four friends, which is why host-authoritative is enough.

---

## 4. Input

### Actions

`src/input/actions.ts` lists every action:

`move` (vector), `aim` (vector, optional), `attack`, `ability1`, `ability2`, `interact`, `swapNext`, `swapPrev`, `swapTo1`–`swapTo4`, `pause`.

### Default bindings

Bindings are data in `src/input/bindings.ts`. They could be made rebindable later and saved in the browser.

| Action | Keyboard | Gamepad |
|---|---|---|
| move | WASD / arrow keys | Left stick / d-pad |
| aim | Facing direction (or mouse, later) | Right stick |
| attack | J or Space | A / Cross |
| ability1 | K | X / Square |
| ability2 | L | Y / Triangle |
| interact | E | B / Circle |
| swapNext / swapPrev | Tab / Shift+Tab | RB / LB |
| swapTo1–4 | 1, 2, 3, 4 | (none) |
| pause | Esc / P | Start |
| tuning panel (dev) | T | (none) |
| debug boxes (dev) | B | (none) |

Keyboard bindings use the **physical key position** (`KeyboardEvent.code`, such as `KeyW`), not the printed letter. That keeps WASD in the same place on Nordic, German and French keyboards, and it's why the tuning panel already uses `code`.

### Keyboard and gamepad together

- Both feed the same `LocalController`, so you can switch device at any time. The **last device used** decides which button prompts the HUD shows ("Press E" or "Press B").
- **Analog movement:** stick input becomes a `move` vector shorter than 1 for a gentle push. A **radial deadzone** of 0.2 ignores stick drift. `stepVelocity` currently scales every input up to full length, so it changes to only *cap* the length at 1. Then keyboard diagonals still aren't faster, and a half-pushed stick walks at half speed.
- Phaser's gamepad support is turned on with `input: { gamepad: true }`, with pads available as `pad1`–`pad4`. Browsers only report a gamepad **after its first button press**, so the game says "press any button" when it hears about one.

### Buffering

Presses of `attack`, `ability1`, `ability2` and `interact` are **buffered for about 120 ms**. A press slightly before the action is possible, like at the tail end of a cooldown or the last frame of an attack, still happens. Each press is used at most once.

Presses are recorded the moment they happen (keydown events) and handed to the **next** simulation step as `pressed`. So a quick tap between two physics steps is never lost, a known pitfall when reading "just pressed" inside a fixed-step loop.

### Browser specifics

- **Capture** arrows, Space and Tab so they don't scroll the page or move focus (`keyboard.addCapture`).
- **Release all keys when the window loses focus** (`blur` and `visibilitychange`). Otherwise a key held while you alt-tab stays "stuck" when you come back.
- **Pause automatically** when the tab is hidden.

---

## 5. Camera

One camera follows `localPlayer.character`. Using the "Scroll Back" camera vocabulary:

| Technique | Setting | Why |
|---|---|---|
| **Smoothing (lerp)** | `cameraLerp` ≈ 0.15, already in the tuning panel | Soft follow without lag you can feel |
| **Small deadzone** | about 16×12 px, Phaser `setDeadzone` | Tiny movements don't wobble the screen |
| **Lookahead** | Up to about 24 px toward where you're moving, smoothed (Phaser `setFollowOffset`, updated each step) | You see more of what's ahead, like the dogs you're running toward |
| **Bounds** | The map edges, or a `CameraBounds` zone for rooms and arenas | Never shows outside the map |
| **Screen shake** | A "trauma" value that big events add to and that decays. Shake grows with trauma², with a settings option to reduce it. | Strong hits feel strong, and small ones don't spam shake |
| **Pans for story moments** | `cam.pan` / `cam.zoomTo` in cutscenes, like showing the cat or a door that opened | |

Pixel-art rules, learned from the stutter fix:
- **Fixed zoom of 1** at 320×240, scaled up to the window. No smooth zooming in gameplay, because in-between zoom levels make pixels uneven.
- `roundPixels` on, so the camera and textured objects land on whole pixels.

---

## 6. HUD (minimal)

- Four **portraits** in a corner (Marcus, Kristian, Christian, Jonas) with health bars. The active one is highlighted, downed ones are greyed out, and the number key (1–4) is shown next to each.
- The **swap cooldown** as a ring or bar over the portraits, so you can see when you can swap again.
- **Ability cooldowns** for the active character, plus a small "ready" mark on off-stage portraits whose ability has recharged.
- The HUD reads state and never changes it. It uses fixed camera positions (`setScrollFactor(0)`) and the `ui` depth band.

---

## 7. Code layout

```
src/
  input/
    actions.ts        list of actions
    bindings.ts       keyboard + gamepad bindings (data)
    intent.ts         Intent type + empty intent
    localController.ts  keyboard + gamepad → Intent, buffering, blur handling (tested)
  party/
    party.ts          the four characters, who's on the map, swapping + cooldown, downed (tested)
  camera/
    cameraRig.ts      follow, deadzone, lookahead, shake
  sim/
    random.ts         seeded random numbers for gameplay
  net/                (empty until online is built)
```

---

## 8. Build order

1. **Next (with world build step 2, the four characters):** `Intent`, actions and bindings, `LocalController` for the keyboard (including blur handling and capture), `Party` with four placeholder characters, swapping in place with the cooldown (in the tuning panel), movement moved into the physics step with analog-ready capping, and `cameraRig` with lookahead.
2. **Soon after:** gamepad support, the HUD portraits, the seeded random module.
3. **With combat:** buffered actions, downed characters and forced swaps, the swap safety window, screen shake.
4. **Later, if wanted:** rebinding in a settings menu, mouse aiming, and online play following section 3.

---

## Sources

- [Scroll Back: The Theory and Practice of Cameras in Side-Scrollers (Itay Keren)](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers) ([alternate copy](https://icewyrmgames.github.io/research/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers)): camera window and deadzone, lerp smoothing, forward focus, edge snapping
- [How to implement a good camera in a 2D game (bugnet)](https://bugnet.io/blog/how-to-implement-a-good-camera-in-a-2d-game) and [Cinemachine follow tuning (uhiyama-lab)](https://uhiyama-lab.com/en/notes/unity/unity-cinemachine-camera-guide/): deadzone, damping and lookahead values
- Phaser 4.2.1 guides bundled at `node_modules/phaser/skills/cameras/SKILL.md` and `node_modules/phaser/skills/input-keyboard-mouse-touch/SKILL.md`: `setDeadzone`, `setFollowOffset`, `pan`, `shake`, `addCapture`, gamepads `pad1`–`pad4`
- [1500 Archers on a 28.8: Network Programming in Age of Empires and Beyond](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond), [Multiplayer I: Introduction (Dave Kilian)](https://davekilian.com/multiplayer-i.html) and [network input handling (gamedev.net)](https://gamedev.net/forums/topic/635009-network-input-handling/5006469/): commands separate from simulation, and why multiplayer is hard to add late
- [DISCBALL3D (three.js forum)](https://discourse.threejs.org/t/discball3d-multiplayer-soccer/95207), [Colyseus netcode docs](https://docs.colyseus.io/netcode) and [NetplayJS](https://awesome.ecosyste.ms/projects/github.com%2Frameshvarun%2Fnetplayjs): host-in-browser over WebRTC, prediction, interpolation, server option for Phaser
- [Input handling guide (claudeskills.info)](https://claudeskills.info/skills/thedivergentai/gd-agentic-skills/input-handling/), [managing key bindings (uhiyama-lab)](https://uhiyama-lab.com/en/notes/godot/input-map-key-binding-management/), [coyote time and input buffering explained (bugnet)](https://bugnet.io/blog/coyote-time-and-input-buffering-explained) and [input buffering, action canceling (Medium)](https://medium.com/@yosispring/input-buffering-action-canceling-and-also-forbidden-knowledge-47a3f8a95151): action maps, last-used device prompts, 100–150 ms buffers, catching presses for fixed-step logic
- [Building a better single-player and co-op experience (Cellar Door Games)](https://cellardoorgames.com/making-a-better-single-player-and-multiplayer-experience): character swapping in single-player with cooldowns recharging in the background
- [Wolfenstein: Youngblood companion AI (GoNintendo)](https://gonintendo.com/archives/312051-wolfenstein-youngblood-s-devs-say-creating-a-realiable-ai-companion-was-really): why reliable AI companions are hard to build, one reason we don't use them
