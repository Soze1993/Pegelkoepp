---
slug: kda-pudel-tracking
date: 2026-05-27
status: in-progress
---

# Quick Task: KDA Pudel Tracking

Add Pudel tracking to Kegler des Abends — same pattern as Anker, DreiVollen, and other games.

## Changes

### `server/game-types/kegler-des-abends.js`
1. `initState`: add `pudelCounts: {}` to returned state
2. `applyThrow(state, player_id, value, meta)`: add `meta` param; when `value === 0 && !(meta && meta.keinPudel)` increment `pudelCounts[player_id]`
3. `getFinalResults`: include `pudel: state.pudelCounts[p.id] || 0` per player

### `server/game-types/kegler-des-abends.test.js`
- Add one test: throw value=0 increments pudel counter; meta.keinPudel suppresses it

## Success
- All existing KDA tests still pass
- New Pudel test passes
- `npm test` green
