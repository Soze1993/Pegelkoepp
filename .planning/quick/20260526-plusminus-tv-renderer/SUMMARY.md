---
slug: plusminus-tv-renderer
date: 2026-05-26
status: complete
commit: baf23c6
---

# Summary

Added `renderPlusMinusTV(state)` to `public/tv.js` and wired it into the `renderGame` dispatcher.

## What was done

- `tv.html`: added `--red`, `--grn`, `--blu` to `:root` (were missing; existing TV code already referenced them)
- `tv.js`: new `renderPlusMinusTV(state)` function — 2-column grid, formula columns W1/+W2/−W3/×W4/÷W5/=result
- `tv.js`: dispatcher line `if (currentTypeKey === 'plusMinus') { renderPlusMinusTV(state); return; }` after Hausnummer check

## Behaviour

- Players sorted by running pmCalcTV result (desc) — live leaderboard updates each throw
- Active player highlighted with `var(--ac)` border + glow
- Operator colours: `+` #4caf7d, `−` #e05252, `×` #f59e0b, `÷` #5b8dee
- Empty slots show `—` in `var(--brd)`; result shows `·` until first throw
- Leader's result turns gold (`var(--ac)`) when game is done
- Round indicator: "Runde X / 5" during play, "Spiel beendet" when done

## Tests

408 pass, 0 fail (no server-side changes).
