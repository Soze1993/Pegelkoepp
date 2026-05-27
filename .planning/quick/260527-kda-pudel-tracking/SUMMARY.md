---
slug: kda-pudel-tracking
date: 2026-05-27
status: complete
commit: 5b45093
---

# Summary: KDA Pudel Tracking

Added Pudel tracking to Kegler des Abends, matching the pattern of all other game types.

## Changes
- `kegler-des-abends.js`: `pudelCounts: {}` in `initState`; `meta` param + pudel increment in `applyThrow`; `pudel` field in `getFinalResults`
- `kegler-des-abends.test.js`: KDA12 — tests pudel increment, keinPudel suppression, and pudel in getFinalResults

## Result
421/421 tests pass (+1 new test).
