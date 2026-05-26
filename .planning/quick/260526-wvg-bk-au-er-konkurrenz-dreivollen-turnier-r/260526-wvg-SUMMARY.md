---
phase: quick-260526-wvg
plan: 01
subsystem: game-rules
tags: [bilderkegel, drei-vollen, stats, tv, exempt-player, tournament-record]
key-files:
  created: []
  modified:
    - server/game-types/bilderkegel.js
    - server/game-types/bilderkegel.test.js
    - server/game-types/drei-vollen.js
    - server/game-types/drei-vollen.test.js
    - server/routes/games.js
    - server/routes/highlights.js
    - server/routes/stats.js
    - server/routes/stats.test.js
    - public/tv.js
    - public/index.html
decisions:
  - BK exemptPlayerId server-derived from DB query of last finished BK game; any client-supplied value overwritten
  - top6Sum attached to all result entries (same value) rather than a separate field
  - stats response changed from bare array to {players:[...], tournament_records:{...}} with compat fallback in index.html
metrics:
  duration: ~25min
  completed: "2026-05-26"
  tasks: 4
  files: 10
---

# Quick Task 260526-WVG Summary

**One-liner:** BK Außer-Konkurrenz exempt player and DreiVollen Turnierergebnis top6Sum with all-time record in stats and TV/tablet display.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| T1 RED | BK exempt tests | 9d26a4c | bilderkegel.test.js |
| T1 GREEN | BK exempt impl | 8f890d5 | bilderkegel.js |
| T2 RED | DV top6Sum tests | ba96835 | drei-vollen.test.js |
| T2 GREEN | DV top6Sum impl | 2cb8201 | drei-vollen.js |
| T3 | BK exempt routing | 05d41da | games.js, highlights.js |
| T4 | Stats + frontend | 8dc55b2 | stats.js, stats.test.js, tv.js, index.html |

## What Was Built

### BK Außer Konkurrenz (Tasks 1+3)

- `bilderkegel.initState(players, config)` now accepts a `config` param; stores `state.exemptPlayerId = config.exemptPlayerId || null`
- `applyThrow`: when all 5 Bilder done, computes ties among `eligible = players.filter(p => p.id !== exemptPlayerId)` only — exempt player excluded from stechen
- `getFinalResults`: exempt player always gets `payer: false`; payer is the eligible player with minimum bkTotal (or stechen winner)
- `POST /api/games` for bilderkegel: queries last finished BK game, reconstructs state, extracts payer, passes as `config.exemptPlayerId` — overrides any client-supplied value (T-WVG-01 mitigation)
- `getBKLoserId` in highlights.js: filters eligible before finding minimum; fallback to all players if somehow all exempt

### DreiVollen Turnier-Rekord (Tasks 2+4)

- `dreiVollen.getFinalResults`: when `state.players.length >= 6`, computes `top6Sum = sum of top 6 scores` and attaches it to all result entries; absent for <6 players
- Works in both stechenSkipped and normal code paths
- `GET /api/stats`: second pass over finished dreiVollen games checks `results[0].top6Sum`; tracks best; returns `{ players: [...], tournament_records: { dreiVollen: { best_sum, game_id } | null } }`
- `public/tv.js` renderGame: after player list loop, appends `"Turnierergebnis: X Volle"` banner when `currentTypeKey === 'dreiVollen' && state.done && state.players.length >= 6`
- `public/index.html` renderNSpiel: adds `turHtml` with Turnierergebnis line between winner header and score table for dreiVollen done-state with >=6 players
- `renderStats` updated to consume `data.players` from new response shape (with compat fallback)

## Tests

- New tests: 12 (EX-1..EX-5, T6-1..T6-4, ST21, ST22)
- Total passing: 420 (was 408)
- TDD gate: RED commits before GREEN for T1 and T2

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None beyond what was already in the plan's threat model. T-WVG-01 (Tampering — client-supplied exemptPlayerId) is mitigated: server overwrites any client config.exemptPlayerId with DB-derived value for bilderkegel.

## Self-Check: PASSED

- bilderkegel.js: modified correctly (exemptPlayerId in initState, applyThrow, getFinalResults)
- drei-vollen.js: modified correctly (top6Sum in getFinalResults)
- games.js: BK exempt routing block added before initState call
- highlights.js: getBKLoserId filters eligible players
- stats.js: tournament_records second pass + changed res.json shape
- stats.test.js: all body→body.players updated; ST21/ST22 added
- tv.js: Turnierergebnis banner appended to gameEl
- index.html: renderStats uses statsData.players; renderNSpiel injects turHtml for dreiVollen done-state
- All commits exist: 9d26a4c, 8f890d5, ba96835, 2cb8201, 05d41da, 8dc55b2
- npm test: 420/420 pass
