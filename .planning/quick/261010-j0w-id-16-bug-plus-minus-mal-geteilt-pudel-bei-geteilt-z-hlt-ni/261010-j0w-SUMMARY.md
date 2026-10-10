---
phase: quick
plan: 261010-j0w
subsystem: game-types/plusMinus
tags: [bug, pudel, plus-minus-mal, feedback-16]
status: complete
key-files:
  modified:
    - server/game-types/plus-minus-mal.js
    - server/game-types/plus-minus-mal.test.js
    - server/routes/games.test.js
    - public/index.html
commits: 2
plan_head_before: a2d0c3e
plan_head_after: 6b39e7c44ebb93b067ba37a3c3af97a95f477172
actuals:
  tasks: 2
  commits: 2
---

# Quick 261010-j0w: Plus/Minus/Mal/Geteilt - Pudel auf W5 zaehlt als 9

A Pudel on the 5th throw (geteilt) now substitutes 9 (`PUDEL_SUB = [0, 0, 9, 1, 9]`), so it yields the same result as a thrown 9. The throw is still stored as value 0 with no meta in the throws table (Pudel stat counts it, 9er stat does not).

## Commits

- 7e03f29 fix: PUDEL_SUB W5 1 -> 9, tests P7-P10 (unit) and GT37 (HTTP + DB + rebuild)
- 6b39e7c fix: pmHint (round 5 now Pudel=9) and game description (W5=9) in public/index.html

## Tests

- Before the fix: GT37, P7, P8, P10 failed (wuerfe[4] was 1, score 24); P9 passed.
- `node --test server/game-types/plus-minus-mal.test.js server/routes/games.test.js`: 43 pass, 0 fail.
- `npm run test:games`: 130 pass, 0 fail.
- Task 2 automated check: "pmHint ok" plus grep for "W3=9, W4=1, W5=9" OK; `git diff --numstat` for public/index.html was 2/2.

## Deviations from Plan

None - plan executed as written.

## Follow-up outside this plan

- Deploy this fix BEFORE correcting Tino's data. With the fix live, changing his stored W5 throw from 9 to 0 (meta NULL) keeps his score identical and moves the throw from the 9er count to the Pudel count. Doing the DB edit before the deploy would change his score to divide-by-1.
- Finished Plus/Minus games on the VPS that contain a real W5 Pudel are re-scored with divide-by-9 from now on (replay-derived results); wins and personal bests of that game type may shift accordingly.
- Pre-existing, unrelated failing tests on the base revision: ST12 (stats.test.js) and HL13 (highlights.test.js).

## Self-Check: PASSED
