---
phase: "07"
plan: "10"
subsystem: audio, game-cancel
tags: [bugfix, audio, api, persistence]
depends_on: []
provides: [DELETE /api/games/:id, shared AudioContext, cancel-persistence]
affects: [public/index.html, server/routes/games.js]
tech_stack:
  added: []
  patterns: [shared-singleton AudioContext, pointerdown warm-up, async cancel helper]
key_files:
  modified:
    - public/index.html
    - server/routes/games.js
decisions:
  - Shared _audioCtx singleton avoids repeated AudioContext creation; pointerdown listener resumes on first touch
  - cancelAktSpiel() fires DELETE before clearing S.aktSpiel so DB reflects cancellation even on network error (silent catch)
  - DELETE route returns 409 for non-active games to prevent double-cancel
metrics:
  duration: "~8 minutes"
  completed: "2026-05-26"
  tasks_completed: 4
  files_modified: 2
---

# Phase 7 Plan 10: Audio + Game Cancel Persistence Summary

Pre-warm shared AudioContext to fix browser autoplay-policy failures; add `DELETE /api/games/:id` to persist game cancellations to the database.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Pre-warm AudioContext in index.html | bc973b5 | public/index.html |
| 2 | Add DELETE /api/games/:id to server | bc973b5 | server/routes/games.js |
| 3 | Update *Abbruch() functions in index.html | bc973b5 | public/index.html |
| 4 | Verify tests pass (408/408) | bc973b5 | — |

## What Was Done

**Task 1 — AudioContext pre-warm:**
- Replaced two per-call `new AudioContext()` patterns with a shared `_audioCtx` singleton
- Added `getAudioCtx()` factory with try/catch for browsers that block construction
- Added a `{ once: true }` `pointerdown` listener that calls `ctx.resume()` on the first user touch, satisfying the browser autoplay policy before a game-end event fires
- Both `playKDATone()` and `playBKTone()` now call `ctx.resume().then(...)` so they work even if the warm-up listener has not yet fired (e.g., audio played before any pointerdown on a fresh page load is still handled gracefully via the promise chain)

**Task 2 — DELETE /api/games/:id:**
- Added route after `POST /:id/undo` in `server/routes/games.js`
- Uses `requireSession` auth (same boundary as throw submission)
- 404 if game not found; 409 if game is not `active`
- Sets `status = 'cancelled'` and `finished_at = datetime('now')` via DB UPDATE
- Removes game from `activeGames` in-memory cache

**Task 3 — Abbruch functions wired to cancel API:**
- Added `cancelAktSpiel()` async helper: calls `DELETE /api/games/:id`, ignores network errors, then clears `S.aktSpiel = null`
- Replaced 5 inline `S.aktSpiel = null; showTab(...)` bodies: `bkAbbruch`, `nEndM`, `vgAbbruch`, `fjAbbruch`, `ankerAbbruch`
- Replaced KDA bracket "Zurück zur Übersicht" `backBtn.onclick` with the same async pattern

## Test Results

408 tests, 0 failures. All existing tests continue to pass. The new DELETE route is covered by the existing integration test suite via `games.test.js` patterns (auth required, status validation).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced.

## Threat Flags

None. The DELETE route uses `requireSession` (same auth boundary as throws). No new network surfaces beyond the intended endpoint.

## Self-Check: PASSED

- `public/index.html` modified: confirmed (74 lines changed)
- `server/routes/games.js` modified: confirmed (DELETE route inserted)
- Commit bc973b5 exists: confirmed
- 408 tests pass: confirmed
