# Combat blueprint

How fighting works in The Crazy Squad: what each friend does in a fight, how dodging and swapping fit in, how hits feel, and what happens to a beaten dog. It builds on:
- the [characters and abilities blueprint](characters-abilities-blueprint.md): every attack, the dodge included, is an ability run by the shared ability runner (windup → active → recovery → cooldown)
- the [dog AI blueprint](dog-ai-blueprint.md): telegraphs, attack tokens, stagger, breeds
- the [players, input and camera blueprint](players-input-camera-blueprint.md): intents, buffered presses, swapping, downed members
- the collision blueprint: hitboxes, hurtboxes and the damage pipeline

Every number here is a **starting value for the tuning panel**, not a final one. The mechanics themselves are provisional too: they get tested in play and may change.

---

## 1. Decisions

Agreed on 2026-11-18:

| Question | Decision |
|---|---|
| Overall style | **Mixed by character.** Each friend fights differently (melee, ranged, control), so the situation decides who you want on the field. |
| Aiming | **Facing direction.** Attacks go where you're facing, snapped to 8 directions. Keyboard only, identical on a controller, simple to send online later. **Provisional:** to be tested in play before it is final; mouse / right-stick aim is the alternative. |
| Beaten dogs | **Knocked out, cartoony.** Yelp, stars over the head, then they run off or poof away. No blood, no bodies. |
| Fight size | **Small, tactical groups.** 2–5 dogs at a time, each breed with its own trick. You swap to counter them. |
| Roles | Kristian bruiser, Jonas ranged, Christian fast fighter, Marcus control (section 3). |
| Dodge | **A shared dodge** for all four, with a short cooldown. |
| Dog toughness | A normal dog takes **3–4 basic hits**. Tank dogs like the Bruiser take about 8. |

---

## 2. Principles

1. **The loop is: read, avoid, punish.** A dog telegraphs, you dodge or swap, then you hit it during its recovery. Everything below serves this loop.
2. **Swapping is the main tactic.** No one is best at everything. The right friend for a shield dog isn't the right one for a sniper.
3. **Every hit is felt.** Each landed hit has a flash, a short freeze, knockback and a sound, on both sides.
4. **Fair both ways.** Dogs follow the dog AI blueprint's fairness rules (telegraphs, attack tokens, nothing from off screen). The squad gets the dodge, buffered inputs and the swap safety window.

---

## 3. The squad

| | Kristian | Jonas | Christian | Marcus |
|---|---|---|---|---|
| **Role** | Bruiser | Ranged | Fast fighter | Control |
| **Basic attack** | **Wrench swing**: a wide arc in front, slow, heavy knockback | **Bandy shot**: hits the white ball in the facing direction | **Punch / punch / kick**: a fast 3-hit combo, the kick knocks back | **Phone zap**: a short-range beam that stuns a dog for a moment |
| **Ability 1** | Mechanic (to design) | Bandy (to design, e.g. a hard slapshot that pierces) | **Time-slow**: slows enemies, projectiles and hazards, never teammates; about 3–4 s, cooldown about 12–15 s, ends on swap | **Hack** (to design, e.g. take over a turret, open electronic doors) |
| **Good against** | Tanks, shields (knockback breaks guard) | Snipers and bombers you can't reach | Groups, fast dogs, finishing off | Dangerous single dogs: stun them before their attack lands |
| **Weak at** | Fast dogs, anything at range | Dogs right on top of him | Tanks (low damage per hit) | Raw damage |

### Basic attack numbers

The reference is **one basic hit ≈ 20 damage** against a normal dog with **70 HP** (3–4 hits).

| Attack | Damage | Windup | Active | Recovery | Range / shape | Knockback | Extra |
|---|---|---|---|---|---|---|---|
| Wrench swing | 30 | 0.15 s | 0.10 s | 0.35 s | Arc of 120°, 20 px | Heavy (staggers tanks) | Hits every dog in the arc |
| Bandy shot | 15 | 0.10 s | — | 0.30 s | Ball, 220 px/s, about 160 px reach | Light | One ball out at a time to start; stops at walls |
| Punch, punch, kick | 10 / 10 / 18 | 0.05 s | 0.06 s | 0.12 s (0.3 s after the kick) | Small box, 14 px | None / none / medium | Press again within 0.3 s to continue the combo |
| Phone zap | 8 | 0.10 s | 0.12 s | 0.40 s | Line, 48 px | None | `stunned` for 0.6 s; the same dog can't be stunned again for 2 s |

Basic attacks have **no cooldown beyond their recovery**: you can always attack. Abilities have real cooldowns, and those keep recharging while a character is off stage.

**Moving while attacking:** melee attacks are `slowed` (you can creep forward). The bandy shot and the zap are `slowed` during their windup and `free` after. Facing is locked from the windup until the recovery ends, so a swing can't be turned mid-arc.

### Aim help

Since aim is the facing direction in 8 steps, a dog standing at an odd angle can be awkward to hit. Three things help (`src/combat/aim.ts`):

1. **Hits count to the dog's body**, not its middle: reach and arc are measured to the edge of its 12 px feet box (`BODY_PAD`, 6 px).
2. **Aim help:** when a swing starts, the best dog within `aimCone`° (35) of facing and up to `aimRange` px (10) past reach gets the attack pointed straight at it. Dogs straight ahead win over slightly closer ones off to the side. The rest of a combo stays on the same dog.
3. **Step in:** if that dog is just out of reach, you step towards it during the windup, up to `aimPull` px (10), so you're in reach when the arc opens.

All four are in the tuning panel (`aimHelp` 0 turns it off). Not done yet: a marker on the targeted dog, and turning the sprite to face it.

---

## 4. The dodge

Shared by all four, an ability like any other (`dodge`, `movement: 'locked'`).

| | |
|---|---|
| Distance | 40 px over 0.18 s, in the movement direction (or facing when standing still) |
| Invulnerable | The first 0.15 s |
| Cooldown | 0.7 s |
| Cancels | The **recovery** of a basic attack, never its windup or active part. Attack, then dodge out, is the core move. |
| Walls | The dodge moves the body through physics, so walls still stop it. |

**Keys:** `dodge` becomes a new action. **Space** moves from attack to dodge (Space is the usual dodge key), attack stays on **J**. On a controller: dodge on B / Circle.

Dodging doesn't cost stamina, so sprinting and dodging don't compete. That can change if dodging gets spammy.

---

## 5. How hits feel

When a hit lands, on the squad or on a dog:

| Feedback | Value |
|---|---|
| **Hit freeze** (hitstop) | The attacker and target freeze for 50 ms (80 ms for heavy hits). The rest of the world keeps going. |
| **Flash** | The target turns white for 1 frame, then blinks during its invulnerability (the squad's flicker already exists) |
| **Knockback** | Pushed away from the attacker. Light 60 px/s, medium 120, heavy 200, reduced by the target's weight. |
| **Screen shake** | Only for heavy hits and for hits on the squad. Small, with an option to turn it off. |
| **Sound** | One per attack type, plus a yelp for dogs. |

No floating damage numbers. The health bars and the hit feel are enough at this size.

---

## 6. Dogs in a fight

- **HP:** normal dogs 70, tanks (Bruiser) 160. Each breed sets its own in its definition.
- **Being hit:** a dog's own invulnerability after a hit is short (0.1 s), so Christian's combo connects. A dog **staggers** (its windup is cancelled) when a hit's knockback is stronger than its **poise**: light dogs stagger from anything, the Bruiser only from heavy hits. Marcus's stun always works.
- **Knocked out at 0 HP:** a yelp, a spin with stars over its head for 0.6 s, then it runs off screen (or poofs if it's stuck). It stops counting as an enemy immediately: no hitbox, no token. *shortcut: until the KO animation exists, a code poof is fine.*
- **Ranged dogs** (Heavy Gunner, Long Shot, Mad Bomber): their bullets and bombs are dodged with the dodge, blocked by walls and some props, and slowed by Christian's time-slow. The Long Shot's red laser is the telegraph.
- **Shield dog** (K-9 Cop): blocks hits from the front. Get round him, knock him back with Kristian, or stun him with Marcus.

### What each breed teaches

| Breed | Trick | Best answer |
|---|---|---|
| Bruiser | Head-first charge, tanky | Dodge sideways, then Kristian into its recovery |
| K-9 Cop | Shield in front | Flank, Kristian's knockback, Marcus's stun |
| Long Shot | Sniper with a laser warning | Jonas from range, or close the gap with dodges |
| Heavy Gunner | Shotgun spread up close | Keep distance: Jonas |
| Mad Bomber | Lobs bombs over cover | Move off the marker, Christian runs him down |

---

## 7. Health, downing and healing

These already exist or follow the players blueprint:
- Each friend has 100 HP and short invulnerability after a hit. At 0 HP they're downed, and you're forced to swap.
- All four down: the level restarts. *Later: restart at the last checkpoint.*
- Downed friends come back at the next checkpoint with some health.

**Healing (open, section 10):** the simplest idea that fits the tone: a knocked-out dog sometimes drops a **dog treat**, which heals the active friend by 20 when picked up.

---

## 8. Swapping in a fight

- Swapping **cancels** whatever the current character was doing. The new one comes in with the 0.3 s safety window (already built).
- Basic attacks are always ready. Ability cooldowns keep recharging off stage, so swapping to whoever has their ability ready is the strategy.
- **Later:** tag-in moves, where each friend does a small effect when swapped in (characters blueprint §5).

---

## 9. Build order

Each step is playable on its own and tested against the Bruiser:

1. **Dogs can be hit.** Dog HP, the `hitbox` effect, Kristian's wrench swing, hit freeze, flash, knockback, stagger and the KO (code poof). Debug: the dog's HP over its head.
2. **Dodge.** The `dodge` action and key change, invulnerability, recovery cancel.
3. **Jonas's bandy shot.** The first projectile and projectile pool.
4. **Christian's combo.** Combo chaining.
5. **Marcus's zap.** The `stunned` status and stun immunity.
6. **Aim help**, sounds, screen shake, dog treats.
7. **Signature abilities**, one friend at a time, starting with Christian's time-slow (already designed).
8. **Then the dog side:** attack tokens, the other breeds' attacks (guns, shield, bombs) and attack animations (PixelLab, with approval).

---

## 10. Open questions

- **Kristian's, Jonas's and Marcus's signature abilities**: still to design, in the characters blueprint's table.
- **Healing:** dog treats (section 7), heal stations at checkpoints, or no healing between checkpoints?
- **Ability 2** for everyone: needed at all, or is one ability plus the dodge enough? Leaving it out keeps the controls small.
- **Attack animations:** code effects (a swing arc, a ball, a zap line) on the existing walk sprites first, PixelLab attack animations later.
- **Personal traits** (sprint speed and so on) may change these numbers a little.

---

## Sources

- [Enemy attacks and telegraphing (Game Developer)](https://gamedeveloper.com/design/enemy-attacks-and-telegraphing): telegraph, windup and punish windows
- [Attack token system: group combat that feels fair (StraySpark)](https://www.strayspark.studio/blog/attack-token-system-ue5-group-combat-that-feels-fair): pacing hits from groups
- Hitstop, knockback and screen shake as the core of "game feel": the widely cited talk *The Art of Screenshake* (Jan Willem Nijman, Vlambeer)
