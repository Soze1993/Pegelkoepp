---
slug: kda-tv-bracket-fix
date: 2026-05-27
status: in-progress
---

# Quick Task: KDA TV Bracket Fix (12 players)

Fix two layout bugs in renderKDABracket for the 16-player bracket (12 actual players):
1. L-R7 column cut off (W/L sections split 50/50 instead of proportionally)
2. Player names overflow slot boxes (font too large for narrow slots)

## Changes (public/tv.js)
1. Adaptive slotWidth/colGap from totalCols + window.innerWidth
2. W/L sections: flex:wColCount / flex:lColCount instead of flex:1
3. colGap passed to wRoundsRow/lRoundsRow gap
4. buildTVSlotEl: nameFontSize derived from slot width (w>=160→20px, w>=120→16px, else 13px)
