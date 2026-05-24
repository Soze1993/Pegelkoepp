# Plan 07-05 Summary

## What Was Built

Fixed five UAT-identified bugs across bilderkegel.js, index.html, and drei-vollen.js:
early-advance logic for Bilderkegel max-throw, corrected Kleeblatt pin array, theme-aware
kegelSVG CSS variables, proper BK winner-name lookup using state.players, and Drei-Vollen
stechen (tie-break) phase with optional skip.

## Files Changed

- `server/game-types/bilderkegel.js`: added `maxReachedEarly` check so non-Volle Bilder advance after one throw when max pins reached
- `server/game-types/bilderkegel.test.js`: updated BK5 to use safe throw values compatible with early-advance logic; added BK7 (Kleeblatt early advance) and BK8 (Volle always 2 throws)
- `server/game-types/drei-vollen.js`: full replacement — added stechen phase, stechenPlayers, skipStechen(), stechenSkipped flag; getFinalResults honours stechen winner
- `server/game-types/drei-vollen.test.js`: added DV1-DV4 stechen tests (initState, tie triggers stechen, immutability, skipStechen no-winner)
- `public/index.html`: four fixes — Kleeblatt pins [2,3,4,6,7,8], kegelSVG CSS vars, BK thumbnail 36x45 with overflow:visible, getWinnerName bilderkegel reads state.players

## Test Results

All 404 tests pass (0 failures).

```
ℹ tests 404
ℹ pass 404
ℹ fail 0
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BK5 test expected old behavior (always 2 throws)**
- **Found during:** Task 6 — after implementing the max-throw early-advance, BK5 asserted P1 score = 50 which assumed 2 throws per Bild even when max is reached
- **Issue:** BK5 used value=5 per throw; Hint.Kranz (max=5), Damen (max=4), Bauern (max=2) all triggered early advance, giving P1 score=35 not 50
- **Fix:** Rewrote BK5 to use value=1 per throw (safe below all max values) so 2 throws always occur; updated expected scores to 10 vs 0
- **Files modified:** `server/game-types/bilderkegel.test.js`
- **Commit:** 6453062

## Must Haves Status

- [x] BK max-throw early-advance logic (bilderkegel.js applyThrow)
- [x] Kleeblatt pins corrected to 6 pins in index.html
- [x] kegelSVG uses CSS custom properties for theme-awareness
- [x] BK thumbnail size reduced to 36x45 with overflow:visible
- [x] getWinnerName for bilderkegel reads state.players correctly
- [x] Drei-Vollen stechen mechanism implemented
- [x] All 404 tests pass

## Self-Check

Files created/modified:
- C:\Users\tobia\Claude\server\game-types\bilderkegel.js — exists
- C:\Users\tobia\Claude\server\game-types\bilderkegel.test.js — exists
- C:\Users\tobia\Claude\server\game-types\drei-vollen.js — exists
- C:\Users\tobia\Claude\server\game-types\drei-vollen.test.js — exists
- C:\Users\tobia\Claude\public\index.html — exists

Commit 6453062 — verified in git log.

## Self-Check: PASSED
