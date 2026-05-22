---
phase: 03-frontend-wiring
plan: 03
subsystem: game-wiring
tags: [frontend, game-types, throw-api, render-functions, socket, csp, tv]
dependency_graph:
  requires:
    - 03-02 (auth gate, init, socket, connection dot)
    - 01-04 (POST /api/games, POST /api/games/:id/throws, POST /api/games/:id/undo)
    - 02-03 (throw:applied, undo:applied socket events)
    - 02-04 (TV display, game:finished)
  provides:
    - All 9 game types playable end-to-end through existing UI
    - All throws persisted to DB via API
    - TV updates live on every throw
    - Last winner shown on TV idle screen after game ends
completed: 2026-05-21
commits:
  - 11a01fe — feat(03-03): wire start functions, renderSpiele, renderSpielenTab switch (Wave 2 Task 1)
  - 65dd100 — feat(03-03): wire all throw/undo functions to API, update render functions
  - b1950b8 — fix(csp): allow unsafe-inline for index.html inline script and event handlers
  - 0ca69d0 — feat(03-03): implement all 6 render functions with server state adaptation
  - a4f5e8c — fix(socket): TV joins game room so throw:applied events are received
  - e95ca1a — fix(tv): show last winner name on idle screen after game:finished
---

# 03-03 Summary — Game Wiring Vertical Slice

## What Was Built

**Wave 2 Task 1 — Start functions + tab wiring:**
- All 6 start functions (`startDreiVollen`, `startGrosseHaus`, `startKleineHaus`, `startPlusMinus`, `startGenericSpiel`, `startVG`, `startFJ`, `startAnker`, `startKDA`, `startBK`) wired to `POST /api/games`
- `renderSpielenTab` replaced with `type_key` switch dispatching to `renderXxxSpiel(el, state)`
- `renderSpiele` replaced with async `GET /api/games?status=finished`
- `updSp()` made no-op (persistence now via API)

**Wave 2 Task 2 — Throw/undo wiring:**
- `submitThrow(playerId, throwIndex, value, meta)` and `submitUndo()` helpers
- `doNWurf`, `doVGWurf`, `doFJWurf`, `doAnkerWurf`, `doBKWurf`, `kdaSetWinner` all call `submitThrow`
- All abort/end functions reset `S.aktSpiel = null` and navigate to Spiele tab
- All `renderXxxSpiel` signatures updated to `(el, state)`

**Wave 2 Task 2 — Render function implementations:**
- All 6 render functions ported from `kegelclub_12.html` with server state adaptation:
  - `sp.spieler` → `sp.players` for BK, Normal, Anker
  - `sp.stid/stname/sticon` → `S.aktSpiel.type_key` + `S.typen` lookup for NSpiel
  - VG: `winner` is `'X'|'O'|'draw'` string; no throw log (not in server state)
  - FJ: `winner` is `'fuchs'|'jaeger'` string; no verlauf (not in server state)
  - BK: `winner`/`zahler` computed from `bkTotal` scores at done time
  - All back buttons: `S.aktXxx=null` → `S.aktSpiel=null`
- Selection functions (`nSelK`, `vgSelFn`, etc.) updated to call `renderSpielenTab()`

## Bugs Fixed During Verification

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| PIN overlay never shown | Helmet CSP blocked inline `<script>` and `onclick=` handlers | Added `'unsafe-inline'` to `script-src` and `script-src-attr` |
| TV not updating on throws | TV socket never joined `game:${gameId}` room when connected while idle | Added server `join` handler; TV emits `join` on `game:state`/`game:started` |
| TV idle shows no winner | `game:finished` handler called `renderIdle(null)` | Server computes winner via `getFinalResults`, passes `lastWinner` in event |

## State Shape Adaptations (server vs old local state)

| Game type | Key difference |
|-----------|---------------|
| All generic (dreiVollen, grosseHaus, kleineHaus, plusMinus) | `state.players` not `sp.spieler`; type info via `S.aktSpiel.type_key` |
| Vier Gewinnt | `winner: 'X'|'O'|'draw'|null` (string, not player obj); no `w` throw log |
| Fuchsjagd | `winner: 'fuchs'|'jaeger'|null` (string); no `verlauf` array |
| Anker | `state.players` not `sp.spieler` |
| KDA | Same field names as old local state |
| Bilderkegel | `state.players` not `sp.spieler`; winner/zahler computed at done time |

## Verification Results (human checkpoint)

1. PIN overlay shown in incognito — PASS
2. Correct PIN loads app with players from DB, green conn dot — PASS
3. Mid-game refresh restores active game — PASS
4. Spiele tab shows finished games from server — PASS
5. Multiple game types end-to-end (Drei in die Vollen, Vier Gewinnt, Fuchsjagd) — PASS
6. Undo mid-game — PASS
7. TV idle transition after game:finished (3s) — PASS
8. TV idle shows last winner name — PASS
9. `node --test` 170 passing — PASS
