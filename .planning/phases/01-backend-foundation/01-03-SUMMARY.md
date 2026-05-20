---
phase: 01-backend-foundation
plan: "03"
subsystem: game-types
tags:
  - game-logic
  - pure-functions
  - tdd
  - node
dependency_graph:
  requires:
    - 01-01
  provides:
    - server/game-types/index.js (gameTypes[type_key] lookup for Plan 04)
    - all 9 game-type pure modules
  affects:
    - 01-04 (games REST API consumes gameTypes[type_key])
    - phase-02 (Socket.io uses applyThrow for live scoring)
tech_stack:
  added: []
  patterns:
    - Deep-copy applyThrow (JSON.parse/stringify on every state transition)
    - TDD RED/GREEN/REFACTOR per module
    - Seeded LCG Fisher-Yates shuffle for deterministic tournament tests
    - Sequential formula evaluation (pmCalc) matching HTML operator order
key_files:
  created:
    - server/game-types/index.js
    - server/game-types/drei-vollen.js
    - server/game-types/drei-vollen.test.js
    - server/game-types/grosse-hausnummer.js
    - server/game-types/grosse-hausnummer.test.js
    - server/game-types/kleine-hausnummer.js
    - server/game-types/kleine-hausnummer.test.js
    - server/game-types/plus-minus-mal.js
    - server/game-types/plus-minus-mal.test.js
    - server/game-types/anker.js
    - server/game-types/anker.test.js
    - server/game-types/vier-gewinnt.js
    - server/game-types/vier-gewinnt.test.js
    - server/game-types/bilderkegel.js
    - server/game-types/bilderkegel.test.js
    - server/game-types/kegler-des-abends.js
    - server/game-types/kegler-des-abends.test.js
    - server/game-types/fuchsjagd.js
    - server/game-types/fuchsjagd.test.js
    - server/game-types/index.test.js
  modified: []
decisions:
  - "pmCalc formula is sequential operator evaluation, not standard math precedence: (w0+w1-w2)*w3/w4 — matches HTML source verbatim"
  - "KDA seeded shuffle extended to subsequent rounds (seed_rN per round) to ensure C4 replay determinism"
  - "Test expected values for plusMinus corrected to match HTML's sequential formula (not mathematical expression notation in plan docs)"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-20"
  tasks_completed: 3
  files_created: 20
---

# Phase 1 Plan 03: 9 Game-Type Pure-Function Modules — Summary

**One-liner:** All 9 Kegel game-type scoring rules extracted from kegelclub_12.html into pure-function Node.js modules with 100 passing TDD tests.

## What Was Built

### 20 files created under `server/game-types/`

| File | Lines | Purpose |
|------|-------|---------|
| `drei-vollen.js` | 42 | 3 throws/player, highest sum wins |
| `grosse-hausnummer.js` | 57 | h/z/e slots, score=h*100+z*10+e, highest wins, Pudel=0 |
| `kleine-hausnummer.js` | 64 | Same slots but Pudel=9, lowest valid score wins |
| `plus-minus-mal.js` | 64 | 5 rounds, sequential formula (w0+w1-w2)*w3/w4, PUDEL_SUB |
| `anker.js` | 63 | Up to 5 throws/round, ends at 40pts, configurable maxRunden |
| `vier-gewinnt.js` | 94 | 9x9 connect-4, check4 H/V/diagonal win detection + draw |
| `bilderkegel.js` | 82 | 5 pictures, 2 throws each, winner+payer flags |
| `kegler-des-abends.js` | 149 | Double-elimination tournament, seeded LCG shuffle |
| `fuchsjagd.js` | 109 | Fox vs hunters state machine (start→jagd phases) |
| `index.js` | 14 | Re-exports all 9 by type_key |
| 10 test files | ~1000 | 100 tests covering C1-C5 contract + game-specific |

### Test counts per module

| Module | Contract tests | Game-specific tests | Total |
|--------|---------------|--------------------:|------:|
| drei-vollen | C1-C5 | D1, D2, D3 | 8 |
| grosse-hausnummer | C1-C5 | G1, G2, G3, G4 | 9 |
| kleine-hausnummer | C1-C5 | K1, K2, K3 | 8 |
| plus-minus-mal | C1-C5 | P1, P2, P3, P4, P5 | 10 |
| anker | C1-C5 | A1, A2, A3, A4, A5, A6 | 11 |
| vier-gewinnt | C1-C5 | VG1-VG7 (+ 2 extra diag) | 16 |
| bilderkegel | C1-C5 | BK1-BK6 | 11 |
| kegler-des-abends | C1-C5 | KDA1-KDA6 | 11 |
| fuchsjagd | C1-C5 | FJ1-FJ6 (+ FJ3b) | 14 |
| index (integration) | I1-I5 | — | 5 |
| **Total** | | | **100** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expected values for plusMinus pmCalc corrected to match HTML**
- **Found during:** Task 1 GREEN phase
- **Issue:** Plan P2 docs stated `[5,3,2,4,1] => 5+3-2*4/1 = 0` (standard math precedence), but HTML code evaluates sequentially: `r=5; r+=3=8; r-=2=6; r*=4=24; r/=1=24`. The implementation matches HTML verbatim (source of truth).
- **Fix:** Corrected test expected values: P2 expects 24, P3 expects -4, C5/P5 winners swapped accordingly.
- **Files modified:** `server/game-types/plus-minus-mal.test.js`
- **Commit:** 5526408

**2. [Rule 2 - Missing critical functionality] KDA seeded shuffle extended to subsequent rounds**
- **Found during:** Task 2 GREEN phase — C4 determinism test failed for KDA
- **Issue:** Initial shuffle was seeded but subsequent round shuffles used `Math.random()`, making C4 replay test non-deterministic.
- **Fix:** Store `_seed` in KDA state; derive per-round seed as `seed_rN`; use seeded shuffle for all rounds when seed is present.
- **Files modified:** `server/game-types/kegler-des-abends.js`
- **Commit:** 7833d68

## Architecture Notes for Plan 04

### type_key → module lookup pattern
```javascript
const gameTypes = require('./game-types');
const mod = gameTypes[req.body.type_key]; // e.g. 'dreiVollen'
if (!mod) return res.status(400).json({ error: 'Unknown game type' });
const state = mod.initState(players);
const newState = mod.applyThrow(state, playerId, value, meta);
```

### Special applyThrow conventions
- `grosseHaus` / `kleineHaus`: require `meta = { slot: 'h'|'z'|'e' }` — reject if missing
- `kda`: `applyThrow(state, matchId, winnerId)` — matchId is the "playerId" parameter
- `viergewinnt`: `meta.pudel === true` for Pudel turn (no column placement)
- `anker`: values are 0,1,2,3,4,5,10 (Anker buckets) — NOT raw pin count

### Known module quirks (document in Plan 04 validation)
- `viergewinnt`: `nr[col] < 0` → column full → return 400
- `kda`: use `meta` or extra state for match context; `applyThrow` args are overloaded
- `fuchsjagd`: state machine phase drives whose throw it is — send playerId correctly

## Self-Check: PASSED

- `server/game-types/drei-vollen.js` — FOUND
- `server/game-types/fuchsjagd.js` — FOUND
- `server/game-types/vier-gewinnt.js` — FOUND
- `server/game-types/index.js` — FOUND
- Commit 5526408 — FOUND (feat(01-03): 5 sequential-throw modules)
- Commit 7833d68 — FOUND (feat(01-03): 4 complex game modules)
- Commit 4b490aa — FOUND (feat(01-03): index + integration test)
- 100/100 tests passing — VERIFIED
