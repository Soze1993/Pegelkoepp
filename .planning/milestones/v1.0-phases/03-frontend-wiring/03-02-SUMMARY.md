---
phase: 03-frontend-wiring
plan: 02
subsystem: frontend-shell
tags: [frontend, auth, socket-io, connection-dot, pin-overlay, winner-banner]
dependency_graph:
  requires:
    - 03-01 (GET /api/games with ?status filter)
    - 01-01 (GET /api/auth/status, POST /api/auth/login)
    - 01-02 (GET /api/players)
  provides:
    - public/index.html functional app shell
    - DOMContentLoaded auth gate
    - PIN overlay (showPINOverlay/submitPIN)
    - init() sequence (players + active game recovery + socket)
    - initSocket() with all game event handlers
    - Connection dot in topbar
    - Winner banner (showWinnerBanner/getWinnerName/handleGameFinished)
    - renderStats() placeholder
  affects:
    - public/index.html
tech_stack:
  added: []
  patterns:
    - DOMContentLoaded async auth gate (fetch /api/auth/status before any data load)
    - JS-injected PIN overlay (position:fixed;z-index:999, removed from DOM on success)
    - S.aktSpiel = { gameId, state, type_key } — server-authoritative game state
    - Socket.io room join after game start/resume
    - _finishing flag to prevent double winner banner (Pitfall 8)
    - Inline conn-dot (no position:fixed — topbar version)
key_files:
  created:
    - public/index.html
  modified: []
decisions:
  - "index.html created as full replacement of placeholder — not a patch of kegelclub_12.html"
  - "S object stripped to S.spieler=[], S.typen (static), S.aktSpiel=null — all per-game-type arrays removed"
  - "Game start functions (startVG, startFJ, etc.) are no-ops pending Wave 2 — they show notify() only"
  - "renderSpielenTab is a stub showing 'Wave 2' message — full implementation in 03-03"
  - "renderSpiele() shows empty state — API wiring deferred to 03-03 (Spiele history tab)"
  - "addSpieler() uses Date.now() as temporary ID — will be replaced with API call in 03-03"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  files_modified: 1
  tests_added: 0
  tests_total: 170
---

# Phase 03 Plan 02: index.html Foundation Summary

**One-liner:** public/index.html shell with DOMContentLoaded PIN auth gate, init() sequence (players + active game recovery), Socket.io client (connect/disconnect/game events), topbar connection dot, winner banner, and Statistik placeholder.

## Tasks Completed

| Task | Description | Commit | Result |
|------|-------------|--------|--------|
| 1 | Copy kegelclub_12.html → public/index.html with CSS/S-object/modal cleanup | ff791e5 | conn-dot, socket.io tag, cleaned S object, saveST/delST no-ops |
| 2 | Wire DOMContentLoaded auth gate, init(), showPINOverlay, initSocket, showWinnerBanner | ff791e5 | All 6 verification assertions pass |

Tasks 1 and 2 were committed together since they operate on the same file and were built atomically.

## What Was Built

### Task 1 — index.html from kegelclub_12.html (D-01, D-02, D-03, D-07)

Created `public/index.html` as a new file built on the `kegelclub_12.html` source with these structural modifications:

**Topbar:** Wrapped `<span id="tsub">Bereit</span>` in `display:flex;align-items:center;gap:8px` div alongside `<div class="conn-dot" id="connDot"></div>`.

**CSS:** Added `.conn-dot`, `.conn-dot.green`, `.conn-dot.red` rules inside the `<style>` block — without `position:fixed` (TV version is fixed-position; topbar version is inline).

**S object:** Stripped from 7 fields to 3:
- `S.spieler = []` (populated by init() from GET /api/players)
- `S.typen` (static list kept for Bibliothek tab and icon lookup)
- `S.aktSpiel = null` (becomes `{ gameId, state, type_key }` when active)
- Removed: `S.spiele`, `S.vgSpiele`, `S.fjSpiele`, `S.ankerSpiele`, `S.kdaSpiele`, `S.bkSpiele`, `S.aktVG`, `S.aktFJ`, `S.aktAnker`, `S.aktKDA`, `S.aktBK`, `S.nid`

**Disabled custom game type creator (D-03):** `saveST()` and `delST()` are no-ops (`function saveST(){return;}`). The "+ Neues Spiel" button is absent from `renderBib()` — header only contains the "Spielebibliothek" title.

**Socket.io script tag:** Added `<script src="/socket.io/socket.io.js"></script>` before the inline `<script>` block. `var socket = null;` declared at top of script.

**window.load:** Retained only the modal-close click handler wiring — removed `renderAll()` call (DOMContentLoaded + init() handles first render).

**Game render/start functions:** All retained as stubs for Wave 2 compatibility. Start functions show a `notify()` message. Render functions (`renderNSpiel`, `renderVGSpiel`, etc.) are empty stubs. `renderSpielenTab()` shows "Wave 2" placeholder. `renderSpiele()` shows empty state (API wiring in 03-03).

### Task 2 — Auth gate, init(), Socket.io, PIN overlay, winner banner (D-05, D-07, D-08, D-10, D-11, D-12)

All functions added to the `<script>` block in ES5 style:

**DOMContentLoaded:** Fetches `/api/auth/status`; shows PIN overlay if not authenticated, calls `await init()` otherwise.

**init():** Sequential async — fetch players → fetch active games → if active game, fetch detail and set `S.aktSpiel` + `showTab('spielen')` → `initSocket()` → `renderAll()`.

**showPINOverlay():** JS-injected `div#pin-overlay` (position:fixed;z-index:999) with centred 280px card, Bebas Neue "Anmelden" title, password input with Enter key handler, "Anmelden" button, hidden "Falscher PIN" error div.

**submitPIN():** POST /api/auth/login with JSON body; on success removes overlay and calls init(); on failure shows error div and clears/refocuses input.

**initSocket():** `socket = io()`, wires connDot green/red, handles `game:started` (set S.aktSpiel + join + showTab), `throw:applied` (update state + renderSpielenTab), `undo:applied` (same), `game:finished` (check _finishing flag + showWinnerBanner).

**joinGameRoom():** `socket.emit('join', gameId)` with null guard.

**getWinnerName():** Handles all 9 game types — kda (`state.gewinner.name`), fuchsjagd (`state.winner` + state.fuchs/sieger), viergewinnt (`state.winner` X/O/draw + tX/tO names), bilderkegel (`state.gewinner.name`), rest sort `state.players` by score (kleineHaus uses `hn()` sort).

**showWinnerBanner():** Sets `_finishing` flag, derives winner name, injects fixed overlay (rgba backdrop, z-index:500), gold-bordered card with trophy emoji and winner name in 32px Bebas Neue var(--ac); after 2500ms removes banner, sets `S.aktSpiel=null`, navigates to 'spiele', calls `renderAll()`.

**handleGameFinished():** Guards with `_finishing` flag before calling `showWinnerBanner()`.

**renderStats():** Single-line placeholder — `.empty` div with 📊 icon and "Demnächst" text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing guard] Player list filtered for archived status in modal renderers**
- **Found during:** Task 1 implementation
- **Issue:** `renderVGWahl`, `renderFJWahl`, `renderBKWahl`, `renderAnkerWahl`, `renderKDAWahl`, `startTyp` render player chips. The API returns all players including archived ones (`GET /api/players` returns all). Rendering archived players in selection modals violates the data contract (non-archived players only used, per 03-PLAN.md interfaces).
- **Fix:** Added `.filter(function(s){return !s.archived;})` in all modal player-chip renderers. `renderSpielerListe` does not filter (shows all players including archived for management purposes).
- **Files modified:** `public/index.html`
- **Commit:** ff791e5

**2. [Rule 1 - Bug] addSpieler() used S.nid which was removed from S object**
- **Found during:** Task 1 implementation
- **Issue:** The original `addSpieler()` used `S.nid++` for a local ID but `S.nid` was removed from the S object as part of the cleanup.
- **Fix:** Changed to `Date.now()` as a temporary local ID (consistent with no `S.nid`). This is a Wave 2 stub — `addSpieler()` will be replaced with `POST /api/players` in 03-03.
- **Files modified:** `public/index.html`
- **Commit:** ff791e5

**3. [Rule 1 - Bug] showSpDetail() would crash on players without legacy stats fields**
- **Found during:** Task 1 implementation
- **Issue:** Players loaded from `GET /api/players` only have `{ id, name, emoji, archived }` — no `spiele`, `siege`, etc. The original `showSpDetail()` accessed these directly without null guards.
- **Fix:** Added `(s.spiele||0)`, `(s.siege||0)`, `(s.niederlagen||0)` etc. guards throughout `renderSpielerListe` and `showSpDetail`. In-memory stats fields are Phase 4 concern.
- **Files modified:** `public/index.html`
- **Commit:** ff791e5

## Verification Results

```
node -e structural checks:
  conn-dot: PASS
  socket.io/socket.io.js: PASS
  S.spieler=[]: PASS (spieler:[] in S object)
  S.spiele not present: PASS
  DOMContentLoaded: PASS
  showPINOverlay: PASS
  initSocket: PASS
  showWinnerBanner: PASS
  api/auth/status: PASS
  api/games?status=active: PASS

node --test (full suite):
  tests 170, pass 170, fail 0
```

## Known Stubs

The following stubs exist intentionally — Wave 2 (03-03) will wire these:

| Stub | File | Line area | Reason |
|------|------|-----------|--------|
| `renderSpielenTab()` | public/index.html | ~line 260 | Shows "Wave 2" placeholder — full type_key dispatch in 03-03 |
| `renderSpiele()` | public/index.html | ~line 255 | Shows empty state — GET /api/games?status=finished wiring in 03-03 |
| `startVG/startFJ/startAnker/startKDA/startBK/startGenSpiel()` | public/index.html | various | Show notify() only — POST /api/games wiring in 03-03 |
| `doNWurf/doVGWurf/doFJWurf/doAnkerWurf/doBKWurf/kdaSetWinner()` | public/index.html | various | Show notify() only — POST /api/games/:id/throws wiring in 03-03 |
| `renderNSpiel/renderVGSpiel/renderFJSpiel/renderAnkerSpiel/renderBKSpiel/renderKDASpiel()` | public/index.html | various | Empty stubs — full render in 03-03 |
| `addSpieler()` | public/index.html | ~line 210 | Uses Date.now() as temp ID — POST /api/players wiring in 03-03 |

These stubs do not prevent the plan's goal (auth gate + init + socket infrastructure) from being achieved.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-03-04 through T-03-08). The `innerHTML` usage in `showWinnerBanner` and `showPINOverlay` is data-from-own-API only — server-authoritative, no user-controlled text interpolated.

## Self-Check: PASSED

- public/index.html: FOUND (537 lines, replaces 5-line placeholder)
- conn-dot CSS and HTML: FOUND
- socket.io script tag before inline script: FOUND
- S.spieler=[]: FOUND
- S.aktSpiel=null: FOUND (old per-type arrays absent)
- DOMContentLoaded async handler: FOUND
- showPINOverlay/submitPIN: FOUND
- initSocket() with all event handlers: FOUND
- showWinnerBanner/getWinnerName/handleGameFinished: FOUND
- renderStats() placeholder: FOUND
- saveST/delST no-ops: FOUND
- + Neues Spiel button absent from renderBib: FOUND
- Commit ff791e5: EXISTS in git log
- Full suite: 170 tests, 0 failures
