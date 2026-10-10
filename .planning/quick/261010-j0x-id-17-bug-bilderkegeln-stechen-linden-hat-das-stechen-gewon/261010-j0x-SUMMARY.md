---
phase: quick
plan: 261010-j0x
quick_id: 261010-j0x
subsystem: bilderkegel
tags: [bug, bilderkegel, stechen, loser, tv, tablet]
status: complete
commits: 3
plan_head_before: 8289e6fdbdf7ed031ebe505a81db35eb59db4440
plan_head_after: 70db67411941ec4dbd21b92b578f862efc2d16cf
actuals:
  tasks: 3
  commits: 3
key-files:
  modified:
    - server/game-types/bilderkegel.js
    - server/game-types/bilderkegel.test.js
    - server/routes/highlights.js
    - server/routes/games.test.js
    - public/tv.js
    - public/index.html
  created:
    - server/game-types/bilderkegel.frontend.test.js
---

# Quick 261010-j0x: ID 17 Bilderkegeln Stechen-Gewinner wurde als Verlierer gezeigt

**One-liner:** Das Spielmodul entscheidet den BK-Verlierer einmal (`state.loserId`, Stechen-Verlierer wenn der letzte Platz gleich stand); Server-Helper, TV und Tablet lesen dieses Feld statt es aus den Summen neu zu raten.

## Commits

| Task | Commit | Inhalt |
|------|--------|--------|
| 1 | df6451d | `loserId` im BK-State, `getLoserId`-Export, `getBKLoserId` delegiert, Tests BK-L1..L6 + GT38 |
| 2 | 7b9d997 | tv.js: `bkLoserId`, `bkRowMarks`, `getBKLoserName`; Kontrakttest FE-TV1..6 |
| 3 | 70db674 | index.html: `bkLoserId`, `renderBKSpiel` zahlt-Tag/-Box, Titeltraeger-Refresh vor `_finishing`-Guard; FE-TAB1..4 |

## Verification

- `node --test server/game-types/bilderkegel.test.js server/game-types/bilderkegel.frontend.test.js server/routes/games.test.js server/routes/abende.test.js`: 75 pass, 0 fail
- `node --test --test-name-pattern="HL1[0-2]" server/routes/highlights.test.js`: 3 pass
- `node --test --test-name-pattern="ST36" server/routes/stats.test.js`: 1 pass
- `node --test server/tv-game-name.test.js`: 14 pass (sibling item 261010-j0y still green)
- `node --check public/tv.js`: ok
- ST12 (stats.test.js) fails unchanged (pre-existing, out of scope). HL13 passed when run by name in isolation here (plan baseline listed it as failing; not touched).
- games.js, abende.js, stats.js unchanged; no DB migration or data fix (past evenings corrected by replay).

## Deviations from Plan

**1. [Numbering] End-to-end test is GT38, not GT37.** Sibling item 261010-j0w already added a route test named GT37 in server/routes/games.test.js. The new test is `GT38`. Content as specified in the plan (players 10/11/12, restart in the middle of the Stechen, all five API surfaces).

**2. [Test detail] FE-TAB4 matches the guard as `_finishing) return`** rather than the bare word, because the explanatory comment added in the handler also contains `_finishing`.

**3. [Plan vs. code] The throws endpoint returns `{ state, finished }`** (plan assumed the same; no change needed).

Otherwise executed as written. Edits to public/tv.js and public/index.html were located by identifier (sibling item j0y had shifted lines); CRLF line endings of both files preserved.

## Open manual checks (not performed)

- Visual: BK with two players, equal totals, seat-first player throws higher in the Stechen. Expected: TV banner and red row, tablet "zahlt!" box, TV ticker "BK-Verlierer" and tablet BK-loser symbol all name the SECOND player.
- During a running Stechen the TV marks only the remaining candidates and highlights the next Stechen thrower.
- Tablet that submitted the final throw: BK-loser symbol / "Aktuelle Titeltraeger" card update without reload.

## Accepted finding

T-261010-j0x-05: existing `innerHTML` interpolation of winner/payer name and emoji in `renderBKSpiel` (public/index.html) is pre-existing, neither introduced nor widened here. File-wide hardening (textContent) is a separate item.

## Known Stubs

None.

## Self-Check: PASSED

Commits df6451d, 7b9d997, 70db674 present; all listed files exist.
