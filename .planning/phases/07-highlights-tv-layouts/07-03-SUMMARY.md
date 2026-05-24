---
phase: 07-highlights-tv-layouts
plan: 03
subsystem: ui
tags: [tv, socket.io, vanilla-js, bilderkegel, fuchsjagd, viergewinnt, kda, end-overlay, xss-safe]

# Dependency graph
requires:
  - phase: 07-02
    provides: typeKey on game:finished socket event payload, type_key on game:state event (TV reconnect caching)
  - phase: 06-turnierbaum
    provides: renderKDABracket full-screen takeover pattern and buildTVSlotEl DOM construction style used as implementation template
  - phase: 01-backend-foundation
    provides: tv.js base with renderGame dispatcher, renderIdle, socket handlers

provides:
  - currentTypeKey module-level variable in tv.js (caches game type across socket events)
  - renderEndOverlay(typeKey, state, lastWinner) — 10s full-screen amber/red overlay for KDA and BK game-end
  - renderBilderkegelTV(state) — player list with loser row (min bkTotal) highlighted in --red
  - renderFuchsjagdTV(state) — split Fuchs/Jaeger flex-row TV layout with fp running score
  - renderViergewinntTV(state) — Team X / VS / Team O TV layout with winner/loser opacity logic
  - bkTotal(p) and getBKLoserName(state) helpers for BK score derivation
  - Updated game:started, game:state, game:finished socket handlers that set currentTypeKey

affects:
  - 07-04 (tablet symbol injection — relies on same wave's backend; this plan is TV-only)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - currentTypeKey dispatch pattern: module-level variable cached from socket events drives renderGame branching
    - Full-screen takeover pattern extended to renderEndOverlay, renderBilderkegelTV, renderFuchsjagdTV, renderViergewinntTV (idleEl hide -> gameEl.classList.add('active') -> gameEl.replaceChildren)
    - textContent-only XSS guard throughout all new TV renderers (T-07-03-01 through T-07-03-04)
    - Loser guard: BK loser highlight only activates when aktBildIdx > 0 OR any bildPts entry is non-null (prevents false highlight at game start)

key-files:
  created: []
  modified:
    - Claude/public/tv.js

key-decisions:
  - "currentTypeKey is set from type_key (game:state) and type_key (game:started) — two different field names because game:started uses type_key and game:finished uses typeKey (camelCase); tv.js handles both"
  - "renderEndOverlay for unknown typeKey falls through to renderIdle after 3s (not 10s) — no overlay shown for unrecognized game types"
  - "BK loser highlight guard checks aktBildIdx > 0 OR any bildPts !== null so no row is falsely highlighted at game start when all scores are 0"
  - "renderViergewinntTV shows score as dash (—) because Viergewinnt state.tX/tO player objects carry no per-player throw totals in the current state shape"

patterns-established:
  - "currentTypeKey dispatch: set on game:started (type_key) and game:state (type_key) — read by renderGame before every render cycle; cleared implicitly when game:finished fires renderEndOverlay then renderIdle"

requirements-completed:
  - HIGHLIGHT-02
  - HIGHLIGHT-04
  - TV-01

# Metrics
duration: 20min
completed: 2026-05-24
---

# Phase 7 Plan 03: TV-Frontend — Overlays und Game-Type-Layouts (Wave 2A)

**currentTypeKey-Dispatch, 10-Sekunden-End-Overlay fuer KDA/BK und drei neue Spieltyp-TV-Layouts (Bilderkegel, Fuchsjagd, Viergewinnt) vollstaendig in tv.js implementiert**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-24T00:00:00Z
- **Completed:** 2026-05-24T00:20:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `currentTypeKey`-Variable und aktualisierte Socket-Handler: `game:started` und `game:state` cachen den Spieltyp, `game:finished` delegiert an `renderEndOverlay`
- `renderEndOverlay`: Vollbild-Overlay 10 Sekunden — KDA: amber 🏆 + Siegername, BK: rot 💩 + Verlierer-Name via `getBKLoserName`
- `renderBilderkegelTV`: Spielerliste mit Rot-Hervorhebung der Verliererzelle (niedrigstes `bkTotal`), Schutz gegen Frühstart-Highlight
- `renderFuchsjagdTV`: Fuchs/Jager-Split-Layout mit fp-Laufpunktzahl (72px Bebas Neue --ac) und Jager-Beitragsspalte
- `renderViergewinntTV`: Team-X-VS-Team-O-Layout mit Sieger-Glanz (Vollborder) und Verlierer-Opacity 0.6
- Alle neuen Renderer verwenden ausschliesslich `textContent` fuer DB-Strings (XSS-sicher, T-07-03-01 bis T-07-03-04)

## Task Commits

Jeder Task wurde atomar committed:

1. **Task 1: currentTypeKey, Socket-Handler, renderEndOverlay, bkTotal, getBKLoserName** - `4ba87d0` (feat)
2. **Task 2: renderGame-Dispatcher + renderBilderkegelTV, renderFuchsjagdTV, renderViergewinntTV** - `ae567a6` (feat)

## Files Created/Modified
- `Claude/public/tv.js` — Erweitert um ~300 Zeilen: currentTypeKey, aktualisierte Socket-Handler, bkTotal, getBKLoserName, renderEndOverlay, renderBilderkegelTV, renderFuchsjagdTV, renderViergewinntTV, drei neue Dispatcher-Zweige in renderGame

## Decisions Made
- `renderEndOverlay` fuer unbekannte Spieltypen faellt nach 3s in `renderIdle` (kein Overlay) — konsistent mit dem bisherigen Timeout-Verhalten vor diesem Plan
- BK-Verliererhighlight hat eine Startschutz-Bedingung (`aktBildIdx > 0 OR bildPts[i] !== null`), um falsche Rot-Hervorhebung am Spielanfang (alle Punkte 0) zu verhindern
- Viergewinnt-Spieler-Score zeigt `—` weil `state.tX`/`state.tO` keine Per-Spieler-Wurfzahlen enthalten; UI-SPEC bestaetigt dies: "show throw count as proxy or — until game ends"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
Keine.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — alle Renderer sind vollstaendig implementiert. Viergewinnt zeigt per-Spieler-Score als `—` (kein Stub — Viergewinnt-State haelt keine per-Spieler-Wurfzahlen, per UI-SPEC akzeptiertes Verhalten).

## Threat Flags
Keine neuen Bedrohungsflaechen — alle neuen Renderer verwenden `textContent` fuer DB-Strings. Das `currentTypeKey`-Feld stammt aus einem internen Server-DB-Wert (nicht Client-geliefert). Keine neuen Netzwerk-Endpunkte.

## Next Phase Readiness
- TV-Frontend vollstaendig: alle Spieltypen (Bilderkegel, Fuchsjagd, Viergewinnt, KDA) haben eigene TV-Layouts
- End-Game-Overlays fuer KDA und BK aktiv mit 10-Sekunden-Timeout und automatischem Uebergang in `renderIdle`
- Wave 2B (07-04) kann Tablet-Symbole (KDA-Sieger-Tropaee, BK-Verlierer-Emoji) in `index.html` implementieren

## Self-Check: PASSED
- `Claude/public/tv.js` existiert und enthaelt alle neuen Funktionen — GEFUNDEN
- `var currentTypeKey = null` in tv.js — VERIFIZIERT
- `renderEndOverlay` in tv.js — VERIFIZIERT
- `getBKLoserName` in tv.js — VERIFIZIERT
- `bkTotal` in tv.js — VERIFIZIERT
- `renderBilderkegelTV` in tv.js — VERIFIZIERT
- `renderFuchsjagdTV` in tv.js — VERIFIZIERT
- `renderViergewinntTV` in tv.js — VERIFIZIERT
- currentTypeKey-Dispatcher-Zweige in renderGame vor `!state.players`-Guard — VERIFIZIERT
- game:finished-Handler ruft nur renderEndOverlay auf (kein inline setTimeout) — VERIFIZIERT
- Commit 4ba87d0 existiert — VERIFIZIERT
- Commit ae567a6 existiert — VERIFIZIERT
- Vollstaendige Testsuite: 396/396 bestanden — VERIFIZIERT

---
*Phase: 07-highlights-tv-layouts*
*Completed: 2026-05-24*
