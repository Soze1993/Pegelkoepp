---
slug: kda-pudel-button
date: 2026-05-27
status: complete
commit: a099fb2
---

# Summary: KDA Pudel Button

Added "P" (Pudel) and "0 (kein Pudel)" buttons to the KDA throw modal, matching the kgrid() pattern all other games use.

## Changes
- `public/index.html`: `kdaWurfKeinPudel` map; 0→"P" with pudel styling; "0 (kein Pudel)" button per throw slot; `kdaSelKeinPudel()` function; meta passed through `submitKDAWurfe`

## Result
421/421 tests pass. No regressions.
