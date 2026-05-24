# Plan 07-08 Summary

## What Was Built

Undo button added to all active spielen views (all game types), and distinct Web Audio API tones
added for KDA and Bilderkegel game-end events. No external audio files required.

- **Undo button:** After the `renderSpielenTab` switch dispatch, a `↩ Rückgängig` button is
  appended via DOM to `el` whenever `S.aktSpiel.state.done` is falsy. The button calls the
  pre-existing `submitUndo()` function and is hidden once the game finishes.
- **KDA tone (`playKDATone`):** Ascending triangle-wave arpeggio (C5→E5→G5→C6) at 0.2 s
  intervals, ~180 ms per note.
- **BK tone (`playBKTone`):** Descending sawtooth sequence (C5→B4→A#4→A4) at 0.25 s
  intervals, ~230 ms per note — distinct "loser" feel for Bilderkegel.
- Both tones are triggered inside `handleGameFinished()` before `showWinnerBanner()`, keyed on
  `S.aktSpiel.type_key`.
- BK thumbnail overflow fix (`kegelSVG(b.pins,36,45)` with `overflow:visible`) was already in
  place from plan 07-05 — verified, no changes needed.

## Files Changed

- `Claude/public/index.html`: Added undo button DOM injection in `renderSpielenTab`; added
  `playKDATone()` and `playBKTone()` functions; updated `handleGameFinished()` to call tones.

## Test Results

```
ℹ tests 404
ℹ pass  404
ℹ fail  0
ℹ duration_ms 12307
```

All 404 tests pass, 0 failures.

## Must Haves Status

- [x] Undo button appears in all active game spielen views
- [x] Undo calls correct endpoint and re-renders state
- [x] KDA/BK game-end plays distinct tones (no external files)
- [x] BK thumbnails not cut off (verified already fixed in 07-05)
- [x] All names/content via textContent (no innerHTML for user data) — existing XSS safety preserved; undo button uses `.textContent`

## Deviations from Plan

None — plan executed exactly as written. Task 3 (BK thumbnail) confirmed already done, skipped as instructed.

## Self-Check

- [x] `Claude/public/index.html` modified and committed at 8add371
- [x] Undo button DOM logic present in `renderSpielenTab`
- [x] `playKDATone` and `playBKTone` functions present
- [x] `handleGameFinished` updated to call tone functions
- [x] All 404 tests pass
