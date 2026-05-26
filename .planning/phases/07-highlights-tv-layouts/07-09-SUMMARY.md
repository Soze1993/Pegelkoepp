---
phase: 07-highlights-tv-layouts
plan: "07-09"
subsystem: tv-display
tags: [tv, bug-fix, viergewinnt, highlights, game-names]
dependency_graph:
  requires: []
  provides: [correct-game-names, stable-idle-transition, vg-redesign]
  affects: [public/tv.js]
tech_stack:
  added: []
  patterns: [replaceChildren-for-safe-DOM-reset, textContent-XSS-safety]
key_files:
  created: []
  modified:
    - Claude/public/tv.js
decisions:
  - renderIdle always calls gameEl.replaceChildren(playerListEl) to evict any overlay before hiding #game
  - VG layout changed from 3-column side-by-side to top-teams + bottom-grid; cellSize uses min(vw,vh) formula for balanced sizing
  - xDim/oDim logic uses !xWon && winner !== 'draw' so only the losing team is dimmed on game end
metrics:
  duration_minutes: 10
  completed_date: "2026-05-26"
  tasks_completed: 4
  tasks_total: 4
  files_changed: 1
---

# Phase 7 Plan 09: TV.js Gap Fixes Summary

## One-Liner

Fixed 3 wrong GAME_NAMES keys, hardened renderIdle to restore playerList and refresh highlights, and redesigned Viergewinnt TV to show teams at top with 9x9 grid below.

## What Was Built

### Task 1 — GAME_NAMES keys corrected

Three keys in the `GAME_NAMES` map were mismatched with the actual `type_key` values emitted by the server:

| Before | After | Display name |
|--------|-------|-------------|
| `grosseHausnummer` | `grosseHaus` | Große Hausnummer |
| `kleineHausnummer` | `kleineHaus` | Kleine Hausnummer |
| `plusMinusMal` | `plusMinus` | Plus Minus Mal |

`makeGameNameHeader()` uses `GAME_NAMES[currentTypeKey]` — wrong keys meant these games showed no title on the TV overlay.

### Task 2 — renderIdle hardened

Added `gameEl.replaceChildren(playerListEl)` as the first DOM operation in `renderIdle()`. This:
- Evicts any overlay element that was injected by `renderEndOverlay` (which calls `gameEl.replaceChildren(overlayEl)` and thereby detaches `#playerList`)
- Restores `#playerList` back into `#game` so the generic renderer's `playerListEl.replaceChildren()` call operates on an attached node again

Added `renderHighlightsHdr()` call at the end of `renderIdle()` to ensure the highlights bar text is refreshed whenever the TV enters idle state (previously only updated on DOMContentLoaded and after `game:finished`).

### Task 3 — Viergewinnt TV redesign

Replaced the 3-column side-by-side layout (Team X | Grid | Team O) with a stacked layout:
- Row 1: game name header
- Row 2: two team panels side by side (flex row, each flex:1). Active team gets colored border + glow; game-over losing team is dimmed to 0.35 opacity
- Row 3: 9x9 grid fills remaining height, preceded by column numbers (1-9)

Cell size formula changed from `calc((88vh - 27px) / 9)` (height-only) to `calc((min(100vw - 4vw, 85vh) - 24px) / 9)` so the grid is constrained by whichever dimension is smaller — prevents overflow on portrait/landscape edge cases.

Grid cell colors use semi-transparent fills (`VG_X + '99'`, `VG_O + '99'`) matching the plan spec.

### Task 4 — Tests

All 408 tests pass with 0 failures (`npm test`, commit 3b7f45f).

## Commits

| Hash | Message |
|------|---------|
| 3b7f45f | fix(07-09): TV.js — correct GAME_NAMES keys, restore playerList in idle, redesign VG layout |

## Deviations from Plan

None — plan executed exactly as written. The plan's code blocks were used verbatim for all three changes.

## Known Stubs

None.

## Threat Flags

None — all changes are pure DOM rendering logic in a client-side JS file; no new network endpoints, auth paths, or data access patterns introduced.

## Self-Check: PASSED

- [x] `Claude/public/tv.js` exists and contains all three changes
- [x] Commit 3b7f45f verified in git log
- [x] 408/408 tests pass, 0 failures
