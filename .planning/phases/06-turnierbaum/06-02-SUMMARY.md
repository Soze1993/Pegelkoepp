---
phase: 06-turnierbaum
plan: "02"
subsystem: game-engine/kda
tags: [double-elimination, bracket-engine, tdd, green-phase, pin-count]
wave: 1
dependency_graph:
  requires: ["kda-de-test-contract"]
  provides: ["kda-de-bracket-engine"]
  affects: ["kegler-des-abends.js", "index.test.js"]
tech_stack:
  added: []
  patterns:
    - "flat bracket array with predetermined routing"
    - "pin-count throw accumulation per match slot"
    - "tiebreak via throwsRequired extension"
    - "bye auto-resolution in initState (W-R1 null-opponent detection)"
key_files:
  created: []
  modified:
    - Claude/server/game-types/kegler-des-abends.js
    - Claude/server/game-types/index.test.js
decisions:
  - "Bye resolution restricted to W-R1 slots only — downstream slots are real matches waiting for two players, not byes"
  - "index.test.js updated to use 4-player kdaPlayers fixture for KDA (D-12 minimum enforcement)"
  - "seededShuffle and shuffle functions copied verbatim from old engine (crash recovery dependency)"
  - "16-player bracket implemented for 9-12 player count range with standard seeding pairs"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  files_changed: 2
requirements:
  - TOURNAMENT-01
  - TOURNAMENT-02
---

# Phase 6 Plan 02: Double-Elimination Bracket Engine (Wave 1 — GREEN Phase) Summary

**One-liner:** Full DE bracket engine with flat slot array, bye auto-resolution, pin-count accumulation, tiebreak mechanics, and Grand Final 4-throw rule — all 14 Wave 0 tests pass GREEN.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement initState — bracket generation with byes and routing | 02a0e45 | kegler-des-abends.js |
| 2 | Implement applyThrow and getFinalResults — pin accumulation, match resolution | 02a0e45 | kegler-des-abends.js, index.test.js |

---

## What Was Built

Completely rewrote `Claude/server/game-types/kegler-des-abends.js` (~285 lines) implementing a true Double-Elimination bracket engine:

### Engine Architecture

**Module-level utilities (preserved verbatim):**
- `seededShuffle(arr, seed)` — deterministic LCG Fisher-Yates shuffle for crash recovery
- `shuffle(arr)` — random Fisher-Yates for when no seed is provided

**Private helpers:**
- `findSlot(bracket, id)` — locate slot by string ID
- `advancePlayer(bracket, slotId, player)` — populate p1 then p2 in downstream slot
- `makeSlot(id, bracket, round, opts)` — create slot with all required fields defaulted
- `buildBracket(seededPlayers)` — generate full flat bracket array for size 4, 8, or 16
- `resolveByeSlots(bracket)` — auto-resolve W-R1 slots where p2 is null (bye)

**Exported interface (`module.exports`):**
- `id: 'kda'`, `name: 'Kegler des Abends'`
- `initState(players, config = {})` — validates 4–12 players, shuffles/seeds, builds bracket, resolves byes
- `applyThrow(state, player_id, value)` — deep-clones, validates, accumulates throws, resolves match on completion
- `isFinished(state)` — returns `state.done`
- `getFinalResults(state)` — collects all unique players from bracket, scores winner=0 / others=-1

### Bracket Structures Built

**4-player (size 4):** 5 slots — W-R1-1, W-R1-2, W-Final, L-Final, GF
**6-player (size 8, 2 byes):** 17 slots — same as 8-player with 2 W-R1 slots marked isBye=true
**8-player (size 8):** 17 slots — W-R1×4, W-R2×2, W-Semi, W-Final, L-R1×2, L-R2×2, L-R3, L-R4, L-R5, GF
**12-player (size 16, 4 byes):** 31 slots — 16-player structure with 4 W-R1 bye slots

### Key Implementation Details

**Bye resolution:** Only W-R1 slots can be byes (null padding only appears in initial seed positions). The `resolveByeSlots` function scans W-R1 slots only — if `p1` is set but `p2` is null (or vice versa), marks `isBye=true`, `done=true`, sets `winner`, and advances the winner to the downstream slot. Recursive chaining intentionally excluded (downstream slots are real matches waiting for two entrants).

**applyThrow flow:**
1. Deep-clone state (`JSON.parse(JSON.stringify(state))`)
2. Guard: `s.done` → return unchanged
3. Find active match: `!m.done && !m.isBye && m.p1 && m.p2 && player_id match`
4. Stray throw guard: no match found → return unchanged
5. Pin count validation: `typeof value !== 'number' || value < 0 || value > 9` → return unchanged
6. Record throw with sequential `throwIndex`
7. If `throws.length >= throwsRequired`: sum p1/p2 totals. Tie → extend `throwsRequired += 2`. Winner → set `done`, advance routing, check GF completion.

**Grand Final:** `throwsRequired: 4` set in `buildBracket`. Requires 2 throws per player. Higher total wins.

**Tiebreak:** `match.tiebreak = true`, `match.throwsRequired = req + 2`. Repeats until one player scores more. Supports indefinite tie rounds.

---

## Test Results

```
npm run test:games:
  tests 103
  pass  103
  fail  0

npm test (full suite):
  tests 391
  pass  391
  fail  0

node --test kegler-des-abends.test.js:
  tests 14
  pass  14
  fail  0
```

All 14 Wave 0 behavioral contract tests pass GREEN:
- C1: Module shape — PASS
- C2: initState returns state.bracket array, isFinished false — PASS
- C3: applyThrow immutability — PASS
- C4: Deterministic replay — PASS
- C5: getFinalResults exactly 1 winner — PASS
- KDA1: 4-player bracket >= 5 slots, all slots have required keys — PASS
- KDA2: 8-player GF slot exists, all W-R1 non-bye slots populated — PASS
- KDA3: 6-player has exactly 2 bye slots (done=true, winner set) — PASS
- KDA4: applyThrow accumulates without resolving after 1 throw — PASS
- KDA5: 2 throws → resolves winner, advances downstream slot — PASS
- KDA6: Tie → tiebreak=true, done=false, throwsRequired=4 — PASS
- KDA7: Grand Final 4-throw rule, state.gewinner set — PASS
- KDA8: Stray throw → state unchanged (deepEqual) — PASS
- KDA9: Player count validation throws for <4 or >12 — PASS

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] index.test.js KDA blocks used old engine interface**
- **Found during:** Task 2 (npm run test:games regression check)
- **Issue:** `index.test.js` tests I4 and I5 called `kda.initState` with a 2-player fixture and accessed `state.matches[0]` (old engine shape). New engine enforces 4-player minimum (D-12) and uses `state.bracket[]` not `state.matches[]`.
- **Fix:** Added `kdaPlayers` (4-player fixture) to `index.test.js`; updated I4 and I5 to use `kdaPlayers` for KDA key and `state.bracket.find()` for active match lookup in I5.
- **Files modified:** `server/game-types/index.test.js`
- **Commit:** 02a0e45

**2. [Rule 1 - Bug] Recursive bye resolution created phantom bye slots**
- **Found during:** Task 1 verification — KDA3 failed with "4 !== 2 bye slots"
- **Issue:** Initial `resolveByeSlots` implementation recursively marked any single-player slot as a bye, including W-R2/L-bracket slots that were waiting for their second player to arrive via routing. For 6 players, 2 W-R1 byes advanced players into W-Final and L-Final, which then got marked as byes too (total 4 byes instead of 2).
- **Fix:** Restricted bye detection to `round === 1 && bracket === 'W'` slots only. Downstream slots are real matches; they are never byes regardless of how many players have been seated.
- **Files modified:** `server/game-types/kegler-des-abends.js`
- **Commit:** 02a0e45 (fixed before commit)

---

## Known Stubs

None. The engine is fully functional. `getFinalResults` uses score=0 for winner and score=-1 for all others — this matches the existing pattern from the old engine and satisfies all 5 contract tests. Placement scoring (1st, 2nd, 3rd, etc. by bracket exit round) is out of scope for this plan.

---

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. The threat mitigations specified in the plan's `<threat_model>` are all implemented:

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-06-02-01 (pin count range) | Mitigated | `if (typeof value !== 'number' \|\| value < 0 \|\| value > 9) return s;` |
| T-06-02-02 (player_id in active match) | Mitigated | `const match = s.bracket.find(...)` + `if (!match) return s;` |
| T-06-02-03 (duplicate throw_index) | Accepted | UNIQUE constraint enforced at API layer (unchanged) |
| T-06-02-04 (throw for completed match) | Mitigated | `!m.done` in find() predicate — completed matches never matched |
| T-06-SC (package installs) | Accepted | Zero new packages |

---

## Self-Check: PASSED

- [x] `Claude/server/game-types/kegler-des-abends.js` exists with full DE engine implementation
- [x] `Claude/server/game-types/index.test.js` updated for new KDA interface
- [x] Commit 02a0e45 exists and contains both files
- [x] `npm run test:games` exits 0 with 103 passing (14 KDA + 89 others)
- [x] `npm test` exits 0 with 391 passing (no regressions)
- [x] All 14 KDA tests pass GREEN
- [x] `node -e "const k = require('./server/game-types/kegler-des-abends'); console.log(k.id, k.name)"` prints `kda Kegler des Abends`
- [x] `seededShuffle` copied verbatim (lines 5–25 match original exactly)
- [x] `initState` throws for <4 or >12 players (KDA9 verified)
- [x] No references to state.spieler, state.matches, state.mid, state.wRound in new engine
