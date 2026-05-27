---
slug: plusminus-tv-renderer
date: 2026-05-26
status: in-progress
---

# Plus-Minus-Mal TV Renderer

Add `renderPlusMinusTV(state)` to `Claude/public/tv.js` and wire into `renderGame` dispatcher.

## Changes

1. **tv.html**: Add `--red` and `--grn` CSS variables to `:root` (missing — existing code already uses them)
2. **tv.js**: Add `renderPlusMinusTV(state)` function after `renderHausnummerTV`
3. **tv.js**: Wire into `renderGame` dispatcher: `if (currentTypeKey === 'plusMinus') { renderPlusMinusTV(state); return; }`

## Layout spec

- 2-column CSS grid, up to 12 players
- Header: game name + "Runde X/5" or "Spiel beendet"
- Player rows sorted by running result (desc), active player highlighted
- Formula columns: W1 | +W2 | -W3 | ×W4 | ÷W5 | =result
- Operator colours: + #4caf7d, - #e05252, × #f59e0b, ÷ #5b8dee
- Empty slots show "—" in var(--brd)
- Active player: var(--ac) border + subtle glow
- Leader (done): result in var(--ac)

## Formula (left-to-right, matching server pmCalc)

result = W1; +W2; -W3; ×W4; ÷W5 (rounded to 2dp)
