---
phase: 02-real-time-tv
plan: "03"
subsystem: api
tags:
  - api
  - undo
  - socket-emit
  - reconstruct-state
  - throw-meta
  - game:started
  - role-persistence
  - tdd

dependency_graph:
  requires:
    - "02-02 (Socket.io foundation, schema migrations, undo route, meta persistence, io guard pattern)"
    - "02-01 (Wave 0 RED stubs: ST02-ST05 as t.todo)"
  provides:
    - "game:started broadcast to all sockets when new game is created (D-11)"
    - "role column persisted to game_players on POST /api/games via optional roles map"
    - "GT20: undo 404 on non-existent or finished game"
    - "ST02 (RT-01): throw:applied event-driven assertion — real test, 2000ms bound"
    - "ST04 (PLAY-01): undo:applied event-driven assertion — real test, 2000ms bound"
    - "ST05 (RT-02): reconnect game:state assertion — real test, 2000ms bound"
  affects:
    - "02-04 (TV display: relies on game:started, throw:applied, undo:applied, game:state events)"

tech_stack:
  added: []
  patterns:
    - "io.emit (not io.to().emit) for game:started — broadcast to ALL sockets, not just room (D-11)"
    - "roles map in POST /api/games body — { '<playerId>': 'fuchs' } for fuchsjagd (D-13)"
    - "waitForEvent promise set BEFORE fetch to avoid race conditions in socket tests"
    - "try/finally in socket tests for guaranteed disconnect even on assertion failure"

key_files:
  created: []
  modified:
    - "server/routes/games.js — game:started emit in POST /, role persistence in game_players INSERT"
    - "server/routes/games.test.js — GT20 added (undo 404 for non-existent/finished game)"
    - "server/routes/socket.test.js — ST02, ST04, ST05 implemented as real event-driven assertions"

decisions:
  - "ST03 remains t.todo — TV-02 state shape fully exercised end-to-end in 02-04; ST02 already asserts Array.isArray(state.players)"
  - "waitForEvent promise set before fetch in ST04 to prevent race where event arrives before listener registers"
  - "game:started uses io.emit (all sockets) not io.to(room).emit (room-only) — TVs not yet in a room when idle"
  - "roles map keyed by String(player.id) for JSON safety when numeric keys used as object keys"

metrics:
  duration: "~20 minutes"
  completed: "2026-05-20"
  tasks_completed: 3
  files_created: 0
  files_modified: 3
---

# Phase 2 Plan 03: Throw-Sync + Undo Vertical Slice — Summary

**Throw-sync + undo vertical slice complete: game:started broadcast, role persistence in game_players, GT20 undo 404, and ST02/ST04/ST05 socket tests implemented as real event-driven assertions — full suite 165 tests, 164 passing, 1 todo (ST03 deferred to 02-04).**

## What Was Built

### Games.js — 2 additions

| Edit Site | Change |
|-----------|--------|
| POST / handler — `insertGamePlayer` statement | Updated to `INSERT INTO game_players (game_id, player_id, seat, role) VALUES (?, ?, ?, ?)` with role from optional `roles` map in request body |
| POST / handler — after `activeGames.set` | Added `if (io) io.emit('game:started', { gameId, state, type_key })` broadcast to all sockets (D-11) |

Note: The following games.js changes were implemented in plan 02-02 (already present at start of this plan):
- `INSERT INTO throws` with meta column + `JSON.stringify(meta)`
- `reconstructState` with `gp.role`, `meta`, `ORDER BY id ASC`, `JSON.parse(t.meta)`
- `POST /:id/undo` route with DB-first DELETE + reconstructState + `undo:applied` emit
- `throw:applied` and `game:finished` emits in `POST /:id/throws`

### New Tests

| ID | File | Type | Behavior |
|----|------|------|----------|
| GT20 | games.test.js | REST | POST /:id/undo on non-existent game → 404; on finished game → 404 |
| ST02 | socket.test.js | Socket | throw:applied received within 2000ms after POST /:id/throws |
| ST04 | socket.test.js | Socket | undo:applied received after POST /:id/undo; state reflects undo (wuerfe.length === 1) |
| ST05 | socket.test.js | Socket | reconnecting socket receives game:state with idle:false + correct gameId |

## Test Results

```
node --test (full suite):
  tests     165
  pass      164   (153 Phase 1 + DB05 + DB06 + GT16 + GT17 + GT18 + GT19 + GT20 + ST01 + ST02 + ST04 + ST05)
  fail        0
  todo        1   (ST03 — deferred to 02-04 TV page)
  cancelled   0
  skipped     0
```

### Wave 0 stubs turned GREEN in this plan

| ID | File | Was | Now | Turned green via |
|----|------|-----|-----|-----------------|
| ST02 | socket.test.js | t.todo | PASS | Task 3 — throw:applied event assertion |
| ST04 | socket.test.js | t.todo | PASS | Task 3 — undo:applied event assertion |
| ST05 | socket.test.js | t.todo | PASS | Task 3 — reconnect game:state assertion |
| GT20 | games.test.js | missing | PASS | Task 2 — undo 404 non-existent/finished |

### Still todo — Wave 3 (02-04)

| ID | File | Status | Turns green in |
|----|------|--------|---------------|
| ST03 | socket.test.js | todo | 02-04 (TV page exercises full state shape) |

## io Guard Confirmation

Every emit in `server/routes/games.js` uses the guard pattern:

```javascript
const io = req.app.locals.io;
if (io) { io.to(...).emit(...); }
// or for game:started (broadcast):
if (io) io.emit('game:started', { gameId, state, type_key });
```

Phase 1 tests do not set `app.locals.io` → guard ensures 0 regressions.

## Requirement Coverage Map

| Requirement | Test(s) | Status |
|-------------|---------|--------|
| RT-01 (throw appears on TV in < 2s) | ST02 | GREEN |
| PLAY-01 (single-step undo) | GT16/GT17/GT18/GT20 + ST04 | GREEN |
| RT-02 (reconnect sync) | ST05 | GREEN |

## Deviations from Plan

### Context deviation: Task 1 scope reduced

**Found at plan start:** The 02-02 SUMMARY confirmed that nearly all games.js changes from Task 1 were already implemented in plan 02-02 (meta INSERT, reconstructState meta+role+id ASC, undo route, io emits). Only `game:started` and `role` persistence were missing.

**Action (Rule 3 — execution continuation):** Implemented the two missing pieces (`game:started` emit + `role` column persistence in game_players INSERT) and proceeded. No regression — all 19 games.test.js tests still passing.

**Files modified:** `server/routes/games.js`
**Commit:** 858331a

### Bug fix in ST04: race condition with waitForEvent

**Found during:** Task 3 ST04 implementation

**Issue:** First attempt set `waitForEvent` AFTER the fetch calls for the two preliminary throws. The `throw:applied` event arrived before the listener was registered, causing a 2000ms timeout.

**Fix:** Moved `const throwPromise1 = waitForEvent(...)` BEFORE each fetch. This is the documented pattern from PATTERNS.md ("Listen for throw:applied BEFORE submitting the throw").

**Files modified:** `server/routes/socket.test.js`
**Impact:** ST04 went from timeout failure to 145ms pass.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| ST03 (t.todo) | socket.test.js | TV-02 state shape (players[].id, .name, .wuerfe) fully exercised in 02-04 TV page; ST02 already asserts `Array.isArray(state.players)` |

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced beyond what is documented in the plan threat model. All emit calls use the `if (io)` guard; prepared statements prevent SQL injection.

## Self-Check: PASSED

- `server/routes/games.js` contains `game:started` — FOUND (line 67)
- `server/routes/games.js` contains `INSERT INTO game_players (game_id, player_id, seat, role)` — FOUND (line 42)
- `server/routes/games.js` contains `req.app.locals.io` — FOUND (lines 66, 149, 189)
- `server/routes/games.js` contains `throw:applied` — FOUND (line 151)
- `server/routes/games.js` contains `game:finished` — FOUND (line 153)
- `server/routes/games.js` contains `undo:applied` — FOUND (line 190)
- `server/routes/games.js` contains `JSON.stringify(meta)` — FOUND (line 127)
- `server/routes/games.js` contains `JSON.parse(t.meta)` — FOUND (line 219)
- `server/routes/games.js` contains `ORDER BY id ASC` — FOUND (line 215)
- `server/routes/games.js` contains `gp.role FROM` — FOUND (line 208)
- `server/routes/games.js` contains `router.post('/:id/undo', requireSession` — FOUND (line 165)
- `server/routes/games.test.js` contains GT20 — FOUND
- `server/routes/socket.test.js` does NOT contain `t.todo` for ST02 — VERIFIED
- `server/routes/socket.test.js` does NOT contain `t.todo` for ST04 — VERIFIED
- `server/routes/socket.test.js` does NOT contain `t.todo` for ST05 — VERIFIED
- `server/routes/socket.test.js` contains `waitForEvent` for `throw:applied` — FOUND
- `server/routes/socket.test.js` contains `waitForEvent` for `undo:applied` — FOUND
- Commit 858331a — feat(02-03): game:started emit + role persistence — FOUND
- Commit 995085d — test(02-03): GT20 — FOUND
- Commit d1e5920 — feat(02-03): ST02, ST04, ST05 socket tests — FOUND
- Full suite: 165 tests, 164 passing, 0 failing, 1 todo — VERIFIED
