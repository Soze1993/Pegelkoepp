---
phase: quick-261010-j0y
plan: 01
subsystem: tv-mode
tags: [tv, ui, feedback-18, socket.io]
status: complete
key-files:
  modified: [public/tv.html, public/tv.js]
  created: [server/tv-game-name.test.js]
decisions:
  - "Game name lives in a fixed flex bar #tv-top-bar next to the highlights; name shrinks with ellipsis, highlights never shrink"
  - "Name source is the existing GAME_NAMES map; legacy centered header and its factory removed"
  - "KDA bracket reserves the same 6.5% top band as the other fixed renderers"
metrics:
  completed: 2026-10-10
actuals:
  tokens: 25000
  tasks: 2
  commits: 2
plan_head_before: 6b39e7c
plan_head_after: 8289e6fdbdf7ed031ebe505a81db35eb59db4440
---

# Quick 261010-j0y: Spielname oben links im TV-Modus

TV top row now shows the running game's display name (Bebas Neue caps, 2.6vw) at the left of a fixed flex bar `#tv-top-bar`, with the unchanged KDA-Gewinner / BK-Verlierer text at the right.

## Commits
- `4e9b4e1` Task 1 (tracer): top bar markup + CSS, `renderGameNameHdr`, call sites in `renderGame` / `renderIdle`, harness + tests B1-B5.
- `8289e6f` Task 2: removed `makeGameNameHeader` and its call sites, KDA bracket top band (`kdaTopPad`, `availH`), `#playerList` margin-top 2vw, comment rewording in `renderBilderkegelTV`, tests B6-B14.

## Verification
- `node --check public/tv.js` OK
- `node --test server/tv-game-name.test.js`: 14 tests, 14 pass, 0 fail. Task 1 RED run: B1/B2/B3/B5 failed, B4 passed; Task 2 RED run: B12/B13/B14 failed.

## Deviations from Plan
- None functional. The plan-commit ledger file (protocol 0c) was not created before the first commit; `plan_head_before` was taken from the known base HEAD 6b39e7c (verified: `git rev-list --count 6b39e7c..HEAD` = 2).
- `public/tv.js` line numbers had shifted from the sibling item; edits were located by identifier.

## Open manual checks (not performed)
Run `npm run dev`, open `/tv` at 1920x1080, start Bilderkegeln, Kegler des Abends (4+ players), Vier Gewinnt with a KDA-Gewinner and BK-Verlierer present. Expect: name top-left in caps on the same line as the highlights, switching without reload; both highlights fully visible left of the connection dot; KDA "Winner Bracket" label below the top row, no slot cut off; Vier Gewinnt shows the name once; idle screen shows no name.

## Known Stubs
None.

## Self-Check: PASSED
Files exist (public/tv.html, public/tv.js, server/tv-game-name.test.js); commits 4e9b4e1 and 8289e6f exist on feedback-14-18.
