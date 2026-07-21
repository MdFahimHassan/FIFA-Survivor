# Upgrade Pass 2 — Changelog (Game Feel)

Scope: section 2 of the original upgrade prompt — camera shake, hit-stop, damage vignette,
dash trail/squash, tiered kill impact, and a combo/streak readout. Everything builds on
the particle/ring/punch system that was already there; nothing was replaced.

## Tiered kill impact (`src/helpers.js`: `spawnTieredKillImpact`, `TIER_IMPACT`)
Every kill (bullet, dash, bicycle-kick) now scales its particles/ring size/camera shake by
enemy tier instead of using one fixed size for everything:
- `normal` / `winger`: light impact, no shake worth mentioning
- `defender`: bigger ring, small shake
- `boss`: big ring, real shake, **and** a 90ms hit-stop — killing a boss now has a
  noticeably different, heavier feel than a normal kill

## Hit-stop (`src/helpers.js`: `hitStop`)
A brief dip in `debug.timeScale` (Kaboom's real, documented slow-motion hook) for a frame
of weight on boss kills and on taking a lethal hit. Restored via a plain `setTimeout`
(wall-clock time), not Kaboom's own `wait()` — using `wait()` here would have been a bug,
since a near-zero timeScale would make `wait()` itself crawl and the dip would never end.

## Screen flash (`src/helpers.js`: `screenFlash`)
A full-screen color veil that fades out, used for:
- taking a hit while shielded (cyan, brief)
- the killing blow (red, punchier — followed by hit-stop + a bigger shake, then a short
  delay before cutting to the lose screen so the impact actually reads before the scene
  changes)

## Dash trail + squash-and-stretch (`src/scenes/main.js`)
- Dashing now leaves six fast-fading cyan ghost copies of the player sprite along the
  path, plus a small camera shake.
- Added a `squash()` helper that briefly overrides the player's idle-breathing scale
  animation so a dash reads as a quick stretch-and-snap-back rather than just a speed
  change. (Deliberately scoped to dash only for this pass — wiring squash into every
  action risked fighting the existing per-frame breathing update; happy to extend it to
  hits/kicks in a follow-up if you like the effect.)

## Kill-streak readout (`src/scenes/main.js`)
Chaining kills within 1.6 seconds now shows a punchy "STREAK x3" label. **This is cosmetic
only** — it does not add bonus score or touch your existing shop-cost balance. I kept it
that way deliberately so this pass doesn't quietly change how fast players can afford
upgrades; if you want streaks to actually award bonus points, that's a quick follow-up but
it's a balance decision I didn't want to make for you.

## Files touched
`src/helpers.js`, `src/scenes/main.js`

## Try it
Same as pass 1 — serve the folder locally (`npx serve .` or `python3 -m http.server`) and
play a match. Easiest things to notice: dash (Shift) for the trail/squash, killing several
rivals quickly for the streak counter, and reaching Phase 10 to fight a boss for the
hit-stop + big shake.

## What's next
From the original prompt: visual direction (distinct enemy silhouettes per tier, pitch
parallax/crowd background, phase-transition color grading) and UI/UX polish (pause menu,
redesigned shop cards, flag-icon team grid) are next in line whenever you want to keep
going.
