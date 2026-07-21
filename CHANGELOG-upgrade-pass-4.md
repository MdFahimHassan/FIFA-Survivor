# Upgrade Pass 4 — Changelog (Visual Direction)

Scope: the last big item from section 3 of the original prompt — enemy silhouettes by
tier, a less-flat pitch, and a visual beat on phase transitions.

## Enemy tier silhouettes (`src/scenes/main.js`: `spawnEnemy`, `TIER_STYLE`)
Every enemy already used a rival country's own sprite, so the fix wasn't new art - it was
giving each tier a distinct halo/aura instead of every enemy sharing one plain red circle:
- `normal`: the original red halo, now correctly scaled to the enemy's actual size
  (previously fixed at one radius regardless of scale, so it looked oversized on wingers
  and undersized on bosses)
- `winger`: cyan, pulsing halo — reads as "fast/erratic" at a glance
- `defender`: a slow-rotating diamond "armor ring" in addition to its halo — reads as
  "reinforced" before you're even close enough to see its health bar
- `boss`: gold, fast-pulsing halo **and** a faster-spinning armor ring — unmistakably the
  biggest threat on screen from a distance, not just "the big one"

## Pitch atmosphere (`src/scenes/main.js`: pitch `onDraw`)
- Three soft, slowly-pulsing floodlight glows, fixed in screen space so they read as
  actual stadium lights rather than moving with the world
- A phase-driven color grade: the pitch itself gradually shifts from a cooler, calmer
  tone in the Group Stage toward a warmer, more saturated tone by the Final, so the late
  game visually feels higher-stakes independent of how hard it plays
- A permanent, subtle screen-edge vignette (`#screen-vignette` in `index.html`/`style.css`)
  across every scene, not just gameplay - cheap, and it's the single change that reads
  most as "someone art-directed this" for the least effort

## Phase-transition beat (`src/scenes/main.js`, in the golden-ball collision handler)
Advancing a phase now gets a golden screen flash + a small camera shake alongside the
existing "NEW STAGE" popup and phase-label punch, so crossing into Round of 16 / Quarter
Finals / etc. has an actual impact moment instead of just a text swap.

## Files touched
`src/scenes/main.js`, `style.css`, `index.html`

## Try it
Watch enemy variety from Phase 4 onward — wingers (cyan pulse) show up first, then
defenders (armor ring) around Phase 7, then bosses (gold, both effects) from Phase 10.
Collect enough golden balls to cross a phase boundary to see the transition beat. The
vignette and floodlights are visible immediately on any screen.

## What's next
That closes out every item from the original upgrade prompt's priority list (1 → 2 → 4 →
3). What's left from the original scope is lower-priority: dynamic music layering by
phase, and the code-quality cleanup (splitting `session`, pulling magic numbers into a
`balance.js`, removing the stray `code.txt`). Happy to do either whenever you want to keep
going — otherwise this is a good point to actually playtest what's here.
