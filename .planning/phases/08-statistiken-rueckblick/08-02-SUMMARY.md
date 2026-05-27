---
phase: 08-statistiken-rueckblick
plan: 02
subsystem: api
tags: [stats, express, sqlite, better-sqlite3]

requires:
  - phase: 08-01
    provides: ST30..ST36 RED stubs in stats.test.js + test helpers insertFinishedKDAGame/insertFinishedBKGame

provides:
  - GET /api/stats/year — per-year win leaderboard with available_years list
  - GET /api/stats/streaks — per-player current/longest win streak map
  - GET /api/stats/h2h — head-to-head win/loss/draw counts between two players
  - GET /api/stats/kda-counts — per-player KDA tournament win count
  - GET /api/stats/bk-counts — per-player Bilderkegeln loser count
  - getBKLoserId exported as named property from highlights.js (reusable by abende.js in Plan 08-03)

affects: [08-03, frontend stats tab rendering]

tech-stack:
  added: []
  patterns:
    - "Iteration routes use ORDER BY id ASC (not finished_at) for BK exemption chain safety"
    - "Input validation applied before any DB access; parameterized binds as defense in depth"
    - "Named property export pattern: module.exports = router; module.exports.helper = fn (router is function/object hybrid)"

key-files:
  created: []
  modified:
    - server/routes/highlights.js
    - server/routes/stats.js

key-decisions:
  - "Export getBKLoserId as named property on module.exports (router) rather than destructured exports object — preserves backward compatibility with require('./highlights') returning the router"
  - "ORDER BY id ASC for all iteration routes — avoids tie-breaking ambiguity and matches BK exemption chain reconstruction order"
  - "h2h self-join uses id ASC not finished_at ASC per RESEARCH.md Pitfall 3"
  - "All 5 new routes are public (no requireSession) — parity with existing GET /api/stats root route (TV screen needs them)"

requirements-completed: [STATS-01, STATS-02, STATS-03, STATS-04, STATS-05]

duration: 12min
completed: 2026-05-27
---

# Phase 8 Plan 02: Statistiken Rueckblick Wave 1 Summary

**5 neue read-only Stats-Sub-Routen in stats.js plus getBKLoserId-Export aus highlights.js — ST30..ST36 von RED auf GREEN gedreht**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-27T14:00:00Z
- **Completed:** 2026-05-27T14:12:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `highlights.js` exportiert `getBKLoserId` als benannte Eigenschaft des Router-Exports; HL10..HL13 bleiben grün
- 5 neue GET-Routen in `stats.js` implementiert: /year, /streaks, /h2h, /kda-counts, /bk-counts — alle public (kein requireSession)
- ST30..ST36 von RED auf GREEN; ST10..ST22 unverändert grün; Gesamtsuite 430/432 grün (AB30..AB31 bleiben RED bis Plan 08-03)

## New Route Details

| Route | Path in stats.js | Response shape |
|-------|-----------------|----------------|
| /year | lines 167-213 | `{ year, leaderboard: [{id,name,emoji,wins}], available_years }` |
| /streaks | lines 220-258 | `{ [player_id]: { current, longest } }` |
| /h2h | lines 265-307 | `{ player_a, player_b, wins_a, wins_b, draws, total }` |
| /kda-counts | lines 314-331 | `{ [player_id]: count }` |
| /bk-counts | lines 338-356 | `{ [player_id]: count }` |

`module.exports.getBKLoserId = getBKLoserId` befindet sich in `highlights.js` Zeile 86.

## Task Commits

1. **Task 1: Export getBKLoserId from highlights.js** — `390526f` (feat)
2. **Task 2: Implement 5 new GET sub-routes in stats.js** — `08e58ed` (feat)

## Files Created/Modified

- `server/routes/highlights.js` — Zeile 86 hinzugefügt: `module.exports.getBKLoserId = getBKLoserId`
- `server/routes/stats.js` — Zeile 7: neuer Import `const { getBKLoserId } = require('./highlights')`; Zeilen 166-356: 5 neue Sub-Routen vor `module.exports = router;`

## Decisions Made

- Named-property-Export statt separatem `exports`-Objekt — Router bleibt Standardexport, Helper wird als Eigenschaft angehängt (Express-Muster)
- `ORDER BY id ASC` in allen Iteration-Routen — Konsistenz mit BK-Exemptions-Kette in `games.js`
- `/year` validiert mit `/^\d{4}$/.test(year)` vor DB-Zugriff; `/h2h` validiert mit `Number.isInteger && > 0` — beide auch mit parametrisierten Binds abgesichert

## Deviations from Plan

None — Plan exakt wie geschrieben ausgeführt.

## Issues Encountered

None.

## Test Results

```
node --test server/routes/highlights.test.js  → 4/4 pass (HL10..HL13)
node --test server/routes/stats.test.js       → 20/20 pass (ST10..ST22 + ST30..ST36)
node --test                                   → 430/432 pass (AB30..AB31 verbleiben RED bis Plan 08-03)
```

## Known Stubs

None — alle neuen Routen liefern echte DB-Daten.

## Threat Flags

Keine neuen Security-relevanten Surfaces jenseits des Plan-Threat-Models. Die Input-Validierungen aus T-08-02-T1 und T-08-02-T2 sind implementiert.

## Next Phase Readiness

Bereit für Plan 08-03: `abende.js` `GET /api/abende/last-summary` kann `getBKLoserId` per `require('./highlights').getBKLoserId` importieren. AB30..AB31 warten auf diese Implementierung.

## Self-Check: PASSED

- `server/routes/highlights.js` enthält `module.exports.getBKLoserId = getBKLoserId` ✓
- `server/routes/stats.js` enthält alle 5 neuen `router.get(...)` Handler ✓
- Commit `390526f` vorhanden ✓
- Commit `08e58ed` vorhanden ✓
- `node --test server/routes/stats.test.js` → 20/20 grün ✓

---
*Phase: 08-statistiken-rueckblick*
*Completed: 2026-05-27*
