# Upgrade Pass 9 — Changelog (Production-Readiness for Vercel Launch)

Scope: the "make it feel professional before deploying" pass. Five changes, in order of
how much they matter for launch day.

## 1. Asset compression (~10MB shaved off, no visible quality loss)

Three images accounted for 8MB of the game's 9MB sprite folder — `stadium.png` (3.1MB),
`players.png` (2.3MB), `field.png` (2.7MB, turned out to be an **unused/orphaned asset —
not referenced anywhere in code**, converted anyway in case it's wired up later) — plus
`SS.png`, the social-preview screenshot. All four are fully opaque (checked programmatically
— alpha channel is 255 everywhere, so no transparency was being used), which made them safe
to convert PNG → JPEG at quality 88 with no visible loss:

| File | Before | After |
|---|---|---|
| `stadium.png` → `.jpg` | 3.08 MB | 600 KB |
| `field.png` → `.jpg` (unused) | 2.69 MB | 328 KB |
| `players.png` → `.jpg` | 2.34 MB | 262 KB |
| `SS.png` → `.jpg` | 105 KB | 69 KB |

Every remaining PNG (the ones that actually need transparency — coin, trophy, flags, UI
icons, etc.) got a lossless recompression pass (stripped metadata, max deflate) for another
~180KB. `src/assets.js`, `README.md`, and `index.html` were updated to point at the new
`.jpg` filenames — nothing else changed, same sprite keys, same code calling them.

Audio got the same treatment: `menu_theme.mp3` (256kbps, ~3min) → 128kbps, `stadium_ambience.mp3`
(160kbps, ~2.3min ambient loop) → 96kbps, `crowd_cheer.mp3` → 128kbps. Short SFX (clicks,
kicks, chimes) were left untouched — they're already tiny and re-encoding short percussive
sounds risks audible artifacts for a few KB of savings that isn't worth it.

**Total: sprites 9.0MB → 2.2MB, audio 8.6MB → 4.8MB. Whole project ~18MB → ~8MB.**

## 2. Kaboom.js pinned to an exact version (`index.html`)

Was loading `https://unpkg.com/kaboom/dist/kaboom.js` — no version, so it silently tracks
whatever unpkg resolves as "latest." If a future Kaboom release ships a breaking API
change, the game breaks in production with zero code changes on your end and no warning.
Pinned to `kaboom@3000.1.17` (current latest as of this pass). Bump it deliberately later
if you want a newer version, after testing.

(Worth knowing, not acted on: Kaboom's own README says the library is no longer maintained
and points people at its successor, KAPLAY. Not migrating that now — it's a bigger, riskier
change than this pass — but worth being aware of if you keep building on this long-term.)

## 3. Favicons + PWA manifest (`index.html`, new `icons/`, `favicon.ico`, `manifest.json`)

The old setup reused a 31×31 `ball.png` for both the browser favicon and the Apple
touch icon — blurry when scaled up, and no other sizes existed. Generated a full set from
`sprites/club_logo.png` (300×300, transparent background, much better source):

- `favicon.ico` (16/32px), `icons/favicon-16x16.png`, `icons/favicon-32x32.png` — browser tab icon.
- `icons/apple-touch-icon.png` (180×180) — iOS home-screen icon.
- `icons/icon-192.png` / `icons/icon-512.png` — padded onto the game's dark background color
  (`#050a08`) so they don't look like a floating logo on a launcher grid.
- `manifest.json` — makes "Add to Home Screen" actually work on mobile with a real name,
  icon, and theme color, instead of just bookmarking a browser tab.

## 4. Firebase no longer a single point of failure for the *entire game* (`src/config.js`)

Found a real bug, not just polish: `firebase.initializeApp(...)` ran unguarded at the top
of `config.js`, which is imported by nearly every scene. If the Firebase CDN script failed
to load (blocked wifi, ad-blocker, fully offline device, flaky venue network), that line
threw and **the whole game failed to boot** — not just the leaderboard, everything — with
a blank screen and no explanation. Wrapped it in a try/catch that falls back to a null
leaderboard connection; every leaderboard function already had its own try/catch with a
sensible fallback (offline tag, seed leaderboard data, skip the upload), so the rest of the
game — movement, shop, matches — now works completely fine with zero internet.

Also added a 6-second timeout wrapper around every Firestore call (tag lookup, score
upload, Top 5 fetch, rank lookup). Previously a stalled connection could leave the win/lose
screen stuck on "CONNECTING TO STADIUM SERVERS..." indefinitely instead of falling back —
now it always resolves one way or the other within a few seconds.

## 5. Vercel-specific setup (`vercel.json`, `README.md`, analytics snippet in `index.html`)

- Added the plain-HTML Vercel Web Analytics snippet to `index.html` (`window.va` stub +
  `/_vercel/insights/script.js`). It's a no-op until you deploy on Vercel and turn on
  **Web Analytics** for the project in the dashboard — nothing to configure locally.
- Added `vercel.json` with a 7-day cache header for `sprites/`, `audios/`, `fonts/`,
  `icons/`. (Deliberately *not* a 1-year "immutable" cache — none of these filenames are
  content-hashed, so if you ever swap an image/sound and keep the same filename, a longer
  cache means returning visitors could see the stale version for longer. 7 days is a solid
  middle ground for a short-run club-fair site.)
- README's "Deployment" line updated from GitHub Pages → Vercel, plus a new section on the
  one manual post-deploy step: swapping `YOUR-DOMAIN` in `index.html`'s `og:image` /
  `twitter:image` tags for your real Vercel domain (these need an absolute URL to work in
  link previews — Discord/WhatsApp/X won't resolve a relative path).

## Files touched
`index.html`, `manifest.json` (new), `vercel.json` (new), `favicon.ico` (new), `icons/*`
(new), `src/config.js`, `src/assets.js`, `README.md`, plus the compressed asset files
themselves (`sprites/*.jpg`, `sprites/*.png`, `audios/*.mp3`).

## One thing still worth doing manually
After your first deploy, open `index.html` and replace `YOUR-DOMAIN` (two spots, both in
the `<head>`) with your actual Vercel URL — that's the only piece that genuinely can't be
known before you deploy.
