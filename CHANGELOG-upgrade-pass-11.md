# Upgrade Pass 11 — Changelog (Menu Easter Egg: Click a Player's Face)

## Post-release fix
The initial version threw `Bad value for lerp(): undefined, vec2(1.18, 1.18)` on click.
Cause: the `face` text object was missing a `scale()` component, so when `punch()` tried
to tween it from `obj.scale` (undefined) up to `vec2(1.18)`, Kaboom's `lerp()` had nothing
valid to start from. Every other working `punch()` target in the codebase (e.g. `main.js`'s
`goldenIcon`) already carries an explicit `scale(...)`, confirming this was the only one
missing it. Fixed by adding `scale(1)` to `face`'s component list.

## Follow-up: positioning + transition feel
Two requested changes to the callout, both in `triggerEgg()`:
- **Position follows the clicked player** instead of always sitting dead-center. The X
  position is now computed from that player's hitbox (via `imageFractionToScreen`),
  clamped so the text block never runs off either screen edge for the players near the
  ends (Haaland, Salah). Y stays in the same safe low band every time - their hitboxes
  already run close to the bottom of the frame, so there's rarely real room to actually
  place text below their feet on screen.
- **Fade+rise swapped for a "pop"** - text now snaps in from 30% scale past full size
  (122% for the name, 108% for the quote) before settling to 100%, instead of gently
  fading and drifting upward. Uses the same two-step `tween` → `wait` → `tween` pattern
  `punch()` already uses (confirmed working in this Kaboom version) rather than chaining
  `.onEnd()` off the tween call, which isn't used anywhere else in this codebase and
  wasn't worth gambling on for something already recovering from one silent-API mismatch.

## What it does
On the main menu, clicking one of the 7 celebrating players in the background
(Haaland, Mbappé, Neymar, Ronaldo, Messi, Bellingham, Salah) now:
1. Ducks the menu music down (doesn't mute it, just steps back).
2. Plays that player's hype clip.
3. Pops up a bold text callout with their name + catchphrase, synced to the audio.
4. Fades the music back up once the clip ends.

Clicking a different player mid-celebration interrupts the first one cleanly (stops its
audio, clears its text, ducks fresh) rather than stacking sounds.

## New files
- **`src/player_eggs.js`** — the config for all 7 players (label, sound id, quote,
  duration) plus the geometry: `screenPointToImageFraction()` maps a screen click back
  to a fraction (0–1) of the original 1372×784 `players.jpg`, accounting for the
  background's "cover" scale-to-fill + the continuous breathing zoom menu.js already
  applies. Because hitboxes are stored as fractions of the source image rather than
  screen pixels, they stay correctly aligned at any window size or aspect ratio.

## Audio processing (`audios/*_hype.mp3`)
The 7 uploaded clips came in wildly inconsistent — loudness ranged from -35 LUFS
(Neymar, very quiet) to -15 LUFS (Salah, loud), which would've made some players feel
like an afterthought next to others. Each clip was:
1. Silence-trimmed front and back.
2. Peak-normalized to a consistent -1.5dBFS (this needed a redo mid-pass — an initial
   attempt using `loudnorm` misbehaved on these short, dynamic clips and an `afade`
   filter bug briefly silenced most of each clip; both were caught by re-measuring
   output volume before finalizing, not just trusting the filter graph).
3. Encoded to 128kbps mp3.

Result: all 7 clips now peak at essentially the same loudness, ranging 58KB–137KB each
(~750KB total for all 7 — negligible next to the compression work from the last pass).

## `src/scenes/menu.js` changes
- Click detection via a single `onMousePress("left", ...)` — deliberately *not* Kaboom's
  per-object `area()`/`onClick()`, so there's full control over priority: clicks inside
  any of the three menu buttons' zones (with a safety margin) are ignored by the egg
  system entirely, so a button sitting visually over a face can never double-fire both
  a scene change *and* a celebration.
- `bg.onUpdate()` gets a second hover-cursor pass (Kaboom supports multiple `.onUpdate()`
  subscriptions on one object) that shows a pointer cursor over a player's hitbox, gated
  by a shared `hoveringUIButton` flag so it never fights the buttons' own cursor handling.
- Bgm ducking targets are computed from the same formula `helpers.js`'s
  `applyAudioSettingsToLoops` already uses (`musicVolume * 0.35`), so ducking/restoring
  always lands on the correct "normal" volume even if the player adjusts the music
  slider mid-celebration, rather than hardcoding a value that could drift out of sync.
- `stopActiveEgg(true)` is called before every scene transition out of the menu (starting
  a match, opening Settings, opening Credits) so a celebration clip can never bleed into
  another screen — sound handles don't auto-stop on scene change in this codebase (same
  reason `pause_menu.js` explicitly stops `session.audio.gameAmbience`).
- Text callout reuses the existing `riseIn()` and `punch()` helpers from `helpers.js`
  instead of hand-rolling new animation curves, so it moves consistently with the rest
  of the game's UI.

## Debug calibration overlay (press **G** on the menu)
Toggles pink outlined boxes + labels drawn directly over the 7 hitbox regions, updated
live every frame against the background's current scale/position — including through
the breathing zoom — so misalignment is obvious at a glance. Since hitboxes were placed
as an evenly-spaced estimate rather than pixel-measured against the art (a rendering
issue on my end this session meant I couldn't re-verify exact face positions), **this is
the first thing worth checking** before considering the feature finished. To adjust: the
7 `box: { xFrac, yFrac, wFrac, hFrac }` entries are right at the top of
`src/player_eggs.js` with comments explaining what each number means — nudge, save,
refresh, press G again to check.

## Files touched
`src/player_eggs.js` (new), `src/assets.js`, `src/scenes/menu.js`, `audios/*_hype.mp3`
(new, 7 files).

## Still worth doing
1. **Calibrate the hitboxes** — press G on the menu and confirm all 7 boxes actually
   sit over the right faces; nudge `src/player_eggs.js` if not.
2. **Sanity-check the quotes on screen** — they're long for a couple of players
   (Messi, Haaland); worth a look at whether the wrapped text reads comfortably at the
   size/width used, or whether a couple should be trimmed.
3. Give each clip a listen at in-game volume alongside the menu music to confirm the
   duck level (22% of normal bgm volume while a clip plays) feels right — easy to tweak
   via the `duckedBgmTarget()` multiplier in `menu.js` if it's too subtle or too aggressive.
