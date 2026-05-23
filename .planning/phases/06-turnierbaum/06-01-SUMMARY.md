---
phase: 06-turnierbaum
plan: "01"
subsystem: game-engine/kda
tags: [tdd, red-phase, double-elimination, test-contract]
wave: 0
dependency_graph:
  requires: []
  provides: ["kda-de-test-contract"]
  affects: ["kegler-des-abends.js"]
tech_stack:
  added: []
  patterns: ["node:test flat tests", "RED-phase behavioral contract"]
key_files:
  created: []
  modified:
    - Claude/server/game-types/kegler-des-abends.test.js
decisions:
  - "KDA8 uses state.bracket assertion (not just deepEqual) to force RED against old engine"
  - "players6 fixture provides bye-slot coverage (6→8 bracket = 2 byes)"
  - "playToGF helper navigates non-GF matches only, ensuring correct GF seat population test"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  files_changed: 1
requirements:
  - TOURNAMENT-01
  - TOURNAMENT-02
---

# Phase 6 Plan 01: DE Bracket Test Suite (Wave 0 — RED Phase) Summary

**One-liner:** Complete 14-test Double-Elimination behavioral contract using `state.bracket[]` flat slot array — RED phase confirms 13 failures against the old match-list engine.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite C1–C5 contract tests for DE bracket shape | e98eff4 | kegler-des-abends.test.js |
| 2 | Write KDA1–KDA9 DE-specific tests | e98eff4 | kegler-des-abends.test.js |

---

## What Was Built

Completely rewrote `Claude/server/game-types/kegler-des-abends.test.js` with a 14-test suite that specifies the behavioral contract of the new Double-Elimination bracket engine:

**Contract tests (C1–C5):**
- C1: Module shape (id, name, initState, applyThrow, isFinished, getFinalResults) — PASSES
- C2: initState returns `state.bracket[]` array, isFinished is false — FAILS (no bracket field)
- C3: applyThrow immutability via `state.bracket.find()` — FAILS (bracket undefined)
- C4: Two deterministic replays via bracket traversal produce deepEqual final states — FAILS
- C5: getFinalResults returns exactly 1 winner after full bracket playthrough — FAILS

**DE-specific tests (KDA1–KDA9):**
- KDA1: 4-player bracket has ≥5 slots; all slots have required keys (id, p1, p2, throws, done, isBye, bracket, advancesWinnerTo, advancesLoserTo) — FAILS
- KDA2: 8-player bracket has GF slot (bracket==='GF'); all non-bye W-R1 slots have p1 and p2 — FAILS
- KDA3: 6-player bracket has exactly 2 bye slots (done=true, winner set, no p2) — FAILS
- KDA4: After one throw, match.throws.length===1, match.done===false (accumulation) — FAILS
- KDA5: After 2 throws, higher-pin-count player is winner, advancesWinnerTo slot populated — FAILS
- KDA6: Equal throws set tiebreak=true, done=false, throwsRequired=4 — FAILS
- KDA7: GF has throwsRequired=4; resolves correctly after all 4 throws — FAILS
- KDA8: applyThrow is a no-op when player has no active match (stale throw guard) — FAILS
- KDA9: initState throws Error for <4 or >12 players — FAILS

---

## RED State Verification

```
npm run test:games output:
  tests 103
  pass  90    (all other game modules passing)
  fail  13    (C2-C5 + KDA1-KDA9 — all kegler-des-abends failures)
  EXIT_CODE: 1
```

The 13 failure messages all reference:
- `AssertionError: state.bracket must be an array` (old engine returns spieler/matches)
- `TypeError: Cannot read properties of undefined (reading 'find')` (bracket.find on undefined)
- `AssertionError: Missing expected exception` (KDA9 — no validation in old engine)

C1 passes because the module still exports the same six properties (id, name, initState, applyThrow, isFinished, getFinalResults).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] KDA8 required state.bracket assertion to fail against old engine**
- **Found during:** Task 2 verification
- **Issue:** Original KDA8 draft using `kda.applyThrow(state, 999, 7)` accidentally PASSED against the old engine — the old engine uses matchId (not playerId) as first arg, and id 999 is simply not found, returning state unchanged coincidentally.
- **Fix:** Rewrote KDA8 to assert `Array.isArray(init.bracket)` first, which makes it fail against the old engine with the correct error (`state.bracket must be an array`). The stale-throw deepEqual check is preserved for the Wave 1 GREEN validation.
- **Files modified:** kegler-des-abends.test.js
- **Commit:** e98eff4

---

## Test File Structure

```
'use strict';
// 3 player fixtures (players4, players8, players6)
// C1: module shape — PASS
// C2: isFinished after initState — FAIL
// C3: immutability via bracket.find — FAIL
// C4: determinism via bracket traversal — FAIL
// C5: getFinalResults 1 winner — FAIL
// KDA1: bracket array shape (4p) — FAIL
// KDA2: GF slot + W-R1 population (8p) — FAIL
// KDA3: bye slots (6p) — FAIL
// KDA4: throw accumulation — FAIL
// KDA5: match resolution + advancement — FAIL
// KDA6: tie detection — FAIL
// KDA7: Grand Final 4-throw logic — FAIL
// KDA8: stale throw guard — FAIL
// KDA9: player count validation — FAIL
```

No `describe` blocks. All 14 tests are flat `test()` calls.

---

## Known Stubs

None. This plan creates tests only — no implementation stubs.

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. Test file only — trust boundary is test→engine module (local require). No new threat surface introduced.

---

## Self-Check: PASSED

- [x] `Claude/server/game-types/kegler-des-abends.test.js` exists and has 14 tests
- [x] Commit e98eff4 exists: `git log --oneline | grep e98eff4`
- [x] `npm run test:games` exits non-zero (exit code 1)
- [x] Exactly 13 failures (≥13 required by plan)
- [x] C1 passes, C2-C5 and KDA1-KDA9 all fail
- [x] No references to state.spieler, state.matches, state.mid, state.wRound in new tests
- [x] No `describe` blocks in file
