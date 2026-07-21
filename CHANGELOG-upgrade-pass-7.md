# Upgrade Pass 7 — Changelog (Bug Fixes + Post-Match Flow)

## Bugs fixed

**1. Loading screen tip box** — was a fixed 640px box regardless of tip length, leaving a
lot of empty space around short tips. Now measures the actual text and sizes the box to
fit (`src/scenes/loading.js`).

**2. "Bosnia & Herzegovina" overflowing its grid cell** — long country names now
step down in font size automatically so they stay inside their cell
(`src/scenes/start.js`). Everything else keeps the original size.

**3. The three faint white circles on the pitch** — those were the floodlight glow
effects from an earlier pass. Removed entirely per your feedback (`src/scenes/main.js`).

**4. Settings content escaping its box** — the MUSIC/SFX rows were positioned using an
offset that put them above the panel's own top edge. Rewrote the layout so every row is
measured down from the panel's actual top edge instead of a disconnected reference point -
guaranteed to stay inside the box regardless of screen size now (`src/scenes/settings.js`).

**5. Menu button text popping in instead of fading with its box** — `KICK OFF`,
`SETTINGS`, `CREDITS` (and `START MATCH` on the team-select screen, `KICK OFF MATCH` on
instructions - same bug, same fix) were child text objects added without their own
opacity component, so they didn't inherit the parent button's fade-in and just appeared
instantly. Every affected button's label now fades in sync with its box.

## Removed

**Top-left mute button** — deleted `src/audio_ui.js` and its CSS entirely. Audio control
now lives only in Settings, as requested.

## New: post-match action buttons

Win/lose screens no longer end on a passive "press any key" prompt. Both now show four
real buttons:

- **TRY AGAIN** — jumps straight back into a fresh match with the same name/tag/team, no
  re-entering anything.
- **MAIN MENU** — normal flow, name prompt on next Kick Off like always.
- **SETTINGS** — opens Settings; its Back button now returns to wherever it was opened
  from (main menu, or back to this exact win/lose screen) instead of always going to the
  main menu.
- **HELP** — opens the rules screen in a read-only "quick refresher" mode (no Kick Off
  Match button, since you don't want Help to accidentally start a new match) with its own
  Back button, using the same return-to-previous mechanism as Settings.

This return-to-previous behavior is a small shared system (`goWithReturn` /
`consumeReturnContext` / `returnToPrevious` in `src/helpers.js`) rather than something
duplicated per screen, so Settings and Help both get it for free and any future screen can
reuse it.

One honest caveat: "back" works by re-entering the win/lose scene with the same score/time
it had before, which means the crowd-cheer sound and leaderboard fetch run again. Nothing
breaks, but the sound will replay and the leaderboard list will very briefly re-fade-in.
A fully seamless version would mean splitting win/lose into separate "compute" and
"render" steps, which is a bigger restructure than this fix called for.

## Backend change: one leaderboard entry per player, not one per match

This is what makes "Try Again" safe to mash without flooding the leaderboard. Previously
every match created a brand new document (`scoresCollection.add(...)`). Now each player
identity (name + their assigned tag, e.g. "Kylian #34") maps to exactly **one** document,
and it only gets overwritten when a new score actually beats the old one
(`src/config.js`: `saveScoreToLeaderboard`, `buildPlayerDocId`).

`firestore.rules` was updated to match: `create` for a player's first-ever score,
`update` allowed **only if** the new score is strictly higher than what's stored and the
name/tag aren't being changed. You'll need to re-paste the updated rules into the Firebase
console the same way as before - this file was already something you had to apply
manually, so this is just a newer version of that same step.

## Shop visibility

Two changes, aimed at "people are focused on the center and miss the shop hint entirely":

- The `[E] STRATEGY SHOP` corner hint now has a pulsing glowing pill behind it instead of
  being bare small text - reads as an actual interactive button now, and the pulse catches
  the eye in peripheral vision even when you're not looking at it directly.
- A one-time contextual toast appears center-screen ("TIP: PRESS [E] TO OPEN THE STRATEGY
  SHOP") the first time a player has enough coins to afford anything but hasn't opened the
  shop yet. It only fires once per match and never again once they've opened it, so it
  won't nag someone who already knows.

## Deploy prep (from earlier, unchanged)
Favicon + Open Graph meta tags are already in `index.html`. Remember to swap the `og:image`
to an absolute URL once you have your Vercel domain - see the earlier note.

## Files touched
`src/scenes/loading.js`, `src/scenes/start.js`, `src/scenes/main.js`,
`src/scenes/settings.js`, `src/scenes/menu.js`, `src/scenes/instructions.js`,
`src/scenes/win.js`, `src/scenes/lose.js`, `src/helpers.js`, `src/config.js`,
`src/main.js`, `style.css`, `firestore.rules`

## Files removed
`src/audio_ui.js`

## Try it
Play a full match to Try Again from the lose/win screen and confirm your name/team carry
over with no re-entry. Open Settings from both the main menu and from a lose screen and
check Back goes to the right place each time. Check the shop hint pill pulses, and that
the center-screen tip appears once you've picked up 10 coins without opening the shop.
