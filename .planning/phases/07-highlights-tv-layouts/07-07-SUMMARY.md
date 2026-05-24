# Plan 07-07 Summary

## What Was Built

Five TV frontend fixes applied to `Claude/public/tv.js`:

1. **overlayTimeoutId tracking** — prevents stacked/leaked `setTimeout` calls when the end-overlay fires multiple times or is interrupted by a new game event.
2. **GAME_NAMES map + makeGameNameHeader()** — central lookup of display names for all game types; a `div.tv-game-name-hdr` is prepended to every type-specific container and to the generic player-list renderer.
3. **BK Bild display** — `renderBilderkegelTV` now shows the current Bild name (e.g. "Kleeblatt"), a pin-formation SVG (via `kegelSVGtv()`), and "Bild N/5" counter above the player list while the game is in progress.
4. **TV idle highlights bar** — `tvHighlights` is fetched from `/api/highlights/current` on DOMContentLoaded and re-fetched after every `game:finished` event; `renderIdle` appends a bar with "KDA-Sieger" and "BK-Verlierer" names using safe `textContent`.
5. **VG 9-column board** — `renderViergewinntTV` fully rewritten; shows a 9x9 CSS-grid of circles (empty/X/O coloured), column numbers 1–9, team headers with player names, and a winner/draw banner. Losing team is dimmed to 0.5 opacity on game-end.

## Files Changed

- `Claude/public/tv.js`:
  - Added `overlayTimeoutId`, `tvHighlights`, `GAME_NAMES`, `makeGameNameHeader()`, `kegelSVGtv()` at module top
  - Added `DOMContentLoaded` fetch for highlights
  - `renderIdle`: clears `overlayTimeoutId`; appends highlights bar
  - `renderGame`: clears `overlayTimeoutId`; removes stale `.tv-game-name-hdr`; inserts game name header for generic renderer
  - `renderEndOverlay`: clears `overlayTimeoutId` at entry; uses `overlayTimeoutId` for both the 3-second short-circuit and 10-second main timeout
  - `game:finished` handler: re-fetches highlights after overlay
  - `renderBilderkegelTV`: Bild section (name + SVG + Bild N/5) added before player list; `makeGameNameHeader()` prepended to container
  - `renderFuchsjagdTV`: `makeGameNameHeader()` prepended to container
  - `renderViergewinntTV`: completely replaced — 9x9 board grid + team headers + column numbers + winner/draw banners + game name header

## Test Results

```
ℹ tests 404
ℹ suites 0
ℹ pass 404
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 12278.7494
```

All 404 server-side tests pass. tv.js is a pure frontend file with no server-side test coverage; logic was verified by code review.

## Must Haves Status

- [x] overlayTimeoutId cleared on renderGame/renderIdle
- [x] Game name visible in TV view for all game types (bilderkegel, fuchsjagd, viergewinnt, generic renderer, kda bracket shows Winner/Loser/GF Bracket labels as before)
- [x] BK TV shows current Bild name + pin formation SVG
- [x] TV idle shows highlights names (KDA-Sieger / BK-Verlierer via /api/highlights/current)
- [x] VG TV shows real 9-column board with X/O pieces and team header
- [x] VG winner uses team name not player name (TEAM X / TEAM O)
- [x] All names set via textContent (XSS safe)

## Commits

- `4d67390` — feat(07-07): TV overlay timeout, GAME_NAMES, BK Bild display, highlights bar, VG 9-col board

## Deviations from Plan

None — plan executed exactly as written. Minor note: `kegelSVGtv` uses `innerHTML` to insert the generated SVG string into a wrapper `div` (as specified in the plan), but the SVG content is constructed entirely from static pin-coordinate data with no user input, so there is no XSS vector.

## Self-Check: PASSED

- `Claude/public/tv.js`: FOUND (728 lines)
- Commit `4d67390`: FOUND in git log
