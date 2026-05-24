---
phase: 07-highlights-tv-layouts
plan: 01
subsystem: testing
tags: [tdd, node-test, socket.io-client, bcryptjs, highlights, kda, bilderkegel]

# Dependency graph
requires:
  - phase: 06-turnierbaum
    provides: KDA bracket implementation and game-type infrastructure used in test fixtures
  - phase: 01-backend-foundation
    provides: games.js, players.js, stats.test.js pattern, db/index, game-types/index

provides:
  - Failing test stubs HL10-HL13 for GET /api/highlights/current (RED state)
  - Failing test G-HL01 for game:finished typeKey assertion (RED state)
  - insertFinishedKDAGame and insertFinishedBKGame fixture helpers

affects:
  - 07-02 (implements the route that makes HL10-HL13 and G-HL01 pass)
  - 07-03 (frontend wiring — depends on highlights endpoint being live)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED phase: test-first stubs using node:test + assert/strict pattern from stats.test.js
    - Isolated socket.io-enabled server scope within single test (G-HL01 self-contained mini server)
    - Deterministic KDA bracket using seededShuffle (seed parameter) to enable reproducible fixture data
    - BK game fixture via state-replay (applyThrow loop) ensuring consistent loserId

key-files:
  created:
    - Claude/server/routes/highlights.test.js
  modified:
    - Claude/server/routes/games.test.js

key-decisions:
  - "insertFinishedKDAGame uses seed='test-hl11' + seededShuffle so bracket layout is deterministic and winnerId is reliable across runs"
  - "G-HL01 creates its own socket.io-enabled HTTP server in test scope to avoid breaking existing games.test.js before() setup (which has no io)"
  - "highlights endpoint is public (no requireSession) matching stats.js pattern — no login step in before()"
  - "HL13 uses explicit finished_at timestamps ('2026-01-01' vs '2026-06-01') to reliably test recency ordering"

patterns-established:
  - "TDD fixture helpers: insertFinishedKDAGame / insertFinishedBKGame — replay game state via applyThrow loop, insert DB rows from result"
  - "Socket.io test isolation: create dedicated IOServer+ioclient per test, always close in finally block"

requirements-completed:
  - HIGHLIGHT-01
  - HIGHLIGHT-02
  - HIGHLIGHT-03
  - HIGHLIGHT-04

# Metrics
duration: 25min
completed: 2026-05-24
---

# Phase 7 Plan 01: Highlights TDD — Failing Test Stubs (Wave 0 RED)

**4 failing HTTP test stubs for GET /api/highlights/current and 1 failing Socket.io typeKey assertion establish the behavioral contract before any Wave 1 implementation**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T00:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `highlights.test.js` with 4 RED stubs (HL10-HL13) covering null/null, KDA champion, BK loser, and recency ordering
- Extended `games.test.js` with G-HL01 that asserts `game:finished` payload includes `typeKey` — fails because `games.js` line 195 does not emit it yet
- Full test suite: 391 passing + 5 failing (exactly the new stubs) — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create highlights.test.js with stubs HL10-HL13** - `4308b82` (test)
2. **Task 2: Extend games.test.js with typeKey assertion G-HL01** - `f88f6f8` (test)

## Files Created/Modified
- `Claude/server/routes/highlights.test.js` — New file: 4 failing integration tests for /api/highlights/current with insertPlayer, insertFinishedKDAGame, insertFinishedBKGame fixtures
- `Claude/server/routes/games.test.js` — Extended: appended G-HL01 test with socket.io-client that asserts typeKey in game:finished payload

## Decisions Made
- `insertFinishedKDAGame` uses `seed='test-hl11'` so the bracket shuffle is deterministic and the winner is always the same player across test runs
- G-HL01 runs an isolated socket.io-enabled server scoped inside the test (not in before()), preventing interference with the 24 existing tests that share a non-io server
- `highlights` endpoint has no auth guard (public read-only) matching the stats.js pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
By design (Wave 0 RED phase): all 5 new tests are intentional stubs that fail until Wave 1 implements `highlights.js` and patches `games.js`. These are tracked for the verifier and will resolve in plan 07-02.

## Next Phase Readiness
- Wave 0 complete — behavioral contract established via failing tests
- Wave 1 (07-02) can now implement `highlights.js` route, register it in `app.js`, and patch `games.js` line 195 to add `typeKey` to the `game:finished` payload
- All 5 stubs will pass after Wave 1; this summary documents the RED state baseline

## Self-Check: PASSED
- `Claude/server/routes/highlights.test.js` exists — FOUND
- `Claude/server/routes/games.test.js` G-HL01 appended — FOUND
- Commits 4308b82 and f88f6f8 exist in git log — VERIFIED
- Full suite: 391 pass, 5 fail — VERIFIED

---
*Phase: 07-highlights-tv-layouts*
*Completed: 2026-05-24*
