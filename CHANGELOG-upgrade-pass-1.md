# Upgrade Pass 1 — Changelog

Scope: the "fix what's actually broken first" section of the upgrade prompt. Everything
below is additive/surgical — no existing systems (shop, phases, particles, leaderboard
display) were rewritten, just extended.

## Mobile support (new)
- `src/mobile_controls.js` — a DOM-based virtual joystick (bottom-left) + DASH/KICK/SHOP
  buttons (bottom-right / top-right), shown only on touch-capable devices and only while
  a match is actually in progress.
- The joystick writes into `session.touchVec`; the main scene's movement update now reads
  keyboard **or** touch, whichever is active (`src/scenes/main.js`).
- Dash, bicycle-kick, and the shop toggle were each pulled out into a named function
  (`triggerDash`, `triggerBicycleKick`, `toggleShop`) so the exact same code runs whether
  triggered by a keypress or a touch button — there's only one implementation of each.

## Audio control (new)
- `src/audio_ui.js` — a persistent mute button (top-left, every scene) backed by
  `session.audioMuted` / `session.audioMasterVolume`.
- `src/main.js` now wraps Kaboom's global `play()` once at boot so **every** existing
  `play(...)` call in the game automatically respects mute/volume — no other file had to
  change its sound calls.

## Persistence (new)
- Manager name and chosen team are now saved to `localStorage` (`src/config.js`:
  `loadSavedProfile` / `savePlayerProfile`) and restored on your next visit — the name
  prompt now pre-fills, and team select opens on whichever team you used last.
- Audio mute/volume preference persists the same way.

## Leaderboard integrity
- `saveScoreToLeaderboard` now takes the match's elapsed time and rejects (locally, before
  it ever reaches Firestore) scores that are wildly implausible for how long the run
  lasted — see `isPlausibleScore` in `src/config.js`.
- **This is not a real security fix** — it only stops accidental/naive bad values, since
  it's still client-side code. The actual fix is `firestore.rules` (new file at the repo
  root): paste it into Firebase Console → Firestore Database → Rules and publish it. I
  can't do that step for you — I don't have access to your Firebase project.

## Small extras that came along for free
- Win/lose screens now show **time survived** (`formatMatchTime` in `src/helpers.js`).
- `firestore.rules` — ready-to-paste security rules, commented, with the reasoning inline.

## Files touched
`src/config.js`, `src/main.js`, `src/scenes/main.js`, `src/scenes/menu.js`,
`src/scenes/start.js`, `src/scenes/win.js`, `src/scenes/lose.js`, `src/scenes/instructions.js`,
`src/scenes/loading.js`, `src/scenes/interaction_gate.js`, `src/helpers.js`, `style.css`

## Files added
`src/mobile_controls.js`, `src/audio_ui.js`, `firestore.rules`, this file.

## Try it
Run any local static server from the project root (e.g. `npx serve .` or
`python3 -m http.server`) and open it — `file://` won't work because the game uses ES
modules. On a phone, use your machine's local network IP so the touch controls show up;
Chrome DevTools' device-toolbar touch emulation also works for a quick check on desktop.

## What's next
Pass 2 from the original upgrade prompt (game-feel: camera shake on hits, hit-stop,
damage vignette, dash trail, a combo/streak system) is the natural next step — happy to
do that pass too whenever you want it.
