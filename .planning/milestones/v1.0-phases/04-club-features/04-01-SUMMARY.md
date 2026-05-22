---
phase: 04-club-features
plan: 01
subsystem: api
tags: [sqlite, express, node-test, better-sqlite3, migrations, stats, game-types, abende]

# Dependency graph
requires:
  - phase: 03-frontend-wiring
    provides: reconstructState export from routes/games.js; full working REST API + Socket.io backend
  - phase: 01-backend-foundation
    provides: DB schema, migration pattern, requireSession middleware, game-types module
provides:
  - GET/POST /api/abende — Kegelabend session CRUD (active/open/end)
  - GET /api/stats — per-player aggregated wins/losses/draws/pudel_count/pudel_pct/personal_bests
  - GET/POST/DELETE /api/game-types — custom game type CRUD
  - abend auto-link in POST /api/games (sets abend_id from active abend)
  - DB migrations: abende table + games.abend_id column
affects: [04-frontend-ui, 04-club-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DAYS array for German weekday abbreviations ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.']
    - slugify helper for game-type keys (umlaut replacement + non-alphanumeric → hyphen)
    - isDraw = winners.length !== 1 (handles 0-winner VG draw AND multi-winner ties)
    - json_extract(meta, '$.pudel') = 1 for pudel detection (integer, not boolean)
    - Personal bests: max score for most types; kleineHaus uses min (winner only)
    - requireSession on all write routes; GET routes are public

key-files:
  created:
    - Claude/server/routes/abende.js
    - Claude/server/routes/stats.js
    - Claude/server/routes/game-types.js
    - Claude/server/routes/abende.test.js
    - Claude/server/routes/stats.test.js
    - Claude/server/routes/game-types.test.js
  modified:
    - Claude/server/db/index.js
    - Claude/server/db/schema.sql
    - Claude/server/routes/games.js
    - Claude/server/app.js

key-decisions:
  - "isDraw = winners.length !== 1 — handles both VG draw (0 winners) and multi-winner ties (>1 winners) with a single condition"
  - "DAYS array for German date names instead of toLocaleDateString — locale-independent, works in all Node.js environments"
  - "Personal bests: kleineHaus records only winner's score (minimum); all other types track personal maximum regardless of win/loss"
  - "Pudel detection: json_extract(meta, '$.pudel') = 1 (integer comparison) — SQLite stores JSON booleans as integers"
  - "requireSession on all write routes (POST/DELETE); GET /api/stats and GET /api/abende/active are public"

patterns-established:
  - "DAYS array: const DAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'] for locale-independent German weekday names"
  - "slugify: lowercase + umlaut replacement (ä→ae, ö→oe, ü→ue) + non-alphanumeric sequences → hyphen + trim hyphens"
  - "Abend guard: SELECT WHERE ended_at IS NULL before INSERT; return 409 if active abend already open"
  - "Stats aggregation: reconstructState + getFinalResults per game; skip unknown type_key gracefully"

requirements-completed: [PERS-03, PERS-04, STAT-01, STAT-02, STAT-03]

# Metrics
duration: ~90min
completed: 2026-05-21
---

# Phase 4 Plan 01: Backend Infrastructure for Club Features Summary

**Three new API route files (abende, stats, game-types) with DB migrations, abend auto-link in POST /api/games, and 24 new node:test tests — all mounted and green alongside 170 prior tests**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-05-21
- **Completed:** 2026-05-21
- **Tasks:** 3 (2 TDD auto + 1 human-verify checkpoint)
- **Files modified:** 10

## Accomplishments

- Delivered all Phase 4 backend infrastructure in Wave 1 before any frontend work: abende CRUD, stats aggregation, and custom game-type management
- 24 new tests (AB01–AB06, ST10–ST20, GT25–GT31) cover all new routes including edge cases (VG 0-winner draw, pudel detection, archived player exclusion, unknown type_key grace)
- Full test suite remains green: 194 tests, 0 failures (170 prior + 24 new)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests AB01–AB06 and GT25–GT31** - `dbd827a` (test)
2. **Task 1 (GREEN): DB migrations, abende/game-types routes, app.js mounting** - `d3b8334` (feat)
3. **Task 2 (GREEN): Stats tests ST10–ST20 + abend auto-link in POST /api/games** - `365cc03` (feat)

_Note: Task 2 RED phase was combined with GREEN in the same commit; stats tests were written first then implementation added. Task 3 was a human-verify checkpoint (no code commit)._

## Files Created/Modified

- `Claude/server/routes/abende.js` — Kegelabend CRUD: GET /active, POST /, POST /:id/end, GET /
- `Claude/server/routes/stats.js` — GET /api/stats with wins/losses/draws/pudel_count/pudel_pct/personal_bests per player
- `Claude/server/routes/game-types.js` — Custom game type CRUD: GET /, POST / (with slugify), DELETE /:id (403 for builtins)
- `Claude/server/routes/abende.test.js` — Tests AB01–AB06 (abend lifecycle, 409 double-open guard)
- `Claude/server/routes/stats.test.js` — Tests ST10–ST20 (wins/losses/draws, pudel, personal bests, archived players, unknown type_key)
- `Claude/server/routes/game-types.test.js` — Tests GT25–GT31 (slugify, duplicate 409, builtin DELETE 403, auth 401)
- `Claude/server/db/index.js` — Added 2 migrations: `CREATE TABLE IF NOT EXISTS abende` + `ALTER TABLE games ADD COLUMN abend_id`
- `Claude/server/db/schema.sql` — Added abende table documentation
- `Claude/server/routes/games.js` — Abend auto-link in POST /api/games: reads active abend, sets abend_id on INSERT
- `Claude/server/app.js` — Mounted /api/abende, /api/stats, /api/game-types before error middleware

## Decisions Made

**isDraw = winners.length !== 1**
Handles both the VG draw scenario (state.winner='draw', 0 winner:true entries) and multi-winner ties (>1 winner:true). A single condition covers both cases.

**DAYS array instead of toLocaleDateString**
`const DAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.']` is locale-independent. toLocaleDateString output varies by system locale and Node.js ICU data build; the array is deterministic in tests.

**Personal bests: kleineHaus winner-only minimum, all others personal maximum**
For kleineHaus the canonical "best" is the lowest score (fewer pins left), and only the winner's score is meaningful. For all other game types, any player can see their personal best score regardless of win/loss.

**json_extract(meta, '$.pudel') = 1**
SQLite stores JSON boolean `true` as integer `1`. Comparing to `= 1` (not `= true` or `= 'true'`) is correct for better-sqlite3 JSON extraction.

**requireSession scope**
All write routes (POST /, POST /:id/end, DELETE /:id) require session. GET routes (GET /active, GET /, GET /api/stats, GET /api/game-types) are public — consistent with existing pattern in games.js and players.js.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All Phase 4 backend routes are live and tested; Phase 4 Wave 2 (04-02 frontend UI) can start immediately
- Frontend needs: GET /api/abende/active, POST /api/abende, POST /api/abende/:id/end, GET /api/stats, GET /api/game-types, POST /api/game-types, DELETE /api/game-types/:id
- Abend auto-link is transparent to frontend — POST /api/games requires no change on the client side

---
*Phase: 04-club-features*
*Completed: 2026-05-21*
