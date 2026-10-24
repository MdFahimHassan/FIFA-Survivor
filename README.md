# FIFA Survivor
### FIFA 26: Last Team Standing

**A competitive arcade survival game, built solo for BUCC R&D at the Club Fair, Summer 2026**

[![Play Now](https://img.shields.io/badge/PLAY-LIVE%20DEMO-00ff96?style=for-the-badge)](https://fifa-survivor-two.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Engine](https://img.shields.io/badge/Engine-Kaboom.js-00d4ff?style=for-the-badge)](https://kaboomjs.com)

> Survive an endless-feeling World Cup of rival nations in this fast-paced arcade shooter. Dodge, dash, and outlast waves of scaling defenders, collect coins to unlock upgrades in the Strategy Room, push through ten tournament stages to the Final, and chase the #1 spot on a live global leaderboard backed by Firebase.

<p align="center">
  <img src="sprites/menu.jpg" alt="FIFA Survivor main menu" width="90%">
</p>

<p align="center">
  <img src="sprites/SS.jpg" alt="FIFA Survivor gameplay" width="90%">
</p>

---

## Overview

Developed as a solo initiative for the **Research & Development Department** of BUCC (BRAC University Computer Club) for the Club Fair of Summer 2026, **FIFA Survivor** is a high-octane 2D web game built to test player reflexes and real-time strategic decision-making.

The core goal was to maximize **audience engagement**. Instead of a static single-player experience, the game has a cloud-synced global leaderboard. That turns it into a crowd-driven competition where attendees can try to dethrone the current high score on the show floor.

## Core Features

* **Live Global Leaderboard**: Uses Google Firestore to fetch and update the Top 5 players, with a personal rank shown after every run. Each player identity (name + tag) owns a single entry that is only updated when they beat their own best, so spamming "Try Again" never floods the board. The browser can only read the board. Every score goes through a small server API that checks it against a server-side run clock before saving, and Firestore rules deny all client writes. See [Anti-cheat](#anti-cheat) below.
* **Ten-Stage Tournament Run**: Progress from the Group Stage through the Round of 32, Round of 16, Quarter Finals, Semi Finals and the 3rd Place Play-off to the World Cup Final. Collect Golden Balls to advance (5 per stage number, then 50 in the Final to lift the trophy).
* **Dynamic Strategy Room (Shop)**: Balance risk and reward by spending coins on stat upgrades (Speed, Fire Rate, Magnet Radius) or saving up for one-time Endgame Tactics (Shotgun, Energy Shield, Piercing Ball). Spawning and enemies freeze while the shop is open.
* **Scaling Difficulty Engine**: Enemy spawn rates, speeds and tougher defender types escalate with every stage, including boss-tier rivals.
* **Signature Moves**: A slide-tackle dash that makes you invincible and cleaves through rivals, plus a Bicycle-Kick shockwave that hits everything around you. Both run on cooldowns.
* **Match Milestones**: An achievement system with 11 milestones, from your first kill to rare, hard-earned feats. Progress lasts for the browser session and resets with the saved profile.
* **Unique Player Tags**: Players with the same name get distinct `#NN` tags, reserved by the server so a crowd of "Ahmed"s at a booth never collide.
* **Pick Your Nation**: Choose from 48 national teams, and your name, team and audio settings are remembered between visits.
* **Menu Easter Eggs**: Seven star-player hype clips are hidden on the menu screen for curious players to find.
* **Built for Any Screen**: On-screen touch controls (joystick and action buttons), a safe-area-aware layout, and an installable PWA shell (web app manifest) let the game play as well on a phone as on a booth monitor.
* **Polished UI/UX**: Loading sequence with real download progress, smooth scene transitions, pause menu, settings (music and SFX volume, mute, reset saved profile) and responsive scaling.
* **Honest Offline Mode**: If the leaderboard can't be reached, the end screen says so and tells you when a score wasn't saved, instead of showing made-up players.

## Technology Stack

| Layer | Technology |
|---|---|
| Game Engine | [Kaboom.js](https://kaboomjs.com) 3000.1.17 (self-hosted in `vendor/`), 2D canvas rendering |
| Backend / Database | Firebase Firestore (browser reads via the modular SDK 10.14.1, lazy-loaded) |
| Serverless API | Vercel Functions in `api/` (Node.js, `firebase-admin`): run tokens, score submission, tag reservation |
| Languages | JavaScript (ES modules), HTML5, CSS3 |
| Deployment | Vercel: static site with no build step, plus the `api/` functions and security and cache headers in `vercel.json` |
| Distribution | Installable PWA (web app manifest and home-screen icons) |

## How to Play

| Action | Input |
|---|---|
| Move | `W A S D` or Arrow Keys / on-screen joystick |
| Shoot | Automatic target acquisition |
| Dash | `Shift` / on-screen DASH button (slide tackle, invincible while sliding) |
| Special Skill | `Space` for the Bicycle-Kick area shockwave |
| Strategy Room | `E` / on-screen SHOP button to open or close the upgrade shop |
| Pause | `Esc` |

**The objective:** survive the horde of national-team defenders, collect coins to build your economy, spend them wisely in the Strategy Room, collect Golden Balls to advance through all ten stages, win the Final, and dethrone the #1 player on the Global Leaderboard.

**Tip:** standing still for too long enrages nearby rivals, so keep moving.

## Local Installation (For Developers)

1. Clone this repository: `git clone https://github.com/<your-username>/FIFA-Survivor.git`
2. Run `npm install` (needed for the API functions and the tests).
3. Open the directory in your preferred IDE (e.g., VS Code).
4. Serve it:
   * **Game only** (no score uploads): any static server works, e.g. `npx serve .`. Opening `index.html` directly from disk will not work because the game uses ES modules. Without the API, the game runs, but scores are not saved and new players get a random tag.
   * **Full stack** (scores and tags work): `npx vercel dev`, with the environment variables from [Deploying to Vercel](#deploying-to-vercel) in a local `.env` file.
5. Firebase reads initialize automatically from `src/config.js`. To point the game at your own Firebase project, swap the `firebaseConfig` values there and publish `firestore.rules` to your project's Firestore console.
6. Game balance (costs, cooldowns, difficulty curve) lives in `src/balance.js`.

### Optional tools

* **Tests**: `npm test` runs the API unit tests (token signing, replay protection, score plausibility, tag reservation) against an in-memory fake of Firestore. No network or Firebase needed.
* **Rebuild the sprite atlases** after changing any flag or small sprite: `python3 tools/build_atlases.py`. It writes content-hashed file names (e.g. `atlas_flags.0c7125b5.png`) and updates `src/atlas_data.js`, so commit both.
* **Leaderboard cleanup**: `src/leaderboard_cleanup/leaderboard_cleanup.html` is an admin-only page for scanning leaderboard documents. Run it locally only. It is excluded from the Vercel deploy by `.vercelignore`. Because browser writes are now denied by `firestore.rules`, delete entries from the Firebase Console instead.

## Deploying to Vercel

The game itself is a static site with no build step. The `api/` folder is deployed automatically as serverless functions. `.vercelignore` keeps the admin tool, the old prototype code, the rules file, tests and large source images out of the deployment.

**One-time setup**

1. In **Vercel → Project → Settings → Environment Variables**, add:
   * `RUN_TOKEN_SECRET`: a long random string (32+ characters) used to sign run tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   * `FIREBASE_SERVICE_ACCOUNT`: the full service-account JSON from **Firebase Console → Project settings → Service accounts → Generate new private key** (paste the raw JSON, or the same JSON base64-encoded). Treat it as a secret and never commit it.
2. Paste `firestore.rules` into **Firebase Console → Firestore Database → Rules → Publish**. This is a separate, manual step; deploying to Vercel does not touch Firebase. **Publish it only after the new API is deployed**, because the new rules block the old direct-from-browser writes.
3. Redeploy so the environment variables take effect.

**After your first deploy**

1. Open `index.html` and replace the domain in the `og:image` / `twitter:image` meta tags with your real Vercel domain, so link previews (Discord, WhatsApp, X, etc.) show the screenshot correctly.
2. (Optional) Turn on **Web Analytics** for the project in the Vercel dashboard. The tracking script is already wired up in `index.html`.
3. Play one full match and check that your score appears on the board. Also confirm in DevTools → Network that `/sprites/atlas_*` responses carry `Cache-Control: public, max-age=31536000, immutable`.

## Anti-cheat

Scores are verified on the server instead of trusted from the browser:

1. When a match starts, the game calls `/api/start`. The server returns a signed token stamped with **its own clock** and tied to the player's name and tag.
2. When the match ends, the game sends the token and score to `/api/submit`. The server checks the signature, that the token belongs to that player, that the score is a whole number within the cap, and that it is **plausible for the time that really passed** (at most 12 points per second plus a small burst allowance, with a 3 second minimum run).
3. Each token works once. Re-sending the identical result (e.g. reopening the end screen) is harmless; a different score on a used token is rejected.
4. The server writes to Firestore with the Admin SDK. `firestore.rules` denies **all** browser writes, so calling the Firestore SDK from DevTools no longer works, and `runs` and `tag_reservations` are not readable by browsers at all.

What this does and doesn't do:

* A cheater can no longer post an arbitrary number such as 4900 after 10 seconds. The best they can do is play (or fake playing) for the real time at the maximum plausible rate, and that ceiling is tied to time, not to the cap alone.
* It still can't prove *how* a match was played. A bot or modified client that plays for the full duration could reach the plausible maximum. Keep `MAX_SCORE` (in `api/_lib.js`) just above the best score a human can really reach, and tune `MAX_SCORE_PER_SECOND` after watching real runs.
* The API has no rate limiting yet, so someone could script many fake player names slowly over time. Vercel's firewall rate limiting or Upstash-style counters would be the next step if that becomes a problem.
* The plausibility numbers live in both `src/config.js` (quick local pre-check) and `api/_lib.js` (authoritative). Keep them in sync. The player-name and doc-ID formats must also match `api/_lib.js`.

The game also strips `[ ]` and control characters from player names, because Kaboom treats `[ ]` as text markup.

## Performance Notes

* Everything loads behind the loading bar. The bar follows real download progress, and assets are started in small staged batches so decoding doesn't stutter (`src/assets.js`, `src/scenes/loading.js`).
* Flags and small sprites are packed into two atlases, which avoids dozens of GPU texture uploads. Rebuild them with `python3 tools/build_atlases.py`.
* **Caching** (`vercel.json`): the atlases (content-hashed names) and `vendor/` (version in the file name) are cached for a year as immutable. Other sprites, audio, fonts and icons are cached for 1 hour with a 1 day stale-while-revalidate window, so an asset you replace in place reaches returning players within about an hour. For anything that must update instantly, give the file a new name. Code and `index.html` are always revalidated.
* Menu and stadium backgrounds are served as WebP. Music is trimmed to seamless loops, since Kaboom fully decodes audio into RAM and long tracks are expensive on phones. Untrimmed originals are kept out of the deploy.
* Kaboom is self-hosted in `vendor/`, and Firebase is lazy-loaded as a modular ES module once the browser is idle, so it stays off the critical path. If the leaderboard can't be reached, the game still runs and the end screen says the leaderboard is offline.

## License

Released under the [MIT License](LICENSE). Free to use, modify, and build on, with attribution.

---

<p align="center"><i>Built with ⚽, ☕, and way too many playtesting sessions.</i></p>