---
phase: 03-frontend-wiring
plan: 01
subsystem: backend-prerequisites
tags: [backend, tdd, bugfix, tv]
dependency_graph:
  requires: []
  provides:
    - GET /api/games with ?status filter (D-09)
    - vier-gewinnt.js p.role fix (Pitfall 3)
    - TV game:finished idle transition (D-12)
  affects:
    - server/routes/games.js
    - server/game-types/vier-gewinnt.js
    - public/tv.js
    - server/routes/games.test.js
    - server/game-types/vier-gewinnt.test.js
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN with node:test
    - Express route ordering (GET / before GET /:id)
    - Parameterised SQLite query for status filter
key_files:
  created: []
  modified:
    - server/routes/games.js
    - server/game-types/vier-gewinnt.js
    - public/tv.js
    - server/routes/games.test.js
    - server/game-types/vier-gewinnt.test.js
decisions:
  - "GET /api/games placed as first route in games.js (before POST /) to ensure it precedes GET /:id"
  - "vier-gewinnt.test.js player fixtures updated from team to role to match corrected initState filter"
  - "TV idle uses renderIdle(null) — winner name shown on next reconnect (RESEARCH.md assumption A1)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  files_modified: 5
  tests_added: 4
  tests_total: 170
---

# Phase 03 Plan 01: Backend Prerequisites Summary

**One-liner:** GET /api/games with status filter, vier-gewinnt p.role fix, TV 3-second idle transition after game:finished.

## Tasks Completed

| Task | Description | Commit | Result |
|------|-------------|--------|--------|
| 1 | Add GET /api/games route + GT21/GT22/GT23 (RED then GREEN) | 2c5bd16 | 3 new tests passing |
| 2 | Fix vier-gewinnt p.team→p.role + GT24 (RED then GREEN) | c28ca4c | 4 new tests passing |
| 3 | Wire TV idle transition on game:finished | 3f44223 | Full suite 170/170 |

## What Was Built

### Task 1 — GET /api/games route (D-09)

Added `router.get('/', ...)` as the **very first route** in `server/routes/games.js` (before `router.post('/')` and `router.get('/:id')`). Route accepts optional `?status` query parameter. Uses parameterised SQLite prepare to avoid injection (T-03-01 mitigation applied). Returns games sorted `id DESC`. No authentication required — consistent with existing unauthenticated `GET /:id`.

Test stubs GT21, GT22, GT23 added RED first (all failing with Express 404 before route existed), then GREEN after route insertion.

### Task 2 — vier-gewinnt.js p.team → p.role fix (Pitfall 3)

Fixed `initState` filter predicates in `server/game-types/vier-gewinnt.js` lines 31-32:
- `players.filter(p => p.team === 'X')` → `players.filter(p => p.role === 'X')`
- `players.filter(p => p.team === 'O')` → `players.filter(p => p.role === 'O')`

The map output shape is unchanged (`team: 'X'` / `team: 'O'` still written to state). Only the filter predicate changed. `games.js` passes players with `p.role` (set from `game_players.role` column); without this fix both `tX` and `tO` arrays were always empty.

GT24 added RED first (state.tX.length was 0 before fix), GREEN after fix.

### Task 3 — TV idle transition (D-12)

Replaced single-line stub in `public/tv.js`:
```
socket.on('game:finished', ({ state }) => renderGame(state));
```
With the full handler:
```javascript
socket.on('game:finished', function({ state }) {
  renderGame(state);
  setTimeout(function() { renderIdle(null); }, 3000);
});
```
TV now shows the final game state for 3 seconds after game ends, then transitions to the idle screen. The `null` argument shows "Noch kein Spiel gespielt" during the 3-second window; the server pushes the correct `lastWinner` on the next reconnect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vier-gewinnt.test.js player fixtures**
- **Found during:** Task 2 (after applying the p.team → p.role fix)
- **Issue:** Existing test `C5: getFinalResults flags correct winner` was failing because the `players` fixture in `vier-gewinnt.test.js` used `team: 'X'` / `team: 'O'` — but `initState` now reads `p.role`. With the fix applied, `tX` and `tO` came out empty for the test fixture too, breaking C5.
- **Fix:** Updated `vier-gewinnt.test.js` player fixtures from `{ team: 'X' }` to `{ role: 'X' }` (same for 'O'). The test now correctly validates the fixed behavior.
- **Files modified:** `server/game-types/vier-gewinnt.test.js`
- **Commit:** c28ca4c

## Verification Results

```
node --test server/routes/games.test.js
  tests 24, pass 24, fail 0
  GT21 ✔  GT22 ✔  GT23 ✔  GT24 ✔

node --test (full suite)
  tests 170, pass 170, fail 0
```

Route ordering verified: `router.get('/')` appears at line 17 in games.js, before `router.post('/')` and well before `router.get('/:id')`.

p.role fix verified: `vier-gewinnt.js` lines 31-32 now read `p.role === 'X'` / `p.role === 'O'`.

TV idle wired: `public/tv.js` `game:finished` handler now calls `renderGame(state)` then schedules `renderIdle(null)` after 3000ms.

## Known Stubs

None — all three changes are complete implementations, not stubs.

## Threat Flags

No new threat surface introduced beyond T-03-01 (parameterised query, mitigated).

## Self-Check: PASSED

- server/routes/games.js: FOUND (GET / route at line 17)
- server/game-types/vier-gewinnt.js: FOUND (p.role at lines 31-32)
- public/tv.js: FOUND (renderIdle in game:finished handler)
- server/routes/games.test.js: FOUND (GT21/GT22/GT23/GT24)
- server/game-types/vier-gewinnt.test.js: FOUND (role fixtures)
- Commits: 2c5bd16, c28ca4c, 3f44223 — all exist in git log
- Full suite: 170 tests, 0 failures
