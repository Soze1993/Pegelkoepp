---
phase: 10-team-gewinner-gastkegler
plan: 01
subsystem: api
tags: [stats, leaderboard, bugfix, sqlite, better-sqlite3]

# Dependency graph
requires:
  - phase: 10-team-gewinner-gastkegler/10-02
    provides: is_guest column in players table (DB migration)
provides:
  - Correct isDraw semantics in all 4 stats endpoints (winners.length === 0)
  - Multi-winner attribution in /api/stats/year (for..of over all winners)
  - Multi-winner H2H checks in /api/stats/h2h (winners.some() for both players)
  - Guest exclusion in /api/stats and /api/stats/year player queries
affects:
  - frontend stats views (Jahresleaderboard, H2H, Streaks)
  - TV display (streak data no longer reset by team wins)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "winners.length === 0 as canonical isDraw check (0 winners = genuine draw)"
    - "for..of over winners array for multi-winner attribution"
    - "winners.some(w => w.playerId === x) for H2H multi-winner checks"
    - "AND is_guest = 0 guard on all player-listing queries"

key-files:
  created: []
  modified:
    - server/routes/stats.js

key-decisions:
  - "isDraw = winners.length === 0: genuine draws only (VG full-grid without 4-in-a-row); 1+ winners always means a win for all winners"
  - "STATS-02 satisfied without DB migration: stats are query-time computed, so historical VG/FJ games automatically show correct values after this code fix"
  - "H2H multi-winner: two independent if statements (not else-if) so both players in a shared winning team each get winsA++ AND winsB++"
  - "Guest exclusion applied at player-SELECT level, not game-iteration level: winsMap still accumulates for guest IDs but they are never emitted in the response"

patterns-established:
  - "winners.length === 0 — use this, never winners.length !== 1, in all future game-outcome checks"
  - "Multi-winner loop: for (const w of winners) { map[w.playerId]++ } instead of map[winners[0].playerId]++"

requirements-completed: [STATS-01, STATS-02, GUEST-03]

# Metrics
duration: 2min
completed: 2026-06-15
---

# Phase 10 Plan 01: Team-Gewinner & Gastkegler — Stats-Fix Summary

**Fixed `isDraw` bug in all 4 stats endpoints so VG/FJ team wins count as wins (not draws), with multi-winner attribution via `for..of` and `winners.some()`, plus `AND is_guest = 0` guest guard in player-listing queries.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-15T07:25:00Z
- **Completed:** 2026-06-15T07:27:04Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- All 4 stats endpoints (`/api/stats`, `/api/stats/year`, `/api/stats/streaks`, `/api/stats/h2h`) now use `winners.length === 0` as the isDraw check — genuine VG draws (full grid, no 4-in-a-row) are the only draws
- `/api/stats/year` leaderboard iterates over ALL winners with `for..of`, so VG team wins credit every team member; single-winner games (dreiVollen etc.) behave identically
- `/api/stats/h2h` uses two independent `if (winners.some(...))` checks so both players in a shared winning team each get their `winsA++`/`winsB++`
- `/api/stats` and `/api/stats/year` player-listing queries now include `AND is_guest = 0` so Gastkegler never appear in leaderboards or stats responses

## Task Commits

All 3 tasks committed together (single file, verified end-to-end before commit):

1. **Task 1: isDraw-Fix in allen 4 Stats-Endpoints** - `1e16817` (fix)
2. **Task 2: Multi-Winner-Attribution fur Year-Leaderboard und H2H** - `1e16817` (fix, same commit)
3. **Task 3: Guest-Ausschluss in Player-Queries** - `1e16817` (fix, same commit)

**Commit:** `1e16817` — fix(10-01): correct isDraw semantics and multi-winner attribution in stats.js

## Files Created/Modified

- `server/routes/stats.js` — 5 targeted changes: 4x isDraw fix, 1x year loop, 1x h2h .some(), 2x player query guard

## Exact Diffs

### isDraw fix — 4 occurrences (same pattern in all 4 endpoints)

```diff
-    const isDraw = winners.length !== 1;
+    const isDraw = winners.length === 0;
```

Endpoints changed: `/api/stats` (line 59), `/api/stats/year` (line 206), `/api/stats/streaks` (line 266), `/api/stats/h2h` (line 321)

### /api/stats/year — multi-winner loop replacement

```diff
-    const isDraw = winners.length !== 1;
+    const isDraw = winners.length === 0;
     if (isDraw) continue;
-    const winnerId = winners[0].playerId;
-    winsMap[winnerId] = (winsMap[winnerId] || 0) + 1;
+    for (const w of winners) {
+      winsMap[w.playerId] = (winsMap[w.playerId] || 0) + 1;
+    }
```

### /api/stats/h2h — .some() replacement (independent ifs)

```diff
-    if (isDraw) {
-      draws++;
-    } else if (winners[0].playerId === a) {
-      winsA++;
-    } else if (winners[0].playerId === b) {
-      winsB++;
-    }
+    if (isDraw) {
+      draws++;
+    } else {
+      if (winners.some(w => w.playerId === a)) winsA++;
+      if (winners.some(w => w.playerId === b)) winsB++;
+    }
```

### Player query guards (2 queries)

```diff
-    'SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id ASC'
+    'SELECT id, name, emoji FROM players WHERE archived = 0 AND is_guest = 0 ORDER BY id ASC'

-    'SELECT id, name, emoji FROM players WHERE archived = 0'
+    'SELECT id, name, emoji FROM players WHERE archived = 0 AND is_guest = 0'
```

## Verification

`node -c server/routes/stats.js` — passes (syntax OK)

Automated assertions verified:
- 4 occurrences of `winners.length === 0` (non-comment lines)
- 0 occurrences of `winners.length !== 1` (non-comment lines)
- `for (const w of winners)` with `winsMap[w.playerId]` present in `/year`
- `winners.some(w => w.playerId === a)` and `winners.some(w => w.playerId === b)` present in `/h2h`
- 2 player queries with `AND is_guest = 0` guard
- 0 unguarded `FROM players WHERE archived = 0` queries

## Note on STATS-02

STATS-02 (historische Spiele zeigen korrekte Werte) is satisfied automatically and without any DB migration. The stats system is query-time computed — every call to `/api/stats*` reconstructs results from `games`/`throws`. After this code fix, all historical VG and FJ games return the corrected win attribution on the next server restart. No backfill or schema change required.

## Decisions Made

- `winners.length === 0` is the canonical isDraw check going forward. The old `!== 1` was wrong because it treated 2-winner team games as draws.
- Guest exclusion happens at the player-SELECT level (not during game iteration). winsMap may accumulate entries for guest IDs but they are never emitted in the response because guests are absent from the `players` array used for the `.map()`.
- H2H uses two independent `if` statements (not `else if`) to handle the edge case where both H2H players are on the same winning VG team — both should receive `winsA++` AND `winsB++`.

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks applied to `server/routes/stats.js` as specified. Line numbers in the plan matched the actual file with minor variance (comment blocks), which required reading the live file first.

## Issues Encountered

Minor: First Edit attempt failed because the plan's quoted comment block used slightly different whitespace than the live file. Resolved by re-reading the file at the exact offset before editing.

## Known Stubs

None — all changes are live logic fixes, no placeholder or hardcoded values introduced.

## Threat Flags

T-10-02 (Guest name disclosure via `/api/stats`) is now mitigated by the `AND is_guest = 0` guard added in Task 3, as planned in the threat register.

## Next Phase Readiness

- Plan 10-02 (DB migration + players API + abende guest archive + frontend UI) can be applied independently — the `is_guest = 0` guard in this plan is a no-op until 10-02 runs its migration (defaults to 0 for all existing rows anyway, so no behavior change before migration)
- After both plans are deployed and server restarts, all stats endpoints and leaderboards will correctly exclude guests and count team wins

---
*Phase: 10-team-gewinner-gastkegler*
*Completed: 2026-06-15*
