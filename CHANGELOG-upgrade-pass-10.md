# Upgrade Pass 10 — Changelog (Pitch Visual Upgrade)

Scope: one focused visual upgrade — the in-game football pitch, which was the weakest
visual element in the game compared to the polished menu/loading backgrounds.

## Why the pitch specifically

Checked both: the menu (`players.jpg`) and loading screen (`stadium.jpg`) backgrounds
were already in good shape — cover-scaled to any aspect ratio, a subtle breathing zoom
animation, outlined/shadowed title text, and a global radial vignette (`#screen-vignette`
in `style.css`) applied on every screen. No changes made there.

The actual gameplay pitch (`src/scenes/main.js`) was the real gap: two flat solid-color
stripes tiled infinitely, with markings (halfway line + center circle) drawn exactly once,
anchored at the world's origin. Since this is a boundary-less endless survival arena, a
run drifts away from that origin almost immediately — so for the large majority of actual
playtime, the pitch was just blank alternating green rectangles.

## What changed (`src/scenes/main.js`, `src/assets.js`, new `sprites/grass_grain.png`)

**1. Mowed-grass sheen.** Each stripe now gets a faint brighter/darker streak through its
center (alternating direction stripe to stripe), the same trick real broadcast pitch
graphics use to fake light bouncing off freshly cut grass. Cheap — one extra rect draw per
visible stripe — and removes the "flat vector fill" look without needing true gradients
(which Kaboom's `drawRect` doesn't support natively).

**2. Tiled grain texture.** New `sprites/grass_grain.png` — a 160×160 seamless noise swatch,
built from summed integer-frequency sine/cosine waves (not raw noise) so it's *exactly*
periodic and tiles with zero visible seam at any repeat count, guaranteed by construction
rather than eyeballed. Drawn at low opacity across the visible viewport, this breaks up the
flat color fill with actual grass-like mottling. Small file (12KB), so it doesn't undo the
asset-size work from the last pass.

**3. Recurring marker grid — the actual fix for "the pitch feels empty."** Added a faint,
small ring-marker grid repeating every 700 world units in both axes (deliberately fainter
and smaller than the real kickoff circle at the origin, so the two are never confused).
Since a run spends the overwhelming majority of its time far from spawn, this is what
actually gives the far reaches of the arena visual rhythm — before this, that space was
100% blank.

All three layer on top of the existing stripe/color-grade system rather than replacing it,
so difficulty-phase tinting and everything else downstream is untouched.

## Files touched
`src/scenes/main.js`, `src/assets.js`, `sprites/grass_grain.png` (new, 12KB)

## Try it
Start a match and move far from the spawn point in any direction (the arena has no
boundaries) — you should see the faint recurring ring markers and grass texture/sheen
continue indefinitely, instead of empty flat stripes once you're away from the center circle.
