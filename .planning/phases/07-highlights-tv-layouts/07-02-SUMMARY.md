---
phase: 07-highlights-tv-layouts
plan: 02
subsystem: api
tags: [highlights, kda, bilderkegel, socket.io, express, sqlite, node-test, tdd]

# Dependency graph
requires:
  - phase: 07-01
    provides: Failing test stubs HL10-HL13 and G-HL01 that Wave 1 must make GREEN
  - phase: 06-turnierbaum
    provides: KDA bracket implementation (kegler-des-abends.js) and reconstructState used in highlights.js
  - phase: 01-backend-foundation
    provides: games.js router, db singleton, game-types/index, reconstructState export

provides:
  - GET /api/highlights/current endpoint returning kda_champion and bk_loser player objects
  - typeKey field on game:finished socket event payload
  - type_key field on game:state socket event payload (Pitfall 1 fix — TV reconnect caching)

affects:
  - 07-03 (frontend wiring — TV screen reads /api/highlights/current and typeKey from events)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Public read-only endpoint with try/catch around reconstructState (non-fatal skip on failure)
    - KDA bracket seed must match String(game.id) — use game.id as seed, not a fixed string, so reconstructState reproduces the same bracket layout as the original play session

key-files:
  created:
    - Claude/server/routes/highlights.js
  modified:
    - Claude/server/app.js
    - Claude/server/routes/games.js
    - Claude/server/routes/highlights.test.js

key-decisions:
  - "highlights.js has no requireSession guard — public endpoint matching stats.js pattern; TV screen needs it without login"
  - "getBKLoserId sorts state.players by sum(bildPts, null=0) ascending and returns the first player's id"
  - "try/catch around each reconstructState call in highlights.js — non-fatal skip; endpoint always returns 200 (T-07-02-03)"
  - "KDA fixture seed must be String(gameId): insertFinishedKDAGame inserts game first, then uses String(gameId) as bracket seed so reconstructState matches"

patterns-established:
  - "KDA seed alignment: any test fixture that inserts a KDA game and then calls reconstructState must use String(gameId) as the bracket seed — not a fixed string like 'test-hl11'"

requirements-completed:
  - HIGHLIGHT-01
  - HIGHLIGHT-02
  - HIGHLIGHT-03
  - HIGHLIGHT-04

# Metrics
duration: 20min
completed: 2026-05-24
---

# Phase 7 Plan 02: Highlights Backend Implementation (Wave 1 GREEN)

**GET /api/highlights/current endpoint via highlights.js that queries last finished KDA/BK games from DB and returns champion/loser player objects; game:finished enriched with typeKey; game:state enriched with type_key for TV reconnect**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T00:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `server/routes/highlights.js` with `getBKLoserId` helper and public `GET /current` route; registered in `app.js`
- Patched `games.js` line 195 to include `typeKey: game.type_key` in `game:finished` socket emission
- Patched `server.js` game:state emission to include `type_key: game.type_key` (Pitfall 1 fix from RESEARCH.md)
- All 5 Wave 0 stubs (HL10, HL11, HL12, HL13, G-HL01) now GREEN; full suite 396/396 pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create highlights.js route and register in app.js** - `792fc5f` (feat)
2. **Task 2: Enrich game:finished with typeKey and game:state with type_key** - `d244c3a` (feat)

## Files Created/Modified
- `Claude/server/routes/highlights.js` — New: public GET /current route with getBKLoserId helper; queries last finished KDA and BK games from DB; try/catch around reconstructState calls
- `Claude/server/app.js` — +1 line: `app.use('/api/highlights', require('./routes/highlights'))` after /api/stats
- `Claude/server/routes/games.js` — +1 field: `typeKey: game.type_key` added to game:finished socket emission (line 195)
- `Claude/server/server.js` — +1 field: `type_key: game.type_key` added to game:state socket emission on active-game reconnect
- `Claude/server/routes/highlights.test.js` — Bug fix in insertFinishedKDAGame fixture (see Deviations)

## Decisions Made
- `highlights.js` uses no `requireSession` guard — public endpoint consistent with `stats.js` pattern; TV display must access it without a user session
- `getBKLoserId` uses `(p.bildPts || []).reduce((a,b) => a + (b !== null ? b : 0), 0)` matching the existing `bkTotal` function in `bilderkegel.js`
- Both DB queries use `ORDER BY finished_at DESC LIMIT 1` so the most recent game always wins (HL13 recency test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed KDA fixture seed mismatch in highlights.test.js**
- **Found during:** Task 1 (verifying HL11 and HL13)
- **Issue:** `insertFinishedKDAGame` generated throws using `seed: 'test-hl11'` but `reconstructState` in `games.js` uses `seed: String(game.id)` when replaying KDA throws. The resulting bracket layouts were different, so replaying the stored throws on the wrong bracket produced `done: false` and `gewinner: null` — causing HL11 and HL13 to fail even after highlights.js was correctly implemented.
- **Fix:** Refactored `insertFinishedKDAGame` to insert the game row first (to obtain `gameId`), then call `kda.initState(players, { seed: String(gameId) })` — exactly matching the seed that `reconstructState` will use. Throws are then generated and inserted after.
- **Files modified:** `Claude/server/routes/highlights.test.js`
- **Verification:** HL11 and HL13 pass GREEN; HL10, HL12 unaffected
- **Committed in:** `792fc5f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Fix was essential for test correctness. No scope creep. The fixture is now aligned with the production code's reconstruction logic.

## Issues Encountered
The seed mismatch between the Wave 0 test fixture and `reconstructState`'s KDA seed derivation (`String(game.id)`) caused HL11 and HL13 to fail despite correct `highlights.js` implementation. Resolved by fixing the fixture to insert game first and derive seed from the actual DB `game.id`.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — all 5 stubs from Wave 0 are now fully wired with production implementation.

## Threat Flags
No new threat surface introduced — `GET /api/highlights/current` is a read-only public endpoint consistent with the existing `/api/stats` pattern. The `typeKey` and `type_key` fields added to socket events are internal DB values set at game creation (not derived from client input).

## Next Phase Readiness
- Backend highlights API fully live: `GET /api/highlights/current` returns `{ kda_champion, bk_loser }` with player objects
- Socket events enriched with game type info (typeKey / type_key) so TV client can track game type on live updates and reconnects
- Wave 2 (07-03) can now wire the TV frontend to consume `/api/highlights/current` and the enriched socket events

## Self-Check: PASSED
- `Claude/server/routes/highlights.js` exists — FOUND
- `Claude/server/app.js` contains `/api/highlights` — VERIFIED (line 67)
- `Claude/server/routes/games.js` contains `typeKey: game.type_key` — VERIFIED (line 195)
- `Claude/server/server.js` contains `type_key: game.type_key` — VERIFIED (line 44)
- Commit 792fc5f exists — VERIFIED
- Commit d244c3a exists — VERIFIED
- Full suite: 396 pass, 0 fail — VERIFIED

---
*Phase: 07-highlights-tv-layouts*
*Completed: 2026-05-24*
