# Phase 8: Statistiken & Rückblick — Research

**Researched:** 2026-05-27
**Domain:** SQLite analytics queries, vanilla JS UI extension, Express route design
**Confidence:** HIGH — entire codebase read directly; no external library research needed

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATS-01 | Year leaderboard: top players by wins per calendar year | SQL GROUP BY + strftime('%Y', finished_at); extend stats router |
| STATS-02 | Win streak (current + longest) per player | Requires ordered-game iteration in JS; cannot be done in pure SQL without window functions (SQLite 3.25+) |
| STATS-03 | Head-to-head breakdown between two selected players | SQL JOIN game_players self-join to find shared games; winner determined via reconstructState |
| STATS-04 | KDA award count per player (all-time) | Iterate all finished 'kda' games via reconstructState; same pattern as highlights.js |
| STATS-05 | BK loser count per player (all-time) | Iterate all finished 'bilderkegel' games via getBKLoserId pattern from highlights.js |
| RECAP-01 | Homepage recap: date + KDA winner + BK loser for last completed abend | New endpoint: GET /api/abende/last-summary — most recent abend with ended_at IS NOT NULL |
| RECAP-02 | Browse all games of last club evening with results and per-game winner | Same endpoint or sub-endpoint: include games[] array with reconstructed results |
</phase_requirements>

---

## Summary

Phase 8 is a pure extension phase — no new dependencies, no schema changes required. All computation happens either in SQL (simple aggregates) or via the existing `reconstructState` + `getFinalResults` pipeline already proven in `stats.js` and `highlights.js`.

The key design question is **where the award detection logic lives**. For STATS-04 (KDA count) and STATS-05 (BK loser count), the existing `highlights.js` already implements `getBKLoserId` and the KDA winner extraction pattern (`state.gewinner.id`). These functions can be extracted or imported so the stats routes reuse them without duplication.

Win streaks (STATS-02) require ordering all finished games chronologically per player and checking consecutive wins. SQLite 3.25+ has window functions (LAG/LEAD), but `better-sqlite3` on the project's Node 22 LTS stack supports them. However, the simpler and more maintainable approach is to pull the ordered game-result rows and compute streaks in JavaScript — the same approach used throughout `stats.js`.

**Primary recommendation:** Add five new sub-routes to `server/routes/stats.js` (year, streaks, h2h, kda-count, bk-count) and one new endpoint `GET /api/abende/last-summary` in `server/routes/abende.js`. Extend `renderStats()` in `index.html` to show the new data. Add a recap card to `renderSpiele()` (the homepage tab). No new files needed beyond the test file.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Year leaderboard data | API / Backend | — | SQL aggregate query in stats router |
| Win streak computation | API / Backend | — | JS loop over ordered DB rows in stats router |
| Head-to-head data | API / Backend | — | SQL self-join + reconstructState per shared game |
| KDA award count | API / Backend | — | Iterate kda games, apply reconstructState pattern |
| BK loser count | API / Backend | — | Iterate bilderkegel games, apply getBKLoserId |
| Last-evening recap | API / Backend | — | Query abende + games + reconstructState in abende router |
| Stats UI (leaderboard, streaks, h2h) | Browser / Client | — | Extend existing renderStats() vanilla JS |
| Homepage recap card | Browser / Client | — | Extend existing renderSpiele() — already fetches abende |
| Player profile awards display | Browser / Client | — | Extend showSpDetail() modal with new chip rows |

---

## Standard Stack

No new packages. All capabilities use existing dependencies.

| What | How | Source |
|------|-----|--------|
| DB queries | `db.prepare(...).all()` / `.get()` | `better-sqlite3` synchronous API |
| Game state | `reconstructState(game)` exported from `./games` | Already used in `stats.js` line 7 |
| KDA winner | `state.gewinner.id` | `kegler-des-abends.js` `getFinalResults` + `highlights.js` |
| BK loser | `getBKLoserId(state)` pattern from `highlights.js` | `highlights.js` lines 15-26 |
| HTTP routing | `Router()` from Express 4/5 | `app.js` pattern |
| Date filter | `strftime('%Y', finished_at)` | SQLite built-in |
| Frontend | Vanilla JS, existing CSS vars | `index.html` |
| Test framework | `node:test` + `node:assert/strict` | `package.json` `"test": "node --test"` |

**Installation:** none required.

---

## Package Legitimacy Audit

No new packages are installed in this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (index.html)
  renderSpiele()  ──────────── GET /api/abende/last-summary ──► abende.js (new handler)
                                                                    └─ query last ended abend
                                                                    └─ query games by abend_id
                                                                    └─ reconstructState per game
                                                                    └─ { abend, games[] }

  renderStats() ──────────────  GET /api/stats               ──► stats.js (existing)
  [enhanced]    ──────────────  GET /api/stats/year?year=Y   ──► stats.js (new sub-route)
                                GET /api/stats/streaks        ──► stats.js (new sub-route)
                                GET /api/stats/h2h?a=X&b=Y   ──► stats.js (new sub-route)
                                GET /api/stats/kda-counts     ──► stats.js (new sub-route)
                                GET /api/stats/bk-counts      ──► stats.js (new sub-route)
```

### Recommended Project Structure

```
server/routes/
├── stats.js          # extend with 5 new GET sub-routes
├── stats.test.js     # extend with new test cases
├── abende.js         # add GET /api/abende/last-summary handler
└── abende.test.js    # extend (or new test stubs)

public/
└── index.html        # extend renderStats(), showSpDetail(), renderSpiele()
```

No new files are needed on the server side beyond extending existing ones.

---

## Key Technical Findings

### Finding 1: KDA winner extraction pattern (STATS-04)

[VERIFIED: codebase read — highlights.js lines 40-58, kegler-des-abends.js getFinalResults]

```javascript
// From highlights.js — the canonical pattern
const kdaGame = db.prepare(
  "SELECT * FROM games WHERE type_key = 'kda' AND status = 'finished' ORDER BY finished_at DESC LIMIT 1"
).get();
const state = reconstructState(kdaGame);
if (state && state.gewinner && state.gewinner.id != null) {
  // state.gewinner.id is the winner's player_id
}
```

For STATS-04 (historical count), iterate ALL finished kda games:

```javascript
const kdaGames = db.prepare(
  "SELECT * FROM games WHERE type_key = 'kda' AND status = 'finished' ORDER BY finished_at ASC"
).all();
const kdaCounts = {};  // player_id → count
for (const game of kdaGames) {
  try {
    const state = reconstructState(game);
    if (state && state.gewinner && state.gewinner.id != null) {
      kdaCounts[state.gewinner.id] = (kdaCounts[state.gewinner.id] || 0) + 1;
    }
  } catch (e) { /* skip unresolvable games */ }
}
```

### Finding 2: BK loser extraction pattern (STATS-05)

[VERIFIED: codebase read — highlights.js lines 15-26]

`getBKLoserId(state)` is a private function inside `highlights.js`. For the stats route, either:
- Export it from `highlights.js` and import it in `stats.js`, or
- Inline the equivalent logic in `stats.js` (4 lines)

The inline approach avoids a coupling dependency. The logic is simple:

```javascript
function getBKLoserId(state) {
  if (!state || !state.players || !state.players.length) return null;
  const tots = state.players.map(p => ({
    id: p.id,
    total: (p.bildPts || []).reduce((a, b) => a + (b !== null ? b : 0), 0)
  }));
  const eligible = tots.filter(x => x.id !== (state.exemptPlayerId || null));
  const effTots = eligible.length > 0 ? eligible : tots;
  const minTot = Math.min(...effTots.map(t => t.total));
  const loser = effTots.find(t => t.total === minTot);
  return loser ? loser.id : null;
}
```

**Decision for planner:** Export `getBKLoserId` from `highlights.js` and require it in `stats.js`. This avoids duplicate logic.

### Finding 3: Year leaderboard (STATS-01)

[VERIFIED: codebase read — stats.js iterates finishedGames, games table has finished_at]

Year filter: `strftime('%Y', g.finished_at) = ?` where `?` is the year string (e.g., `'2026'`).

Win attribution requires `reconstructState` (same as existing stats route). The SQL cannot determine winners without game-type-specific logic, so the year leaderboard must iterate finished games for the requested year and apply `getFinalResults`.

```javascript
// GET /api/stats/year?year=2026
router.get('/year', (req, res) => {
  const year = String(req.query.year || new Date().getFullYear());
  const games = db.prepare(
    "SELECT * FROM games WHERE status = 'finished' AND strftime('%Y', finished_at) = ?"
  ).all(year);
  // ... same loop as existing stats GET /
});
```

Available years for the frontend year picker:

```javascript
const years = db.prepare(
  "SELECT DISTINCT strftime('%Y', finished_at) AS y FROM games WHERE status = 'finished' ORDER BY y DESC"
).all().map(r => r.y);
```

### Finding 4: Win streaks (STATS-02)

[VERIFIED: codebase read — games table, game_players, stats.js pattern]

Win streaks require per-player ordered game history. No pure-SQL streak computation without CTEs/window functions. The JS approach is cleaner and consistent with existing code style.

Algorithm:

```javascript
// Get all finished games ordered by finished_at ASC
// For each player, track: currentStreak, longestStreak, lastResult
const allGames = db.prepare(
  "SELECT * FROM games WHERE status = 'finished' ORDER BY finished_at ASC"
).all();

const streaks = {};  // player_id → { current, longest }

for (const game of allGames) {
  let results;
  try {
    const state = reconstructState(game);
    results = gameTypes[game.type_key].getFinalResults(state);
  } catch (e) { continue; }

  const winners = results.filter(r => r.winner);
  const isDraw = winners.length !== 1;

  for (const r of results) {
    if (!streaks[r.playerId]) streaks[r.playerId] = { current: 0, longest: 0 };
    const s = streaks[r.playerId];
    if (!isDraw && r.winner) {
      s.current++;
      if (s.current > s.longest) s.longest = s.current;
    } else {
      s.current = 0;  // loss or draw resets streak
    }
  }
}
```

**Streak definition clarification needed:** STATS-02 says "Win-Streak" without specifying game type scope. The safest default is ALL game types (any game win continues a streak, any loss or draw breaks it), consistent with the existing wins/losses in `GET /api/stats`. Flag this as an open question.

### Finding 5: Head-to-head (STATS-03)

[VERIFIED: codebase read — game_players table schema, games table]

Find games where both players participated:

```javascript
// GET /api/stats/h2h?a=1&b=2
const sharedGames = db.prepare(`
  SELECT g.* FROM games g
  JOIN game_players gpa ON gpa.game_id = g.id AND gpa.player_id = ?
  JOIN game_players gpb ON gpb.game_id = g.id AND gpb.player_id = ?
  WHERE g.status = 'finished'
  ORDER BY g.finished_at ASC
`).all(playerA, playerB);
```

Then for each shared game, call `reconstructState` + `getFinalResults` to determine who won. Count wins for A, wins for B, draws.

**Key nuance:** Multi-player games (e.g., 8 players, KDA tournament) are included. Whether the two players were ever in the same match slot does not matter for the leaderboard definition — what matters is: in a game where both participated, who won that game? This follows the same win attribution as the existing all-time stats.

### Finding 6: Last-evening recap (RECAP-01, RECAP-02)

[VERIFIED: codebase read — abende.js, games table has abend_id column (migration line 30)]

The "last club evening" is the most recently closed abend:

```javascript
// GET /api/abende/last-summary
const lastAbend = db.prepare(
  'SELECT * FROM abende WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1'
).get();
```

Games for that abend:

```javascript
const games = db.prepare(
  "SELECT * FROM games WHERE abend_id = ? AND status = 'finished' ORDER BY finished_at ASC"
).all(lastAbend.id);
```

For each game, apply `reconstructState` + `getFinalResults` and look up winner/loser names.

**RECAP-01:** The endpoint extracts the KDA winner and BK loser from the games of the last abend (not from the most recent game globally). This is different from `GET /api/highlights/current` which returns the globally most recent game. The plan must not confuse these two.

**RECAP-02:** Return `games[]` in the response with `{ type_key, finished_at, winner_id, winner_name, summary }` fields.

**Edge case:** Some abend games may have `abend_id = NULL` (games started before the abend migration). The frontend should handle an empty `games[]` gracefully. Also, an abend might have no KDA or no BK game — both should return `null` for those fields.

### Finding 7: API endpoint design

[VERIFIED: codebase read — app.js, stats.js, abende.js]

**For new stats sub-routes:** Add to `server/routes/stats.js` as `router.get('/year', ...)` etc. These are already mounted at `/api/stats` in `app.js` (line 66), so the URLs become:
- `GET /api/stats/year?year=2026`
- `GET /api/stats/streaks`
- `GET /api/stats/h2h?a=1&b=2`
- `GET /api/stats/kda-counts`
- `GET /api/stats/bk-counts`

No `app.js` change needed for these.

**For recap:** Add `GET /api/abende/last-summary` to `server/routes/abende.js`. Must be placed BEFORE the `GET /:id` route (same reason as the existing `GET /active` placement).

### Finding 8: Frontend integration points

[VERIFIED: codebase read — index.html lines 151-168, 651-652, 1612-1705]

Existing tab structure (5 tabs): `spiele`, `spielen`, `bib`, `spieler`, `stats`.

**No new tab needed.** Three integration points:

1. **`renderSpiele()`** (homepage, `pg-spiele` div, lines 744+): Add a "Letzter Abend" recap card at the top, after the active-abend banner. Fetch from `GET /api/abende/last-summary`.

2. **`renderStats()`** (`pg-stats`, lines 1612-1705): Currently shows per-player wins/losses/personal-bests. Extend with:
   - Year picker + year leaderboard table (fetch `/api/stats/year`)
   - Per-player streak display (from `/api/stats/streaks`, merged into the player card)
   - Head-to-head selector (two player dropdowns, fetch `/api/stats/h2h`)

3. **`showSpDetail(id)`** (player profile modal, line 652): Add two new chips:
   - "Kegler des Abends: X mal" (from `/api/stats/kda-counts`)
   - "BK Verlierer: X mal" (from `/api/stats/bk-counts`)

**Performance note:** The stats tab already fetches `/api/stats` on every `renderAll()` call. The new sub-routes are lazy (triggered by user interaction or explicit tab activation). Fetch `kda-counts` and `bk-counts` once and cache in the `S` state object, similar to how `S.spieler` and `S.typen` work.

### Finding 9: Player profile modal already fetches from S.spieler

[VERIFIED: codebase read — index.html line 652]

`showSpDetail(id)` reads from `S.spieler` which is populated at load. The award counts (KDA wins, BK losses) are NOT in `S.spieler` yet. Options:

A. Fetch `/api/stats/kda-counts` + `/api/stats/bk-counts` once when the stats tab loads, store in `S.kdaCounts` and `S.bkCounts`, then use in `showSpDetail`.
B. Fetch per-player on modal open (lazy, one HTTP call per open).

**Recommendation:** Option A — batch load on stats tab init, store in `S`. The counts are a small response (one number per player). Consistent with existing data loading pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BK loser detection | Custom loser logic | Extract `getBKLoserId` from `highlights.js` | Already handles exemptPlayerId, stechen edge cases |
| KDA winner detection | Custom winner lookup | `state.gewinner.id` pattern from highlights.js | Already handles all bracket sizes |
| Game state reconstruction | Custom throw replay | `reconstructState(game)` from `games.js` | Already handles meta, BK exemption chain, seed |
| Year filtering | Date-based query without SQLite | `strftime('%Y', finished_at)` | SQLite built-in, consistent with existing queries |
| Win/loss attribution | Custom logic | `getFinalResults(state)` + `winners.length !== 1` isDraw check | Handles VG draw (0 winners), multi-winner ties — lines 57-58 of stats.js |

---

## Common Pitfalls

### Pitfall 1: Confusing "last game" recap vs. "last abend" recap
**What goes wrong:** RECAP-01 says "last club evening" — not "most recent finished KDA game globally". The highlights endpoint (`GET /api/highlights/current`) already does "most recent game globally". The recap needs the KDA and BK games specifically within the most recent closed `abend`.
**Why it happens:** `highlights.js` already does something similar; it's tempting to reuse it.
**How to avoid:** Query `abende WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1`, then filter games by that abend's id.
**Warning signs:** Recap shows a KDA winner from a different evening than the displayed date.

### Pitfall 2: abend_id = NULL on old games
**What goes wrong:** Games created before the abend_id migration have `abend_id = NULL`. If the last abend was created right after the migration, its games may be sparse.
**Why it happens:** Migration added the column with default NULL; old games were not back-filled.
**How to avoid:** Filter `WHERE abend_id = ? AND status = 'finished'`. Handle empty `games[]` in frontend.

### Pitfall 3: BK exemption chain corrupts if stats iterates games out of order
**What goes wrong:** `reconstructState` for BK games looks up `payer_player_id` from the previous BK game (lines 355-362 of games.js). If BK games are iterated out of insertion order, the exemption chain may be wrong for intermediate states.
**Why it happens:** stats route iterates all BK games. If `ORDER BY finished_at ASC` is used (not `ORDER BY id ASC`), and two BK games have the same `finished_at`, the reconstruction order may differ from insertion order.
**How to avoid:** Use `ORDER BY id ASC` when iterating finished BK games for stats. This matches the reconstruction logic which queries `id < ? ORDER BY id DESC LIMIT 1`.

### Pitfall 4: Route ordering — `/year` before `/:id` in stats.js
**What goes wrong:** If a `router.get('/:param', ...)` route is added before the sub-routes, Express matches `/year`, `/streaks`, etc. as the `:param` value.
**Why it happens:** stats.js currently only has `router.get('/', ...)`. Adding a parameterised route is fine, but must come AFTER the named sub-routes.
**How to avoid:** Place all `router.get('/year', ...)`, `router.get('/streaks', ...)` etc. BEFORE any `router.get('/:id', ...)` if one is ever added. For now there is none — but add a comment.

### Pitfall 5: Streak definition across game types
**What goes wrong:** A player wins 3 DreiVollen in a row, then loses 1 BK — is their streak reset? If streak is "consecutive wins across all games", yes. If streak is "consecutive KDA wins", no.
**Why it happens:** STATS-02 says "Win-Streak" without qualifier.
**How to avoid:** Default to all-game-type streak (consistent with how wins/losses are counted in the existing stats). Document this choice in the plan.

### Pitfall 6: H2H in KDA tournament — "who won" vs. "who beat whom in a match"
**What goes wrong:** In a 4-player KDA game, player A may beat player B in the Winner bracket, but player B still wins the tournament. Head-to-head for "who won the game" shows B won; head-to-head for "who won their direct match" shows A won.
**Why it happens:** STATS-03 says "Siege/Niederlagen direkt gegeneinander" — implies direct match, but KDA bracket has multiple matches and only one winner.
**How to avoid:** Use game-level win attribution (getFinalResults winner) not bracket-match-level. This is simpler and consistent with the win counting in the rest of the stats. Document this choice.

---

## Code Examples

### GET /api/stats/year pattern
```javascript
// Source: codebase analysis — stats.js existing loop pattern
router.get('/year', (req, res) => {
  const year = String(req.query.year || new Date().getFullYear());
  const games = db.prepare(
    "SELECT * FROM games WHERE status = 'finished' AND strftime('%Y', finished_at) = ?"
  ).all(year);

  const winsMap = {};  // player_id → wins count
  for (const game of games) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) continue;
    let state, results;
    try {
      state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) { continue; }
    const winners = results.filter(r => r.winner);
    if (winners.length !== 1) continue;  // skip draws
    const w = winners[0];
    winsMap[w.playerId] = (winsMap[w.playerId] || 0) + 1;
  }

  const players = db.prepare('SELECT id, name, emoji FROM players WHERE archived = 0').all();
  const leaderboard = players
    .map(p => ({ ...p, wins: winsMap[p.id] || 0 }))
    .filter(p => p.wins > 0)
    .sort((a, b) => b.wins - a.wins);

  const availableYears = db.prepare(
    "SELECT DISTINCT strftime('%Y', finished_at) AS y FROM games WHERE status = 'finished' AND finished_at IS NOT NULL ORDER BY y DESC"
  ).all().map(r => r.y);

  res.json({ year, leaderboard, available_years: availableYears });
});
```

### GET /api/abende/last-summary pattern
```javascript
// Source: codebase analysis — abende.js + highlights.js patterns
router.get('/last-summary', (req, res) => {
  const lastAbend = db.prepare(
    'SELECT * FROM abende WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1'
  ).get();
  if (!lastAbend) return res.json(null);

  const abendGames = db.prepare(
    "SELECT * FROM games WHERE abend_id = ? AND status = 'finished' ORDER BY id ASC"
  ).all(lastAbend.id);

  let kda_champion = null;
  let bk_loser = null;
  const gamesSummary = [];

  for (const game of abendGames) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) continue;
    let state, results;
    try {
      state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) { continue; }

    // KDA winner
    if (game.type_key === 'kda' && state.gewinner && state.gewinner.id != null) {
      const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(state.gewinner.id);
      if (p) kda_champion = { id: p.id, name: p.name, emoji: p.emoji };
    }

    // BK loser
    if (game.type_key === 'bilderkegel') {
      const loserId = getBKLoserId(state);
      if (loserId != null) {
        const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(loserId);
        if (p) bk_loser = { id: p.id, name: p.name, emoji: p.emoji };
      }
    }

    // Per-game summary
    const winners = results.filter(r => r.winner);
    const winnerEntry = winners.length === 1 ? winners[0] : null;
    let winner_name = null;
    if (winnerEntry) {
      const wp = db.prepare('SELECT name FROM players WHERE id = ?').get(winnerEntry.playerId);
      if (wp) winner_name = wp.name;
    }
    gamesSummary.push({
      id: game.id,
      type_key: game.type_key,
      finished_at: game.finished_at,
      winner_name,
      player_count: results.length
    });
  }

  res.json({
    abend: { id: lastAbend.id, name: lastAbend.name, started_at: lastAbend.started_at, ended_at: lastAbend.ended_at },
    kda_champion,
    bk_loser,
    games: gamesSummary
  });
});
```

### Win streak computation
```javascript
// Source: codebase analysis — stats.js loop pattern extended
const allGames = db.prepare(
  "SELECT * FROM games WHERE status = 'finished' ORDER BY id ASC"
).all();
const streaks = {};  // player_id → { current, longest }

for (const game of allGames) {
  const gameModule = gameTypes[game.type_key];
  if (!gameModule) continue;
  let results;
  try {
    const state = reconstructState(game);
    results = gameModule.getFinalResults(state);
  } catch (e) { continue; }

  const winners = results.filter(r => r.winner);
  const isDraw = winners.length !== 1;

  for (const r of results) {
    if (!streaks[r.playerId]) streaks[r.playerId] = { current: 0, longest: 0 };
    const s = streaks[r.playerId];
    if (!isDraw && r.winner) {
      s.current++;
      if (s.current > s.longest) s.longest = s.current;
    } else {
      s.current = 0;
    }
  }
}
```

---

## State of the Art

No deprecations or major version changes relevant to this phase — it is pure vanilla JS + SQLite.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Win streak counts all game types (not KDA-only) | Finding 4, Pitfall 5 | Streak numbers would be different; easy to fix in SQL filter |
| A2 | H2H uses game-level win attribution, not bracket-match-level | Finding 5, Pitfall 6 | H2H results would differ for KDA games; requires bracket traversal |
| A3 | Recap shows last CLOSED abend (ended_at IS NOT NULL) | Finding 6 | Could miss the currently-active abend; but an open abend is not a "last evening" |

---

## Open Questions

1. **Streak scope (STATS-02)**
   - What we know: STATS-02 says "Win-Streak" without specifying game type
   - What's unclear: Is it "consecutive wins in any game" or "consecutive KDA wins"?
   - Recommendation: Use all-game-type streak (consistent with existing stats); add a filter parameter later if needed

2. **H2H scope (STATS-03)**
   - What we know: "Siege/Niederlagen direkt gegeneinander" — ambiguous for KDA tournament
   - What's unclear: Does a KDA game where A and B both played count as A-vs-B? Who "won"?
   - Recommendation: Use game-level win attribution (the tournament winner wins the game); document in plan

3. **Year leaderboard: include draws?**
   - What we know: STATS-01 says "Top-Spieler nach Siegen" — "Siege" = wins
   - What's unclear: Whether draws contribute fractionally or not at all
   - Recommendation: Count only clean wins (winners.length === 1); consistent with existing stats

4. **Player profile: where to show KDA/BK counts?**
   - What we know: `showSpDetail()` modal exists; `S.spieler` is populated from `/api/players` data
   - What's unclear: Whether kda-counts and bk-counts should be folded into `/api/stats` response or separate fetches
   - Recommendation: Add them to the existing `GET /api/stats` response (new fields `kda_wins` and `bk_losses` per player) to avoid an extra round-trip on player profile open

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies identified (pure server-side SQL + existing JS patterns).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` |
| Config file | none — discovery via `node --test` glob |
| Quick run command | `node --test server/routes/stats.test.js server/routes/abende.test.js` |
| Full suite command | `node --test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATS-01 | GET /api/stats/year returns leaderboard for a given year | unit/integration | `node --test server/routes/stats.test.js` | Partially (stats.test.js exists, new tests needed) |
| STATS-02 | GET /api/stats/streaks returns current + longest per player | unit/integration | `node --test server/routes/stats.test.js` | New test stubs needed |
| STATS-03 | GET /api/stats/h2h?a=X&b=Y returns wins/losses/draws | unit/integration | `node --test server/routes/stats.test.js` | New test stubs needed |
| STATS-04 | GET /api/stats/kda-counts returns KDA win count per player | unit/integration | `node --test server/routes/stats.test.js` | New test stubs needed |
| STATS-05 | GET /api/stats/bk-counts returns BK loser count per player | unit/integration | `node --test server/routes/stats.test.js` | New test stubs needed |
| RECAP-01 | GET /api/abende/last-summary returns abend + kda_champion + bk_loser | unit/integration | `node --test server/routes/abende.test.js` | New test stubs needed |
| RECAP-02 | GET /api/abende/last-summary returns games[] with per-game winner | unit/integration | `node --test server/routes/abende.test.js` | New test stubs needed |

Test patterns are already well established by `highlights.test.js` (insertFinishedKDAGame, insertFinishedBKGame helpers can be reused).

### Sampling Rate
- **Per task commit:** `node --test server/routes/stats.test.js server/routes/abende.test.js`
- **Per wave merge:** `node --test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New test stubs (RED) for STATS-01 through STATS-05 in `server/routes/stats.test.js`
- [ ] New test stubs (RED) for RECAP-01 and RECAP-02 in `server/routes/abende.test.js`
- [ ] Helper functions: `insertFinishedKDAGame` and `insertFinishedBKGame` can be copied from `highlights.test.js` into the stats test; or extracted to a shared fixture file

---

## Security Domain

No new authentication surface. All new endpoints are read-only and public (same as existing `/api/stats` and `/api/highlights/current` — TV screen needs them without session).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Read-only endpoints, no session required |
| V3 Session Management | No | No state change |
| V4 Access Control | No | Stats are not sensitive for this club app |
| V5 Input Validation | Yes | Validate `year` param (must be 4-digit integer), `a` and `b` params for h2h (must be positive integers) |
| V6 Cryptography | No | — |

Input validation for new query params:

```javascript
// /api/stats/year
const year = String(req.query.year || new Date().getFullYear());
if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: 'Invalid year' });

// /api/stats/h2h
const a = Number(req.query.a);
const b = Number(req.query.b);
if (!Number.isInteger(a) || a <= 0 || !Number.isInteger(b) || b <= 0) {
  return res.status(400).json({ error: 'a and b must be positive integers' });
}
```

---

## Sources

### Primary (HIGH confidence — codebase read)

All findings are derived from direct file reads of the production codebase. No external documentation consulted because no new dependencies are introduced.

- `server/routes/stats.js` — existing wins/losses loop, reconstructState pattern
- `server/routes/highlights.js` — getBKLoserId, KDA winner extraction, reconstructState usage
- `server/routes/games.js` — reconstructState implementation, BK exemption chain logic
- `server/routes/abende.js` — abende router patterns, route ordering (active before /:id)
- `server/db/index.js` — migrations array, idempotent try/catch pattern
- `server/db/schema.sql` — table definitions
- `server/app.js` — route registration, mount points
- `server/game-types/kegler-des-abends.js` — getFinalResults, state.gewinner
- `server/game-types/bilderkegel.js` — getFinalResults, exemptPlayerId, stechen
- `public/index.html` — tab structure, renderStats(), showSpDetail(), renderSpiele(), CSS vars
- `server/routes/highlights.test.js` — insertFinishedKDAGame, insertFinishedBKGame helpers
- `package.json` — test command: `node --test`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified from codebase
- Architecture: HIGH — all integration points confirmed by reading actual code
- SQL queries: HIGH — SQLite syntax confirmed by existing queries in codebase
- Pitfalls: HIGH — derived from actual code logic (BK exemption chain, route ordering)
- Frontend integration: HIGH — actual renderStats/showSpDetail code read

**Research date:** 2026-05-27
**Valid until:** 2026-07-01 (stable stack; only invalidated by schema changes)
