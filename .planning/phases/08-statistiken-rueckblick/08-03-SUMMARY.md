---
phase: 08-statistiken-rueckblick
plan: 03
subsystem: backend-api
tags: [express, sqlite, recap, last-summary, tdd, green-phase]

requires:
  - phase: 08-statistiken-rueckblick
    plan: 01
    provides: AB30..AB32 RED stubs in abende.test.js
  - phase: 08-statistiken-rueckblick
    plan: 02
    provides: getBKLoserId export in highlights.js (already landed before this plan ran)

provides:
  - GET /api/abende/last-summary handler in server/routes/abende.js
  - AB30..AB32 GREEN (all 9 abende tests pass)

affects:
  - 08-04-PLAN (frontend wiring — reads /api/abende/last-summary for recap card)

tech-stack:
  added: []
  patterns:
    - "reconstructState + getFinalResults loop per game, same as highlights.js and stats.js"
    - "getBKLoserId imported from highlights.js (cross-route dependency via require)"
    - "ORDER BY id ASC for abend-games query (BK exemption chain safety)"
    - "Public GET handler placed before GET / to prevent future /:id param capture"

key-files:
  created: []
  modified:
    - server/routes/abende.js
    - server/routes/abende.test.js

key-decisions:
  - "Used ended_at DESC for last-abend query (not finished_at) — correct per spec, returns most recently closed evening"
  - "Used ORDER BY id ASC for per-abend games query — matches BK exemption chain insertion order"
  - "No outer try/catch on handler — inner per-game try/catch is sufficient, same as highlights.js style"
  - "AB30 test fix: added DELETE FROM abende WHERE ended_at IS NOT NULL before asserting null — AB01..AB06 closed abende left state pollution"

requirements-completed: [RECAP-01, RECAP-02]

duration: ~8 min
completed: 2026-05-27
---

# Phase 8 Plan 03: GET /api/abende/last-summary — Summary

**Public recap endpoint returning last closed Kegelabend with KDA champion, BK loser, and per-game summary via reconstructState loop over abend-linked finished games**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-27T14:05:00Z
- **Completed:** 2026-05-27T14:13:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `server/routes/abende.js` extended with `GET /last-summary` handler
- Three new imports added: `gameTypes`, `reconstructState`, `getBKLoserId`
- Handler placed after `/active` and before `GET /`, matching route ordering convention
- Query logic: last closed abend via `ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1`, games via `abend_id = ? ORDER BY id ASC`
- KDA champion resolved from `state.gewinner.id`, BK loser from `getBKLoserId(state)`
- Per-game summary: `{ id, type_key, finished_at, winner_name, player_count }`
- AB30 test isolation fix: cleanup of closed abende from prior tests (Rule 1 Bug)
- All 9 abende tests pass; full suite 432/432 green

## Task Commits

1. **Task 1: Implement GET /api/abende/last-summary** — `eb02b2a`

## Files Created/Modified

- `server/routes/abende.js` — handler at lines 29–92, three imports at lines 6–8
- `server/routes/abende.test.js` — AB30 DB cleanup fix (Rule 1 deviation)

## Handler Details

**Route path:** `GET /api/abende/last-summary`
**Placement:** Lines 29–92 in abende.js, after `/active` (line 22), before `GET /` (line 93)
**Authentication:** Public (no requireSession)

**Response shapes:**
- No closed abend: `200 body === null`
- Closed abend with games: `200 { abend: {id,name,started_at,ended_at}, kda_champion: {id,name,emoji}|null, bk_loser: {id,name,emoji}|null, games: [{id,type_key,finished_at,winner_name,player_count}] }`
- Closed abend without games: `200 { abend: {...}, kda_champion: null, bk_loser: null, games: [] }`

## Test Results

```
node --test server/routes/abende.test.js
ℹ tests 9
ℹ pass 9
ℹ fail 0
ℹ duration_ms ~688ms

node --test
ℹ tests 432
ℹ pass 432
ℹ fail 0
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AB30 test isolation failure due to cross-test closed-abend state**
- **Found during:** Task 1 (first test run)
- **Issue:** AB01..AB06 close abende via `POST /api/abende/:id/end` which sets `ended_at = datetime('now')`. AB30 assumed these would leave no closed abende, but the cleanup only closes them (sets `ended_at`), not deletes them. Result: AB30 found a closed abend and failed `assert.equal(body, null)`.
- **Fix:** Added `db.prepare('DELETE FROM abende WHERE ended_at IS NOT NULL').run()` at the start of AB30 to clear cross-test state before asserting no closed abend exists.
- **Files modified:** `server/routes/abende.test.js`
- **Commit:** `eb02b2a` (included in task commit)

**Total deviations:** 1 auto-fixed (1 x Rule 1 bug).
**Impact:** None on production code; test isolation now correct for AB30..AB32 sequence.

## Known Stubs

None — all response fields are wired to real DB data.

## Threat Flags

None — endpoint is read-only, no user-controlled input enters SQL, all values from prior DB rows (parameterized binding throughout).

## Self-Check

- [x] `server/routes/abende.js` contains `router.get('/last-summary'`
- [x] File contains `require('./highlights')` extracting `getBKLoserId`
- [x] File contains `require('./games')` extracting `reconstructState`
- [x] File contains `require('../game-types')` as `gameTypes`
- [x] File contains `ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1`
- [x] File contains `abend_id = ?` in SELECT query
- [x] File contains `ORDER BY id ASC` in games query
- [x] `node --test server/routes/abende.test.js` exits 0 (9/9 pass)
- [x] `node --test` exits 0 (432/432 pass)
- [x] Commit `eb02b2a` exists

## Self-Check: PASSED

---
*Phase: 08-statistiken-rueckblick*
*Completed: 2026-05-27*
