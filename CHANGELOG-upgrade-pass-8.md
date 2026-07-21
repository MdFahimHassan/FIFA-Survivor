# Upgrade Pass 8 — Changelog (Shop Polish, Leaderboard Rank, Menu Safeguard)

Scope: five focused fixes/features requested for the club-fair build — no unrelated
refactors bundled in.

## 1. Removed the duplicate "solo project" credit (`src/helpers.js`)

`addBranding()` (shown on the menu and the standalone Help screen) used to render
"A Solo Project by Md. Fahim Hassan" centered at the bottom of the screen. Now that
there's a dedicated Credits scene, that line was removed from `addBranding()` entirely.
The Credits scene itself (`src/scenes/credits.js`) is untouched — the author's name
still lives there, just not duplicated on every menu screen.

## 2. Strategy Shop hint box now fits its text (`src/scenes/main.js`)

The `[E] STRATEGY SHOP` pill in the top-right of the HUD had a hardcoded width (196px)
that didn't reliably contain the label at its font size, so the text visibly overflowed
the box. Fixed using the same "measure the text, then size the box" pattern already used
for the loading screen's tip box (`src/scenes/loading.js`, from pass 7):

- Text is added first (`shopHintFace`), then `shopHintBg.width` is set to
  `shopHintFace.width + padding`.
- A one-frame-later re-measure (`wait(0, fitShopHintBox)`) guards against the width not
  being final synchronously, same safety net `loading.js` already uses.

## 3. Upgrade-availability glow + reminder (`src/scenes/main.js`)

The Strategy Shop hint box now actively tells the player when it's worth opening:

- **Golden pulse** — a normal stat upgrade (Striking Speed / Running Speed / Ball
  Magnet) is affordable at the player's current score. Box outline + a soft halo behind
  it pulse gold, and a small line appears under the box: `NEW UPGRADES AVAILABLE IN SHOP`.
- **Rainbow/RGB pulse** — an Endgame Talent Tier item (Shotgun / Shield / Piercing) not
  yet owned is affordable. This takes priority over the golden state. Reminder reads
  `ENDGAME TIERS AVAILABLE IN SHOP!`. The rainbow cycle is a hand-rolled sine-wave RGB
  function (`rainbowColor()`), no external color-space helper needed.
- Otherwise, the box behaves exactly as before (idle cyan pulse from pass 7, no reminder).

Affordability is recomputed every frame from the same cost formulas the shop itself
uses (`BALANCE.*CostPerLevel`, `BALANCE.shotgunCost/shieldCost/piercingCost`), so it
can never drift out of sync with what's actually purchasable.

## 4. Player's own leaderboard rank shown after Top 5 (`src/config.js`,
   `src/scenes/lose.js`, `src/scenes/win.js`)

New `getPlayerStanding(finalScore)` in `config.js` pulls the full leaderboard and
computes **competition ranking**: rank = 1 + (number of entries with a strictly higher
score). Ties share a rank — e.g. five players tied on the same score all show as `#7`
together (because 6 entries beat them), and the next distinct score below them is `#12`,
not `#8`. The function also returns how many entries share that rank, so the UI can
say "tied with N others."

Both the Lose and Win screens now show a `--- YOUR STANDING ---` line under the Top 5
list — but only when the player isn't already visible in that Top 5, to avoid showing
the same info twice.

## 5. Confirmation before returning to the main menu (`src/helpers.js`,
   `src/pause_menu.js`)

New `confirmLeaveToMenu(onConfirm)` in `helpers.js` — a small DOM confirmation dialog
(same approach as the name-entry prompt in `menu.js`) warning that leaving means
starting with a new profile, with STAY / LEAVE MATCH options. Wired into both places
that send the player to the main menu:

- The **MAIN MENU** button in the shared post-match action row
  (`createPostMatchActions`, used by both the Win and Lose screens).
- The **QUIT TO MENU** button in the in-match pause menu (`pause_menu.js`).

`go("menu")` only fires if the player explicitly confirms.

## Files touched
`src/helpers.js`, `src/scenes/main.js`, `src/config.js`, `src/scenes/lose.js`,
`src/scenes/win.js`, `src/pause_menu.js`

## Try it
Open the menu and confirm the bottom-center credit line is gone. Start a match and check
the `[E] STRATEGY SHOP` box fully contains its text. Earn enough score to afford Striking
Speed (10 coins) and confirm the box + halo pulse gold with the reminder underneath; earn
enough for Shotgun Tactic (40 coins) and confirm it switches to the rainbow pulse with the
endgame reminder. Lose/win a match with a score outside the current Top 5 and confirm a
"YOUR STANDING" line appears with the correct rank. Press ESC mid-match and hit "QUIT TO
MENU," and separately hit "MAIN MENU" from a lose/win screen — both should now ask for
confirmation before leaving.
