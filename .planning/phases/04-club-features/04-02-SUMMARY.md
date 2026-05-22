---
phase: 04-club-features
plan: 02
subsystem: frontend
tags: [vanilla-js, html, xss-guard, abend-session, stats, custom-types]

# Dependency graph
requires:
  - phase: 04-club-features
    plan: 01
    provides: GET/POST /api/abende, GET /api/stats, GET/POST/DELETE /api/game-types

provides:
  - Kegelabend session controls in Spiele tab (start button, amber banner, end flow)
  - Game history grouped by Abend name with "Ohne Abend" fallback
  - Stats tab with real player cards: wins/losses/pudel% chips + expandable personal bests
  - Bibliothek tab "Eigene Spieltypen" section with add modal and delete flow
affects: [frontend-ui, club-night-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - createElement/textContent for all DB-sourced strings (XSS guard T-04-07 through T-04-09)
    - DocumentFragment for batch DOM construction (renderSpiele, renderStats)
    - Async renderBib/renderStats with .catch(function(){}) in renderAll()
    - IIFE closure for delete button onclick binding in custom type card loop
    - Grouped game list: Object.keys(grouped).sort() by first game date descending

key-files:
  modified:
    - Claude/public/index.html
    - Claude/server/routes/games.js

key-decisions:
  - "DocumentFragment used in renderSpiele and renderStats to batch DOM appends — avoids intermediate innerHTML reflows"
  - "Custom type delete button uses IIFE closure (function(id){...})(typ.id) to capture loop variable correctly in ES5-style loop"
  - "renderBib appends static builtin HTML via innerHTML for trusted game type names/icons, then DOM-creates the custom section — hybrid approach balances performance and XSS safety"
  - "Group headers sorted by first game in group descending — newest abend shown first"
  - "Bug fix: GET /api/games was missing abend_id in SELECT — added to games.js so frontend grouping by session works end-to-end"

requirements-completed: [PERS-03, PERS-04, STAT-01, STAT-02, STAT-03]

# Metrics
duration: ~60min
completed: 2026-05-22
---

# Phase 4 Plan 02: Frontend UI Wiring for Club Features Summary

**Three Phase 4 UI features wired into public/index.html: Kegelabend session controls with amber banner and game grouping, real Stats tab with player cards and personal bests, and Bibliothek custom game type section with full CRUD — all DB-sourced strings set via textContent (XSS guard)**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-05-21
- **Completed:** 2026-05-22
- **Tasks:** 3 (2 implementation + 1 human-verify checkpoint — approved)
- **Files modified:** 2 (public/index.html + server/routes/games.js)

## Accomplishments

- Task 1: Added S.aktAbend state, .abend-banner CSS, #m-start-abend and #m-neu-typ modals, startAbend()/endAbend() functions, and completely rewrote renderSpiele() to show the session banner or start button and group finished games by Abend name header
- Task 2: Replaced renderStats() with async version fetching /api/stats and rendering per-player .uc cards with chips and expandable personal bests; replaced renderBib() with async version adding "Eigene Spieltypen" section; added addCustomTyp()/delCustomTyp() functions; updated renderAll() with .catch() wrappers on all async renders
- All 194 existing tests remain green after both tasks

## Task Commits

1. **Task 1: Abend session controls** — `223f381` (feat)
2. **Task 2: Stats tab + Bibliothek custom types** — `9620976` (feat)
3. **Bug fix: include abend_id in GET /api/games response** — `99a4031` (fix)

## Files Created/Modified

- `Claude/public/index.html` — All Phase 4 frontend features; additive changes only
- `Claude/server/routes/games.js` — Added abend_id to both SELECT statements so GET /api/games returns the field needed for frontend session grouping

**Key additions in Task 1:**
- `.abend-banner` CSS class (line 109)
- `S.aktAbend: null` in global state (line ~275)
- Active abend fetch in `init()` before renderAll()
- `openM()` cases for `m-start-abend` and `m-neu-typ`
- `#m-start-abend` modal HTML with name input and helper text
- `#m-neu-typ` modal HTML with name input and description textarea
- `startAbend()` — POST /api/abende, sets S.aktAbend, closes modal, re-renders
- `endAbend()` — confirm dialog, POST /api/abende/:id/end, clears S.aktAbend
- `renderSpiele()` — full rewrite with abend fetch, banner/start button, grouped games

**Key additions in Task 2:**
- `renderStats()` — async, fetches /api/stats, renders .uc cards with mkChip helper, personal bests toggle
- `renderBib()` — async, renders built-in types + custom types section with createElement
- `addCustomTyp()` — validates name, POST /api/game-types, handles 409 conflict
- `delCustomTyp(id)` — confirm, DELETE /api/game-types/:id, re-renders Bib
- `renderAll()` updated with .catch() on renderSpiele, renderBib, renderStats

## Decisions Made

**DocumentFragment for batch DOM construction**
renderSpiele() and renderStats() build the full DOM tree into a DocumentFragment before swapping el.innerHTML = '' and appending. This avoids intermediate repaint flicker and keeps the XSS-safe createElement pattern consistent.

**IIFE closure for delete button in custom type loop**
`(function(id){delBtn.onclick=function(){delCustomTyp(id);};})(typ.id)` captures the loop variable correctly in the ES5-style forEach — avoids all buttons sharing the last iteration's id.

**Hybrid innerHTML + createElement for renderBib**
Built-in type cards use innerHTML (trusted hardcoded values: icon emoji, name, desc from S.typen). Custom type section uses createElement + textContent exclusively for user-supplied DB strings. This satisfies T-04-07 without rewriting the entire built-in card renderer.

**Group headers sorted newest abend first**
abendIds are sorted by the first game's started_at in descending order — users see the most recent evening's games at the top.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GET /api/games missing abend_id in SELECT**
- **Found during:** Task 3 (human checkpoint verification)
- **Issue:** The frontend grouping logic keyed on `game.abend_id`, but the API response never included that field — the SELECT clause in games.js omitted it from both the main query and the count query. Grouping silently placed all games into "Ohne Abend" regardless of their actual session.
- **Fix:** Added `abend_id` to both SELECT statements in `Claude/server/routes/games.js`
- **Files modified:** Claude/server/routes/games.js
- **Verification:** Checkpoint reviewer confirmed grouping works correctly after fix; 194 tests continue to pass
- **Committed in:** 99a4031

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix was essential for the core session-grouping feature to function. No scope creep.

## Known Stubs

None — all data is fetched from real API endpoints. The Stats tab shows an empty state when no finished games exist, but that is intentional behavior, not a stub.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers (T-04-07 through T-04-09 are all mitigated via textContent/createElement throughout).

## Self-Check

- [x] `.abend-banner` CSS class present in `<style>` block (line 109)
- [x] `S.aktAbend: null` in var S = {...}
- [x] `#m-start-abend` modal in HTML (line 242)
- [x] `#m-neu-typ` modal in HTML (line 252)
- [x] `startAbend()` and `endAbend()` functions present
- [x] `renderSpiele()` fetches /api/abende/active and /api/abende; renders banner or start button; groups by abend_id
- [x] `renderStats()` is async, fetches /api/stats, renders .uc cards with chips and stbl personal bests
- [x] `renderBib()` is async, includes "Eigene Spieltypen" section with custom type cards
- [x] `addCustomTyp()` and `delCustomTyp()` present
- [x] `renderAll()` uses .catch(function(){}) on all async renders
- [x] No innerHTML with DB-sourced strings (abend name, player name, type name/desc all use textContent)
- [x] node --test: 194 tests, 0 failures (verified twice — after Task 1 and Task 2)
- [x] Commits exist: 223f381 (Task 1), 9620976 (Task 2), 99a4031 (bug fix)
- [x] games.js updated: abend_id included in GET /api/games SELECT
- [x] Checkpoint approved by human reviewer

## Self-Check: PASSED

---
*Phase: 04-club-features*
*Completed: 2026-05-22*
