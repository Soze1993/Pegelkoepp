---
phase: 08-statistiken-rueckblick
plan: 01
subsystem: testing
tags: [node-test, tdd, red-phase, sqlite, stats, abende]

requires:
  - phase: 07-highlights-tv-layouts
    provides: insertFinishedKDAGame and insertFinishedBKGame helpers in highlights.test.js (copied verbatim)

provides:
  - RED test stubs ST30..ST36 in server/routes/stats.test.js (year, streaks, h2h, kda-counts, bk-counts)
  - RED test stubs AB30..AB32 in server/routes/abende.test.js (last-summary endpoint)
  - finishedAt-aware insertFinishedGame helper in stats.test.js
  - insertFinishedKDAGame and insertFinishedBKGame helpers in stats.test.js and abende.test.js
  - insertClosedAbend and linkGameToAbend helpers in abende.test.js

affects:
  - 08-02-PLAN (Wave 1 GREEN — must implement stats sub-routes to pass ST30..ST36)
  - 08-03-PLAN (Wave 1 GREEN — must implement /api/abende/last-summary to pass AB30..AB32)

tech-stack:
  added: []
  patterns:
    - "RED-stub pattern: test blocks that assert HTTP shapes against routes not yet implemented — fail with 404, not harness errors"
    - "insertFinishedKDAGame: drives KDA tournament to completion via kda.applyThrow loop with String(gameId) seed"
    - "insertFinishedBKGame: drives BK game to completion, p1=9 wins, p2=1 loses"
    - "insertClosedAbend + linkGameToAbend: create closed abend fixtures and associate games via UPDATE games SET abend_id"

key-files:
  created: []
  modified:
    - server/routes/stats.test.js
    - server/routes/abende.test.js

key-decisions:
  - "Copied insertFinishedGame with finishedAt param from highlights.test.js verbatim to replace the no-param version in stats.test.js — needed for year sub-route tests to control finished_at"
  - "clearCache list in abende.test.js extended with ./highlights, ./games, ../game-types/index — required because Wave 1 abende.js will import these modules"
  - "AB30 relies on seed() not creating closed abende (verified: seed inserts only players, no abende rows with ended_at)"

patterns-established:
  - "RED-stub comment header: // --- / // STxx: description / // Status: RED — route does not exist yet"
  - "insertClosedAbend(name, endedAt) inserts with started_at = datetime('now', '-2 hours')"
  - "linkGameToAbend(gameId, abendId) runs UPDATE games SET abend_id = ? WHERE id = ?"

requirements-completed: [STATS-01, STATS-02, STATS-03, STATS-04, STATS-05, RECAP-01, RECAP-02]

duration: 12min
completed: 2026-05-27
---

# Phase 8 Plan 01: Statistiken & Rückblick — RED Stubs Summary

**10 RED test stubs (ST30..ST36 + AB30..AB32) locking in HTTP contracts for Phase 8 stats and recap routes before any implementation exists**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-27T00:00:00Z
- **Completed:** 2026-05-27
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- stats.test.js: insertFinishedGame aufgewertet (finishedAt-Parameter), insertFinishedKDAGame und insertFinishedBKGame verbatim aus highlights.test.js kopiert, 7 neue Testblöcke ST30..ST36 angehängt
- abende.test.js: clearCache-Listen um 3 Einträge erweitert (./highlights, ./games, ../game-types/index), alle 5 Helpers hinzugefügt (insertPlayer, insertFinishedGame, insertFinishedKDAGame, insertFinishedBKGame, insertClosedAbend, linkGameToAbend), 3 neue Testblöcke AB30..AB32 angehängt
- node --test Ergebnis: 29 tests, 19 pass, 10 fail — alle Fehler sind 404 (Routen nicht implementiert), keine Harness-Fehler

## Task Commits

1. **Task 1 + Task 2: RED stubs ST30..ST36 + AB30..AB32** - `02ba7e1` (test)

## Files Created/Modified

- `server/routes/stats.test.js` — insertFinishedGame mit finishedAt, KDA/BK-Helpers, ST30..ST36 RED stubs
- `server/routes/abende.test.js` — clearCache erweitert, alle Helpers, AB30..AB32 RED stubs

## Test IDs Added

| ID | Beschreibung | Fehlerart |
|----|-------------|-----------|
| ST30 | GET /api/stats/year?year=abc → 400 | 404 (Route fehlt) |
| ST31 | GET /api/stats/year?year=2026 → Leaderboard mit Sieger | 404 (Route fehlt) |
| ST32 | GET /api/stats/streaks → current+longest Streak | 404 (Route fehlt) |
| ST33 | GET /api/stats/h2h?a=X&b=Y → H2H Shape | 404 (Route fehlt) |
| ST34 | GET /api/stats/h2h?a=0&b=-1 → 400 | 404 (Route fehlt) |
| ST35 | GET /api/stats/kda-counts → Sieger-Count | 404 (Route fehlt) |
| ST36 | GET /api/stats/bk-counts → Verlierer-Count | 404 (Route fehlt) |
| AB30 | GET /api/abende/last-summary → null (kein Abend) | 404 (Route fehlt) |
| AB31 | GET /api/abende/last-summary → vollständige Struktur | 404 (Route fehlt) |
| AB32 | GET /api/abende/last-summary → leerer Abend (null champion/loser) | 404 (Route fehlt) |

## node --test Ausgabe (Zusammenfassung)

```
ℹ tests 29
ℹ pass 19
ℹ fail 10
ℹ duration_ms 1063.4053
```

## Decisions Made

- insertFinishedGame in stats.test.js durch die finishedAt-fähige Version aus highlights.test.js ersetzt, damit ST31 (Jahr-Subroute) das Datum kontrollieren kann
- clearCache in abende.test.js proaktiv um highlights/games/game-types/index erweitert, weil Wave 1 abende.js diese importieren wird

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RED-Phase vollständig: alle 10 Vertragstest-Stubs vorhanden
- Bereit für 08-02 (Wave 1 GREEN: stats sub-routes) und 08-03 (Wave 1 GREEN: abende last-summary)
- Helpers insertFinishedKDAGame und insertFinishedBKGame stehen in beiden Test-Dateien zur Verfügung

## Self-Check

- [x] `server/routes/stats.test.js` existiert und enthält ST30..ST36
- [x] `server/routes/abende.test.js` existiert und enthält AB30..AB32
- [x] Commit `02ba7e1` existiert
- [x] 10 neue Tests schlagen fehl (404, kein Harness-Fehler)
- [x] 19 bestehende Tests (ST10..ST22 + AB01..AB06) bestehen weiterhin

## Self-Check: PASSED

---
*Phase: 08-statistiken-rueckblick*
*Completed: 2026-05-27*
