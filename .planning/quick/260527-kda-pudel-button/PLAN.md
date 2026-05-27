---
slug: kda-pudel-button
date: 2026-05-27
status: in-progress
---

# Quick Task: KDA Pudel Button in Throw Modal

Add "P" / "0 (kein Pudel)" button pair to the KDA throw modal — matching kgrid() pattern used by all other games.

## Changes (public/index.html)

1. Add `kdaWurfKeinPudel = {}` next to `kdaWurfVals`
2. Reset `kdaWurfKeinPudel = {}` when opening modal
3. `renderKDAWurfBody`: 0 button → "P" with `kb pudel` class; selected = value===0 && !keinPudel; add "0 (kein Pudel)" button after grid
4. `kdaSelPin`: clear keinPudel for key when value !== 0 selected
5. Add `kdaSelKeinPudel(pid, tidx)` function
6. `submitKDAWurfe`: pass `{keinPudel:true}` meta when `kdaWurfKeinPudel[key]` is set
