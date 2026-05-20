---
phase: 02-real-time-tv
plan: "02"
subsystem: api
tags:
  - socket.io
  - schema-migration
  - helmet-csp
  - undo
  - meta-persistence
  - better-sqlite3

dependency_graph:
  requires:
    - "02-01 (Wave 0 RED stubs: DB05, DB06, GT16-GT19; socket.io-client test harness)"
    - "01-04 (games API, activeGames, reconstructState — 153 Phase 1 tests passing)"
  provides:
    - "throws.meta TEXT NULL column (idempotent ALTER TABLE migration)"
    - "game_players.role TEXT NULL column (idempotent ALTER TABLE migration)"
    - "Socket.io server attached to http.Server via new Server(server)"
    - "app.locals.io populated BEFORE server.listen — safe for route handlers (02-03)"
    - "io.on('connection') handler: emits game:state with active game or idle:true"
    - "POST /api/games/:id/undo endpoint (DB-first delete + reconstructState + io emit)"
    - "reconstructState selects meta and role; applies parsedMeta to applyThrow"
    - "throw:applied and game:finished Socket.io emits in POST /:id/throws"
    - "Helmet CSP connect-src: 'self' ws: wss: — WebSocket upgrades not silently blocked"
  affects:
    - "02-03 (throw sync + undo events: use req.app.locals.io with if (io) guard)"
    - "02-04 (TV display: Socket.io connection receives game:state on connect)"

tech-stack:
  added:
    - "socket.io 4.8.3 (already in package.json from 02-01 deviation; no reinstall needed)"
  patterns:
    - "Idempotent SQLite ALTER TABLE via try/catch on 'duplicate column name' error (D-12)"
    - "app.locals.io pattern: io instance shared via Express app to all route handlers"
    - "Lazy require('./routes/games') in io.on('connection') — avoids circular module-load"
    - "io guard pattern: const io = req.app.locals.io; if (io) { ... } — keeps Phase 1 tests green"
    - "DB-first undo: DELETE throws row → reconstructState → activeGames.set (D-08)"
    - "meta JSON: JSON.stringify on INSERT, JSON.parse in reconstructState (D-13)"

key-files:
  created: []
  modified:
    - "server/db/index.js — Phase 2 migration block (throws.meta, game_players.role)"
    - "server/server.js — Socket.io init, app.locals.io, io.on('connection') handler"
    - "server/routes/games.js — meta INSERT, reconstructState update, undo route, io emits"
    - "server/app.js — Helmet CSP override for ws:/wss: in connect-src"

key-decisions:
  - "socket.io already installed in 02-01 (deviation Rule 3) — Task 1 skips npm install"
  - "Migration uses try/catch on 'duplicate column name' not IF NOT EXISTS (D-12) — SQLite does not support ADD COLUMN IF NOT EXISTS"
  - "Lazy require in io.on('connection') to avoid circular import at module load time (RESEARCH.md A1)"
  - "undo route uses reconstructState not in-memory state — correct, crash-safe, includes meta (D-08)"
  - "io guard (if (io)) in all emit calls — Phase 1 tests don't set app.locals.io, guard keeps 153 tests green"
  - "game:state idle path sets lastWinner: null — proper winner query deferred to 02-04 Task 2 (D-04)"

patterns-established:
  - "io guard: const io = req.app.locals.io; if (io) { io.to(...).emit(...) } — mandatory for all future route emit calls"
  - "app.locals.io access: req.app.locals.io in route handlers, db.prepare(...) in io.on('connection')"

requirements-completed: []

duration: ~30min
completed: "2026-05-20"
---

# Phase 2 Plan 02: Socket.io Foundation + Schema Migrations — Summary

**Socket.io 4.x attached to Express http.Server with idempotent ALTER TABLE migrations (throws.meta, game_players.role), undo endpoint, and Helmet CSP WebSocket fix — turning 6 RED Wave 0 stubs green (DB05, DB06, GT16-GT19); 160/164 tests passing.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-20T14:30:00Z
- **Completed:** 2026-05-20T15:00:00Z
- **Tasks:** 3 (+ games.js changes bundled in Task 2)
- **Files modified:** 4

## Accomplishments

- Idempotent ALTER TABLE migrations run on every server start: `throws.meta TEXT NULL` and `game_players.role TEXT NULL` columns added via try/catch on SQLite duplicate-column-name error (DB05 + DB06 now GREEN)
- Socket.io server attached to the same `http.Server` Express uses; `app.locals.io` set BEFORE `server.listen`; connection handler auto-emits `game:state` with most recently started active game or `{ idle: true }` for no-game state (D-09, D-10)
- `POST /api/games/:id/undo` endpoint added with DB-first delete, reconstructState rebuild, and `undo:applied` Socket.io emit — GT16, GT17, GT18 now GREEN
- `reconstructState` updated to select `gp.role` and `throws.meta`; applies `parsedMeta` to `applyThrow`; ORDER BY `id ASC` for undo correctness — GT19 now GREEN
- Helmet CSP `connect-src` overridden to include `ws:` and `wss:` — Socket.io WebSocket upgrades no longer silently blocked in dev or production (T-02-03 mitigated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install socket.io + idempotent ALTER TABLE migrations** - `e0989fa` (feat)
2. **Task 2: Attach Socket.io + undo route + games.js meta/role updates** - `91d1cdb` (feat)
3. **Task 3: Helmet CSP connect-src for ws:/wss:** - `eff4f72` (feat)

## Files Created/Modified

| File | Change |
|------|--------|
| `server/db/index.js` | Migration block added: throws.meta + game_players.role, idempotent |
| `server/server.js` | Socket.io init, app.locals.io, io.on('connection') connection handler |
| `server/routes/games.js` | meta INSERT, reconstructState with meta+role, undo route, io emits |
| `server/app.js` | Helmet CSP override — connect-src: 'self' ws: wss: |

## Test Results

```
node --test 2>&1 | summary:
  tests     164
  pass      160   (153 Phase 1 + ST01 + DB05 + DB06 + GT16 + GT17 + GT18 + GT19)
  fail        0
  todo        4   (ST02, ST03, ST04, ST05 — deferred to 02-03/02-04)
  cancelled   0
  skipped     0
```

### Wave 0 stubs turned GREEN

| ID | File | Was | Now | Turns green via |
|----|------|-----|-----|-----------------|
| DB05 | db.test.js | FAIL (RED) | PASS | Task 1 — ALTER TABLE migration |
| DB06 | db.test.js | FAIL (RED) | PASS | Task 1 — idempotency |
| GT16 | games.test.js | FAIL (RED) | PASS | Task 2 — undo 401 |
| GT17 | games.test.js | FAIL (RED) | PASS | Task 2 — undo 400 |
| GT18 | games.test.js | FAIL (RED) | PASS | Task 2 — undo 200 |
| GT19 | games.test.js | FAIL (RED) | PASS | Task 2 — meta JSON persistence |

### Still RED (todo) — Wave 1/2

| ID | File | Status | Turns green in |
|----|------|--------|---------------|
| ST02 | socket.test.js | todo | 02-03 (throw:applied emit wired) |
| ST03 | socket.test.js | todo | 02-03 (game:state payload verified) |
| ST04 | socket.test.js | todo | 02-03 (undo:applied emit) |
| ST05 | socket.test.js | todo | 02-03/02-04 (reconnect sync) |

## CSP Header Verification

GET /tv response `Content-Security-Policy`:
```
default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';
frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';
script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests;
connect-src 'self' ws: wss:
```

All Helmet 8 defaults remain; only `connect-src` is overridden.

## Migration Block (excerpt)

```javascript
// Phase 2 migrations (D-12, D-13): idempotent via try/catch on duplicate-column error
const migrations = [
  'ALTER TABLE throws ADD COLUMN meta TEXT NULL',
  'ALTER TABLE game_players ADD COLUMN role TEXT NULL'
];
for (const sql of migrations) {
  try { db.exec(sql); }
  catch (e) { if (!e.message.includes('duplicate column name')) throw e; }
}
```

## Note for 02-03 / 02-04

`req.app.locals.io` is now safe to access in any route handler. Use the io guard pattern:

```javascript
const io = req.app.locals.io;
if (io) {
  io.to(`game:${gameId}`).emit('event:name', payload);
}
```

The guard ensures existing Phase 1 tests (which do not set `app.locals.io`) continue to pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added undo route and meta persistence to games.js (bundled in Task 2)**
- **Found during:** Task 2 — GT16-GT19 tests require undo route and meta persistence
- **Issue:** Plan listed only `server/server.js` in Task 2 `<files>`, but the undo endpoint and meta changes in `routes/games.js` are required for the plan's success criteria (GT16-GT19 green)
- **Fix:** Applied all games.js changes (meta INSERT, reconstructState, undo route, io emits) as part of Task 2 commit — they are logically coupled to the Socket.io infrastructure
- **Files modified:** `server/routes/games.js`
- **Verification:** GT16-GT19 now pass; 19/19 games tests green
- **Committed in:** `91d1cdb` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality for plan success criteria)
**Impact on plan:** Necessary to achieve stated success criteria. No scope creep — all changes are within plan 02-02 objective.

## Issues Encountered

None — all tasks executed without blocking issues.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `req.app.locals.io` is safe to access in 02-03 throw sync handler
- `undo:applied`, `throw:applied`, `game:finished` events already emitted — 02-03 only needs to wire ST02-ST05
- `throws.meta` and `game_players.role` columns exist — game types requiring metadata can now persist it
- Phase 1 test suite (153 tests) remains 100% passing

---
*Phase: 02-real-time-tv*
*Completed: 2026-05-20*
