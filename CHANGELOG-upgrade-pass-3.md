# Upgrade Pass 3 — Changelog (UI/UX Polish)

Scope: section 4 of the original upgrade prompt — pause menu, redesigned shop, flag icons
on the team grid.

## Pause menu (new: `src/pause_menu.js`)
- **ESC** pauses/resumes during a match; on touch devices there's also a small "II"
  button next to SHOP.
- Pausing uses Kaboom's own `debug.paused` switch, which freezes every game object's
  update loop (enemies, bullets, spawn timers, cooldowns) with no extra bookkeeping.
- The Resume/Quit-to-Menu buttons are a DOM overlay, not Kaboom objects. That's
  deliberate: a Kaboom button's click detection runs through the same per-frame update
  loop that `debug.paused` freezes, so a Kaboom-object pause menu would freeze itself
  along with the game and become unclickable. A DOM button has no such dependency.
- Dash/kick/shop are all guarded so they can't fire while paused, and the shop can't be
  opened while paused (close the shop before pausing, or vice versa — one overlay at a
  time). `debug.paused` is also defensively reset to `false` at the top of every scene, in
  case something transitions away mid-pause.

## Strategy shop redesign (`src/scenes/main.js`)
Replaced the plain text-row + colored-rectangle layout with card-based rows:
- Each upgrade now has an icon (⚡ striking speed, 👟 running speed, 🧲 magnet, 🔫
  shotgun, 🛡️ shield, 🎯 piercing) instead of being identical gray text.
- The three stackable upgrades (speed/fire-rate/magnet) show their level as filled pips
  rather than a bare "Lv 3" string, so progress is readable at a glance.
- One-time tactics get a gold "★ OWNED" badge instead of a flat gray "OWNED" label once
  bought.
- Same underlying economy and costs — this is a visual pass only, nothing about what
  things cost or how upgrades work changed.

## Team-select flag icons (`src/scenes/start.js`)
Every cell in the 47-country grid now shows the actual flag sprite next to the country
name instead of text alone (reusing the flag art that was already being loaded for the
big preview panel — no new assets needed).

## Files touched
`src/scenes/main.js`, `src/scenes/start.js`, `src/main.js`, `style.css`, plus the
defensive `debug.paused = false` reset added to `src/scenes/menu.js`, `instructions.js`,
`win.js`, `lose.js`, `loading.js`, `interaction_gate.js`.

## Files added
`src/pause_menu.js`, this file.

## Try it
Pause mid-match with ESC (or the mobile "II" button) — try opening the shop, closing it,
then pausing, to see the guard rails. Open the shop with **E** to see the new card layout.
Team select now shows a flag on every cell.

## What's next
From the original prompt: visual direction is the one big remaining item — distinct
enemy silhouettes per tier (right now they only differ by size), a layered/parallax pitch
background instead of the flat striped draw, and a visual beat on each phase transition as
the match escalates toward the Final. That's naturally the next pass whenever you want it.
