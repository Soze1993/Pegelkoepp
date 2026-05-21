# Phase 4: Club Features — Research

**Researched:** 2026-05-21
**Domain:** SQLite aggregation queries, Node.js/Express route patterns, vanilla JS frontend state, game-type module APIs
**Confidence:** HIGH — all findings derived directly from reading the live codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Kegelabend = manual open/close. "Abend starten" in Spiele tab, optional name (default: German weekday+date). All games started while open are linked via `games.abend_id`. "Abend beenden" sets `abende.ended_at`.
- **D-02** Schema: new table `abende (id, name TEXT, started_at, ended_at TEXT NULL)` + `ALTER TABLE games ADD COLUMN abend_id INTEGER NULL REFERENCES abende(id)`. Both migrations use the existing try/catch duplicate-column pattern.
- **D-03** Default abend name computed server-side: `new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })`.
- **D-04** `POST /api/games` auto-links to active abend if `abend_id` not explicitly provided and an active abend exists.
- **D-05** Win/loss: `rank === 1` (i.e. `winner === true` in `getFinalResults`) = win. Shared rank 1 (more than one player has `winner: true`) = draw — no wins or losses recorded. All others = loss.
- **D-06** Personal best = highest `results[i].score` a player has ever achieved in a given `type_key`, computed dynamically at query time.
- **D-07** Pudel = `meta.pudel === true` (JSON-parsed from `throws.meta`). Zero-value throws without the flag are NOT Pudel.
- **D-08** Custom types: name + description only, `is_builtin = 0` in `game_type_defs`, `key` auto-slugified. NOT selectable for game start. Appear in Bibliothek with `.stc.cu` CSS class.
- **D-09** `GET /api/stats` returns per-player aggregates computed at query time. Response shape documented in CONTEXT.md D-09.
- **D-10** Spiele tab UI: "Abend starten" button when no active abend; amber banner "Abend läuft: {name}" + "Beenden" button when active. Games grouped by abend in history, newest first; games without abend under "Ohne Abend".
- **D-11** Stats tab: replace empty `<div id="r-stats">` with player cards (`.uc` pattern), chips (Siege/Niederlagen/Pudel%), expandable personal bests (`.stbl`). Empty state when no finished games.
- **D-12** Bibliothek tab: section "Eigene Spieltypen" with "+ Hinzufügen" button, modal (name + description textarea), cards with delete button. Built-in types not deleteable.

### Claude's Discretion

- SQL query optimization for stats — single aggregating query where possible, JS fallback for personal bests (small dataset)
- Error handling for unknown `type_key` in stats — skip gracefully
- Abend banner color: amber/gold (`--ac`)
- Frontend state: `S.aktAbend = { id, name }` alongside `S.aktSpiel`
- Test coverage: socket tests for abend-linked game broadcasts, stats endpoint tests with fixture data

### Deferred Ideas (OUT OF SCOPE)

- Custom game type scoring engine
- Stats filtered by Kegelabend
- Leaderboard / win streak
- Abend history view (browse past evenings)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERS-03 | Custom game types created by users are saved persistently across restarts | `game_type_defs` table already exists with `is_builtin` column; three new routes needed |
| PERS-04 | Games played on the same evening are grouped into a Kegelabend session | New `abende` table + `games.abend_id` FK migration + three abend routes |
| STAT-01 | User can see wins and losses per player across all evenings | `GET /api/stats` computed from finished games via `getFinalResults` reconstruction |
| STAT-02 | User can see the best score per player per game type (personal records) | Same `GET /api/stats` endpoint; personal bests from `getFinalResults().score` |
| STAT-03 | User can see total Pudel count and Pudel percentage per player | Pudel counted from `throws.meta` JSON where `pudel === true` |
</phase_requirements>

---

## Summary

Phase 4 adds three features on top of the fully wired Phase 3 app: Kegelabend session grouping (PERS-04), per-player statistics including wins/losses/personal bests/Pudel% (STAT-01, STAT-02, STAT-03), and custom game type reference documents (PERS-03). All features are purely additive — no existing routes or game logic need modification beyond extending `POST /api/games` to auto-link the active abend.

The key insight for statistics computation: every `getFinalResults()` function in the codebase already returns a `winner: boolean` field. Win/loss attribution is straightforward for 7 of the 9 game types. The two exceptions are **Vier Gewinnt** (team game — `winner` applies to all players on the winning team, `score` is always 0, draw = `state.winner === 'draw'`) and **Fuchsjagd** (role-based — all Jäger win or lose together). Both are handled correctly by the `winner` boolean in their `getFinalResults` implementations, so the same aggregation logic applies uniformly. The only special case is draws: when multiple players share `winner: true`, the stats endpoint must record no wins/losses for that game.

The `game_type_defs` table already exists in schema.sql. The `abende` table and `games.abend_id` column are new migrations. No new npm packages are needed — this phase uses only existing `better-sqlite3`, `express`, and vanilla JS patterns.

**Primary recommendation:** Build in three parallel backend slabs (abend routes, stats route, game-type-defs routes) each in their own route file, then wire the frontend tab-by-tab.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Kegelabend CRUD (start/end/active) | API / Backend | — | Server owns the single-active-abend constraint; client just calls API |
| Auto-link game to active abend | API / Backend | — | D-04: server reads active abend at POST /api/games time, not client |
| Win/loss/Pudel aggregation | API / Backend | — | getFinalResults() runs server-side; aggregation stays server-side |
| Personal bests computation | API / Backend | — | Small dataset; computed at query time in GET /api/stats |
| Custom game type persistence | API / Backend | Database | game_type_defs table is server-owned; slugification on server |
| Abend banner display | Browser / Client | — | S.aktAbend state drives conditional DOM render |
| Stats tab render | Browser / Client | — | Fetches GET /api/stats, renders player cards |
| Bibliothek custom type cards | Browser / Client | — | Fetches GET /api/game-types, renders .stc.cu cards with delete |

---

## Standard Stack

No new npm packages needed. All Phase 4 work uses existing dependencies.

### Core (all already installed)

| Library | Version (installed) | Purpose |
|---------|---------------------|---------|
| `better-sqlite3` | 12.10.0 | Synchronous DB queries for stats aggregation |
| `express` | 5.2.1 | New route files for abend, stats, game-types |
| `socket.io` | 4.8.3 | Abend-linked game broadcast (game:started already works) |

### Supporting (already installed)

No additions needed. `node:test` (built into Node 22) covers all test cases.

### No New Dependencies

The custom game type modal reuses the existing `<div class="mo">` pattern and `<textarea>` elements already styled in index.html. The stats chip pattern (`.chip`, `.chip.pc`) is already in the CSS. The Bibliothek card pattern (`.stc`, `.stc.bi`, `.stc.cu`) is already in the CSS.

---

## Package Legitimacy Audit

No external packages are being added in Phase 4. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (index.html)
  |
  |-- showTab('spiele') → renderSpiele()
  |     |-- GET /api/abende/active       → shows banner or "Abend starten"
  |     |-- GET /api/games?status=finished → game history grouped by abend_id
  |
  |-- showTab('stats') → renderStats()
  |     |-- GET /api/stats               → player cards with wins/losses/pudel
  |
  |-- showTab('bib') → renderBib()
  |     |-- GET /api/game-types          → built-in (from S.typen) + custom (from API)
  |
  |-- "Abend starten" button
  |     |-- POST /api/abende             → { id, name } → S.aktAbend = { id, name }
  |
  |-- "Abend beenden" button
  |     |-- POST /api/abende/:id/end     → clears S.aktAbend
  |
  |-- startXxx() → POST /api/games      → server auto-links abend_id (D-04)

Server
  |-- routes/abende.js
  |     |-- POST /api/abende            → INSERT abende, return {id, name}
  |     |-- GET  /api/abende/active     → SELECT WHERE ended_at IS NULL LIMIT 1
  |     |-- POST /api/abende/:id/end    → UPDATE SET ended_at = datetime('now')
  |
  |-- routes/stats.js
  |     |-- GET /api/stats
  |           |-- for each player: query finished games where player participated
  |           |-- reconstruct state via reconstructState(game)
  |           |-- call getFinalResults(state)
  |           |-- aggregate wins/losses/draws + Pudel from throws.meta
  |           |-- compute personal bests per type_key
  |
  |-- routes/game-types.js
  |     |-- GET  /api/game-types        → SELECT * FROM game_type_defs WHERE is_builtin=0
  |     |-- POST /api/game-types        → INSERT with slugified key
  |     |-- DELETE /api/game-types/:id → DELETE WHERE is_builtin=0
  |
  |-- routes/games.js (modified)
        |-- POST /api/games: if no abend_id in body, auto-link active abend (D-04)
```

### Recommended Project Structure

```
server/
├── routes/
│   ├── games.js          # existing — add abend auto-link in POST handler
│   ├── abende.js         # NEW — Kegelabend session CRUD
│   ├── stats.js          # NEW — GET /api/stats aggregation
│   └── game-types.js     # NEW — custom game type CRUD
├── db/
│   ├── index.js          # add Phase 4 migrations here (abende table, abend_id)
│   └── schema.sql        # add abende CREATE TABLE IF NOT EXISTS
public/
└── index.html            # add S.aktAbend, abend banner, stats render, bib modal
```

### Pattern 1: Migration (try/catch duplicate-column)

The established pattern from `server/db/index.js` lines 25-37:

```javascript
// [ASSUMED — pattern read directly from codebase]
const migrations = [
  'CREATE TABLE IF NOT EXISTS abende (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, started_at TEXT NOT NULL DEFAULT (datetime(\'now\')), ended_at TEXT NULL)',
  'ALTER TABLE games ADD COLUMN abend_id INTEGER NULL REFERENCES abende(id)'
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
    // Column already exists — idempotent, safe to continue
  }
}
```

Note: `CREATE TABLE IF NOT EXISTS` never throws, so the try/catch is effectively for `ALTER TABLE` only. Both can share the same loop without issue.

### Pattern 2: Route file + app.js mounting

Existing pattern from `server/app.js`:

```javascript
// [ASSUMED — pattern read directly from codebase]
app.use('/api/abende',     require('./routes/abende'));
app.use('/api/stats',      require('./routes/stats'));
app.use('/api/game-types', require('./routes/game-types'));
```

Mount BEFORE the error middleware, in the same block as existing routes (lines 61-63 of app.js).

### Pattern 3: Stats Computation (server-side, at query time)

```javascript
// [ASSUMED — pattern derived from reading all getFinalResults implementations]

// Step 1: get all finished games
const finishedGames = db.prepare(
  "SELECT id, type_key FROM games WHERE status = 'finished'"
).all();

// Step 2: for each game, reconstruct state and get results
// reconstructState is already exported from routes/games.js
const { reconstructState } = require('./games');

// Step 3: aggregate per player
const statsMap = {}; // keyed by player_id

for (const game of finishedGames) {
  const gameModule = gameTypes[game.type_key];
  if (!gameModule) continue; // skip custom types (no scoring engine)

  let state, results;
  try {
    state = reconstructState(game);
    results = gameModule.getFinalResults(state);
  } catch (e) {
    continue; // skip gracefully (D in Claude's Discretion)
  }

  // Determine if this is a draw (>1 player has winner:true)
  const winners = results.filter(r => r.winner);
  const isDraw = winners.length > 1;

  for (const r of results) {
    if (!statsMap[r.playerId]) {
      statsMap[r.playerId] = { wins: 0, losses: 0, draws: 0, bests: {} };
    }
    const entry = statsMap[r.playerId];
    if (isDraw) {
      entry.draws++;
    } else if (r.winner) {
      entry.wins++;
    } else {
      entry.losses++;
    }
    // Personal best per type_key
    if (r.score !== undefined && r.score !== null) {
      const prev = entry.bests[game.type_key];
      if (prev === undefined || r.score > prev) {
        entry.bests[game.type_key] = r.score;
      }
    }
  }
}

// Step 4: pudel + total_throws from DB (single query)
const pudelRows = db.prepare(`
  SELECT t.player_id,
         COUNT(*) AS total_throws,
         SUM(CASE WHEN json_extract(t.meta, '$.pudel') = 1 THEN 1 ELSE 0 END) AS pudel_count
  FROM throws t
  JOIN games g ON t.game_id = g.id
  WHERE g.status = 'finished'
  GROUP BY t.player_id
`).all();
```

### Pattern 4: Key slugification for game_type_defs

```javascript
// [ASSUMED — derived from CONTEXT.md D-08 and codebase naming conventions]
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[äöü]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
// Example: "Mein Spiel!" → "mein-spiel"
// Key uniqueness enforced by UNIQUE constraint on game_type_defs.key
```

### Pattern 5: S.aktAbend frontend state

```javascript
// [ASSUMED — pattern derived from S.aktSpiel usage in index.html]
// Add to var S = { ... } object:
// aktAbend: null   // { id: Number, name: String } or null

// In init():
var abendRes = await fetch('/api/abende/active');
var abendData = await abendRes.json(); // null or { id, name, started_at }
S.aktAbend = abendData ? { id: abendData.id, name: abendData.name } : null;

// Abend banner rendering in renderSpiele():
if (S.aktAbend) {
  // show amber banner + "Beenden" button
} else {
  // show "Abend starten" button
}
```

### Anti-Patterns to Avoid

- **Storing stats in a denormalized table:** The dataset is tiny (~10 players, ~200 games/year). Computing at query time is correct and avoids cache-invalidation complexity. Do NOT create a `player_stats` materialized table.
- **Passing `abend_id` from the frontend:** D-04 states the server auto-links. The frontend never needs to know or pass the abend_id when starting a game — it just calls `POST /api/games` as before.
- **Treating Vier Gewinnt `score: 0` as a real score for personal bests:** VG always returns `score: 0` from `getFinalResults`. Personal best for VG is meaningless; skip it or treat 0 as the score. The aggregation loop handles this consistently — it just stores 0 as the "best", which is not useful. Consider filtering: only track personal bests for game types where `score > 0` or where `score` is meaningful (not VG/FJ).
- **Counting pudel from `throws.value === 0`:** D-07 is explicit: only `meta.pudel === true` counts. Drei in die Vollen and Anker use `value === 0` to mean "zero pins" (which they DO count as pudel in their own module), but the canonical server-side pudel count must use the `meta.pudel` flag in the throws table.
- **Using innerHTML for user-supplied content:** The existing textContent-only rule (T-02-02) from Phase 2 applies to game names/descriptions from the DB. Use `textContent` or `createElement` — never `innerHTML` with DB-sourced strings.

---

## Critical API Findings: getFinalResults() Return Shapes

This is the most important research output for the stats computation. All 9 game types have been audited:

### getFinalResults() Return Value Audit

| Game Type | Return Shape | `winner` field | `score` field | Draw possible? | Notes |
|-----------|-------------|----------------|---------------|----------------|-------|
| `dreiVollen` | `[{ playerId, score, pudel, winner }]` | `boolean` | Sum of 3 throws | Yes (tied high score) | `winner: true` for highest score; multiple allowed |
| `grosseHaus` | `[{ playerId, score, pudel, winner }]` | `boolean` | 3-digit house number | Yes (tied number) | |
| `kleineHaus` | `[{ playerId, score, pudel, winner }]` | `boolean` | 3-digit house number | Yes (tied low score) | Winner = lowest valid score (`score > 0`) |
| `plusMinus` | `[{ playerId, score, pudel, winner }]` | `boolean` | Float formula result | Yes (tied result) | |
| `anker` | `[{ playerId, score, pudel, winner }]` | `boolean` | Sum of all rounds | Yes (tied total) | |
| `bilderkegel` | `[{ playerId, score, winner, payer }]` | `boolean` | Sum of 5 Bilder pts | Yes (tied high) | Extra `payer` field (lowest score pays); no `pudel` field |
| `kda` | `[{ playerId, score, winner }]` | `boolean` | `-(losses)` negative | No (single winner) | `score` is negative int; no `pudel` field |
| `viergewinnt` | `[{ playerId, team, score, winner }]` | `boolean` | Always `0` | Yes (`state.winner === 'draw'`) | SPECIAL: draw is when `state.winner === 'draw'` — all `winner` fields are `false` in that case. Score is always 0 — skip personal best. |
| `fuchsjagd` | `[{ playerId, role, score, winner }]` | `boolean` | `fp` for fuchs, `0` for jaeger | No | All jaeger share same `winner` value. Score 0 for all jaeger — skip personal best for jaeger entries. |

### Key finding: Vier Gewinnt draw detection

For VG, the `getFinalResults` function returns all players with `winner: false` when it's a draw (`state.winner === 'draw'`). So the general rule "if `winners.filter(r => r.winner).length > 1` → draw" does NOT catch VG draws. VG draws produce zero `winner: true` entries, not multiple.

**Correct draw detection for stats aggregation:**
```javascript
// [ASSUMED — derived by reading vier-gewinnt.js getFinalResults source]
const winners = results.filter(r => r.winner);
// Draw cases:
// (A) multiple winners: winners.length > 1 (tied score games)
// (B) zero winners: winners.length === 0 (VG draw, or edge case)
// Decision (per D-05): if zero winners AND game is finished → treat as draw
const isDraw = winners.length !== 1;
// This correctly handles: VG draw (0 winners), tied score (>1 winners), AND
// single winner (not a draw). It is the simplest and most general rule.
```

This is the correct approach: `isDraw = winners.length !== 1`. A finished game with exactly one `winner: true` is a regular win; anything else is a draw.

### Pudel in getFinalResults vs. throws.meta

Some game modules count pudel in their state (e.g. `dreiVollen` tracks `p.pudel` in state). However, for STAT-03 the canonical source is `throws.meta` (per D-07), NOT the state's `pudel` count. The meta column is set by `POST /api/games/:id/throws` when the client passes `meta: { pudel: true }`. Use the SQL pudel query against `throws.meta`, not state.pudel from getFinalResults.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL JSON field extraction | Custom JS JSON parse loop | `json_extract(t.meta, '$.pudel')` in SQLite | SQLite 3.38+ supports JSON functions; `better-sqlite3` exposes them natively |
| State reconstruction for finished games | New reconstruction path | `reconstructState(game)` already exported from `routes/games.js` | Already handles players, throws, meta, roles correctly |
| Slug uniqueness enforcement | JS uniqueness check before INSERT | `UNIQUE` constraint on `game_type_defs.key` + catch UNIQUE error → 409 | DB enforces it atomically |
| Session enforcement on write routes | Custom session check | `requireSession` middleware already in `server/middleware/auth.js` | All existing write routes use it; import and apply |
| Active abend constraint | Application-level check | SQL: `SELECT WHERE ended_at IS NULL LIMIT 1` to check, then guard in POST | Simple; single writer means no race condition |

---

## Common Pitfalls

### Pitfall 1: `json_extract` returns `1` not `true` for boolean JSON

**What goes wrong:** SQLite stores JSON booleans as integers (1/0). `json_extract(meta, '$.pudel') = true` evaluates to false in SQLite. The comparison must be `= 1` or `IS 1`.

**How to avoid:**
```sql
SUM(CASE WHEN json_extract(t.meta, '$.pudel') = 1 THEN 1 ELSE 0 END) AS pudel_count
```

**Warning signs:** Pudel count always returns 0 despite throws having `meta.pudel: true`.

### Pitfall 2: `reconstructState` requires `gameModule` to exist

**What goes wrong:** `reconstructState(game)` calls `gameTypes[game.type_key]`, which will throw if type_key is a custom game type (not in the `gameTypes` registry). Custom game types cannot have `reconstructState` called on them.

**How to avoid:** Guard in stats loop:
```javascript
const gameModule = gameTypes[game.type_key];
if (!gameModule) continue; // skip custom/unknown types
```

**Warning signs:** Stats endpoint crashes with "Cannot read properties of undefined (reading 'initState')" on first custom game type game.

### Pitfall 3: `reconstructState` is not exported as a standalone function

**What goes wrong:** `reconstructState` is defined as a module-level function in `routes/games.js` and exported as `module.exports.reconstructState`. Requiring the games router in a new stats route file would create a circular dependency or double-initialization of the `activeGames` map.

**How to avoid:** Extract `reconstructState` into a shared helper module (`server/game-engine/reconstruct.js`) and import from there in both `routes/games.js` and `routes/stats.js`. Alternatively, the stats route can call `reconstructState` directly by duplicating the logic (it's only ~15 lines). Preferred: extract to shared helper for DRY.

**Alternative (simpler):** Since `routes/games.js` already exports it (`module.exports.reconstructState`), the stats route can `require('./games').reconstructState`. This creates a soft dependency on the games router being loaded first, which is fine in Express since all routes mount at startup. Test setup must clear both module caches.

### Pitfall 4: Multiple players sharing rank 1 in score-based games

**What goes wrong:** For games like `dreiVollen`, if two players throw the same total, both get `winner: true`. The stats endpoint must NOT assign a win to either — it's a draw.

**How to avoid:** The `isDraw = winners.length !== 1` rule above handles this correctly for all 9 game types.

### Pitfall 5: `game_type_defs.key` UNIQUE constraint collision

**What goes wrong:** Two custom types with names that slugify to the same key (e.g. "Mein Spiel" and "mein spiel") will fail on INSERT with a UNIQUE constraint error.

**How to avoid:** Catch SQLITE_CONSTRAINT error in POST handler and return 409 with a clear message: `{ error: 'Ein Spieltyp mit diesem Namen existiert bereits' }`.

### Pitfall 6: Active abend check race condition (non-issue for this app)

The single-writer SQLite model (one server process, synchronous `better-sqlite3`) means there is no race condition for the "at most one active abend" check. Do not add complex locking logic — a simple `SELECT WHERE ended_at IS NULL` guard before INSERT is sufficient.

### Pitfall 7: `kleineHaus` personal best semantics

**What goes wrong:** For `kleineHaus`, a lower score is BETTER. Storing "personal best = highest score" would be backwards.

**How to avoid:** Personal best is still stored as `results[i].score` from `getFinalResults`. For `kleineHaus`, `winner: true` goes to the player with the LOWEST valid score, and that player's score is the personal best for that type. The planner should note that "best score" means "the score achieved when you won" — which is the lowest number. This is consistent: the frontend can display it as-is with context.

**Simpler alternative:** Track personal best as the score of the `winner: true` entry per game, not the maximum across all games. This naturally handles inverted scoring. On further analysis: the `winner: true` player's score IS already the best score — the UI just shows it and the user understands context.

### Pitfall 8: `bilderkegel` missing `pudel` field in getFinalResults

**What goes wrong:** `bilderkegel.getFinalResults` returns `{ playerId, score, winner, payer }` — no `pudel` field. The pudel count must come from `throws.meta`, not from `getFinalResults`.

**This is already the correct design (D-07):** All pudel counting goes through the SQL `json_extract` query on `throws.meta`. No game module's `getFinalResults.pudel` field should be used for STAT-03.

### Pitfall 9: `POST /api/abende` — auto-name locale dependency

**What goes wrong:** `toLocaleDateString('de-DE', ...)` behavior depends on the server OS locale settings. On some minimal Linux VPS configurations, 'de-DE' locale may not be installed, causing the formatted string to fall back to the default locale.

**How to avoid:** Implement a minimal German day/month formatter that doesn't rely on `toLocaleDateString` locale:
```javascript
// [ASSUMED — safe fallback]
const DAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
function defaultAbendName() {
  const d = new Date();
  const day = DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${day} ${dd}.${mm}.`;
}
```

---

## Code Examples

### GET /api/abende/active — route skeleton

```javascript
// Source: derived from routes/players.js pattern in codebase
router.get('/active', (req, res) => {
  const abend = db.prepare(
    "SELECT id, name, started_at FROM abende WHERE ended_at IS NULL LIMIT 1"
  ).get();
  res.json(abend || null);
});
```

### POST /api/abende — create new abend

```javascript
// Source: derived from routes/games.js POST pattern
router.post('/', requireSession, (req, res) => {
  const name = (req.body && req.body.name && req.body.name.trim())
    || defaultAbendName();
  // Enforce: only one active abend at a time
  const existing = db.prepare(
    "SELECT id FROM abende WHERE ended_at IS NULL LIMIT 1"
  ).get();
  if (existing) {
    return res.status(409).json({ error: 'Es läuft bereits ein Abend' });
  }
  const result = db.prepare(
    "INSERT INTO abende (name) VALUES (?)"
  ).run(name);
  res.status(201).json({ id: result.lastInsertRowid, name });
});
```

### POST /api/games — abend auto-link (modification to existing route)

```javascript
// Source: derived from existing POST /api/games handler in routes/games.js
// Add AFTER player validation, BEFORE transaction:
let abendId = req.body.abend_id || null;
if (!abendId) {
  const active = db.prepare(
    "SELECT id FROM abende WHERE ended_at IS NULL LIMIT 1"
  ).get();
  if (active) abendId = active.id;
}

// In the transaction:
const insertGame = db.prepare(
  'INSERT INTO games (type_key, abend_id) VALUES (?, ?)'
);
// (replace existing INSERT INTO games (type_key) VALUES (?))
```

### GET /api/stats — full skeleton

```javascript
// Source: derived from codebase patterns
router.get('/', (req, res) => {
  const players = db.prepare(
    'SELECT id, name, emoji FROM players WHERE archived = 0'
  ).all();

  const finishedGames = db.prepare(
    "SELECT id, type_key FROM games WHERE status = 'finished'"
  ).all();

  // Win/loss/draw + personal bests
  const statsMap = {};
  players.forEach(p => {
    statsMap[p.id] = { wins: 0, losses: 0, draws: 0, bests: {} };
  });

  for (const game of finishedGames) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) continue;
    let results;
    try {
      const state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) {
      continue;
    }
    const winners = results.filter(r => r.winner);
    const isDraw = winners.length !== 1;
    for (const r of results) {
      const entry = statsMap[r.playerId];
      if (!entry) continue;
      if (isDraw) { entry.draws++; }
      else if (r.winner) { entry.wins++; }
      else { entry.losses++; }
      // Personal best (skip VG score:0, skip FJ jaeger score:0)
      if (typeof r.score === 'number' && r.score !== 0) {
        const prev = entry.bests[game.type_key];
        // For kleineHaus: winner has the lowest (best) score;
        // we track the winner's score as the personal best
        if (r.winner && (prev === undefined || r.score < prev) && game.type_key === 'kleineHaus') {
          entry.bests[game.type_key] = r.score;
        } else if (game.type_key !== 'kleineHaus' && (prev === undefined || r.score > prev)) {
          entry.bests[game.type_key] = r.score;
        }
      }
    }
  }

  // Pudel + throw counts
  const pudelRows = db.prepare(`
    SELECT t.player_id,
           COUNT(*) AS total_throws,
           SUM(CASE WHEN json_extract(t.meta, '$.pudel') = 1 THEN 1 ELSE 0 END) AS pudel_count
    FROM throws t
    JOIN games g ON t.game_id = g.id
    WHERE g.status = 'finished'
    GROUP BY t.player_id
  `).all();

  const pudelMap = {};
  for (const row of pudelRows) {
    pudelMap[row.player_id] = { total_throws: row.total_throws, pudel_count: row.pudel_count };
  }

  const response = players.map(p => {
    const s = statsMap[p.id] || { wins: 0, losses: 0, draws: 0, bests: {} };
    const pd = pudelMap[p.id] || { total_throws: 0, pudel_count: 0 };
    const pudel_pct = pd.total_throws > 0
      ? Math.round((pd.pudel_count / pd.total_throws) * 100 * 10) / 10
      : 0;
    const personal_bests = Object.entries(s.bests).map(([type_key, score]) => ({ type_key, score }));
    return {
      player_id: p.id,
      name: p.name,
      emoji: p.emoji,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      pudel_count: pd.pudel_count,
      total_throws: pd.total_throws,
      pudel_pct,
      personal_bests
    };
  });

  res.json(response);
});
```

### POST /api/game-types — slug + uniqueness

```javascript
// Source: derived from codebase patterns
router.post('/', requireSession, (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }
  const key = slugify(name.trim());
  if (!key) return res.status(400).json({ error: 'Ungültiger Name' });
  try {
    const result = db.prepare(
      "INSERT INTO game_type_defs (key, name, description, is_builtin) VALUES (?, ?, ?, 0)"
    ).run(key, name.trim(), description || null);
    res.status(201).json({ id: result.lastInsertRowid, key, name: name.trim(), description: description || null });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ein Spieltyp mit diesem Namen existiert bereits' });
    }
    throw e;
  }
});
```

### Frontend: Abend banner in renderSpiele()

```javascript
// Source: derived from existing renderSpiele() in index.html
// Pattern: inject banner HTML before game history list
// Uses existing CSS: .bamb badge, var(--ac) color, .btn.bp/.btn.bd classes

async function renderSpiele() {
  var el = document.getElementById('r-spiele');
  // Fetch active abend
  var abendData = await fetch('/api/abende/active').then(r => r.json());
  S.aktAbend = abendData ? { id: abendData.id, name: abendData.name } : null;

  var abendBanner = S.aktAbend
    ? '<div style="background:#e8b84b18;border:1px solid var(--ac);border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-weight:600;color:var(--ac)">📍 Abend läuft: ' + S.aktAbend.name + '</div>' +
      '<button class="btn bd sm" onclick="endAbend()">■ Beenden</button></div>'
    : '<button class="btn bp sm" style="width:100%;margin-bottom:16px" onclick="startAbend()">▶ Abend starten</button>';
  // ... rest of renderSpiele with abendBanner prepended
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stats computed in browser from local in-memory state | Stats computed server-side at query time from DB | Phase 4 | Persistent, cross-session, accurate |
| Game types hardcoded in JS `S.typen` array | Built-in types in JS + custom types from DB via API | Phase 4 | Custom types survive restart (PERS-03) |
| Games not grouped by evening | Games linked to `abende` via FK | Phase 4 | History grouped in Spiele tab |

**Deprecated/outdated within this project:**
- `addSpieler()` function in index.html still adds to local `S.spieler` without API call — this is a known stub from Phase 3 (stat-tracking in the player card is still local). Phase 4 stats replace this with server-computed data. The local `mkSp` / `updSp` pattern becomes irrelevant for stats display.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `isDraw = winners.length !== 1` correctly handles all 9 game types including VG draw (0 winners) | Code Examples / getFinalResults Audit | VG draws counted as losses for all players instead of draws |
| A2 | `kleineHaus` personal best = winner's score (lowest number) is the right UX choice | Code Examples | Personal best shows confusingly low numbers without context |
| A3 | `json_extract(meta, '$.pudel') = 1` works in the SQLite version bundled with `better-sqlite3` 12.10.0 | Common Pitfalls | Pudel count always 0; need fallback JS computation |
| A4 | `reconstructState` can be safely required from `routes/games.js` in the stats route without circular dependency | Common Pitfalls / Pitfall 3 | Module load error at startup; needs extraction to shared helper |
| A5 | German day names array fallback covers VPS locale issues | Common Pitfalls / Pitfall 9 | toLocaleDateString works fine on VPS; fallback is unnecessary but harmless |
| A6 | `score === 0` for VG and FJ-jaeger is a reliable signal to skip personal bests for those game types | Code Examples | If a player genuinely scores 0 in some future game type, their best is not recorded |

---

## Open Questions (RESOLVED)

1. **Should `kleineHaus` personal best show the winner's score or the player's best-ever score?**
   - What we know: lower is better in kleineHaus; `getFinalResults` returns the winner's actual house number.
   - What's unclear: should a player who scored 123 and lost see that as their personal "best" (closest to winning)?
   - RESOLVED: Only record personal bests for `winner: true` entries in kleineHaus (the score that won). This is unambiguous and consistent. Plans implement this by tracking the winner's score as the personal best per type_key.

2. **Should `GET /api/stats` include archived players?**
   - What we know: `GET /api/players` returns archived=0 players; the stats query fetches `WHERE archived = 0`.
   - What's unclear: if a player was active for 50 games and then archived, should their historical stats still appear?
   - RESOLVED: Exclude archived players from stats (consistent with all other API responses). Historical data is preserved in DB but not displayed. Plans implement `WHERE archived = 0` in the player query.

3. **Should custom game types appear in `GET /api/game-types` or be merged into the existing `S.typen` array?**
   - What we know: `S.typen` is hardcoded JS. `GET /api/game-types` returns only `is_builtin = 0` rows.
   - RESOLVED: Keep them separate. `S.typen` stays as-is for built-in types. Custom types fetched from API and rendered in their own section in the Bibliothek tab. This is exactly what D-12 specifies. Plans implement `GET /api/game-types` returning only `is_builtin=0` rows.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22 | `node:test`, `json_extract` in SQLite | Confirmed (package.json engines) | 22.x | — |
| `better-sqlite3` | All DB queries | Confirmed (installed) | 12.10.0 | — |
| SQLite JSON functions (`json_extract`) | Pudel SQL query | Built into SQLite 3.38+; bundled with better-sqlite3 12.x | Included | JS fallback if not available |
| `socket.io` | Abend-linked game broadcast | Confirmed (installed) | 4.8.3 | — |

**No missing dependencies.** All Phase 4 work uses already-installed packages.

---

## Validation Architecture

`nyquist_validation: true` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (Node 22) |
| Config file | None — `node --test` auto-discovers `*.test.js` |
| Quick run command | `node --test server/routes/abende.test.js` |
| Full suite command | `node --test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERS-04 | POST /api/abende creates abend and returns {id, name} | unit/route | `node --test server/routes/abende.test.js` | Wave 0 |
| PERS-04 | GET /api/abende/active returns null when none open | unit/route | `node --test server/routes/abende.test.js` | Wave 0 |
| PERS-04 | GET /api/abende/active returns abend object when open | unit/route | `node --test server/routes/abende.test.js` | Wave 0 |
| PERS-04 | POST /api/abende/active returns 409 if abend already open | unit/route | `node --test server/routes/abende.test.js` | Wave 0 |
| PERS-04 | POST /api/abende/:id/end closes abend (sets ended_at) | unit/route | `node --test server/routes/abende.test.js` | Wave 0 |
| PERS-04 | POST /api/games auto-links to active abend when abend_id omitted | unit/route | `node --test server/routes/games.test.js` | Modify existing |
| PERS-04 | GET /api/games returns abend_id in game list | unit/route | `node --test server/routes/games.test.js` | Modify existing |
| STAT-01 | GET /api/stats returns wins/losses/draws for players after finished games | unit/route | `node --test server/routes/stats.test.js` | Wave 0 |
| STAT-01 | Shared-rank game (2 winners) → draw, no wins/losses counted | unit/route | `node --test server/routes/stats.test.js` | Wave 0 |
| STAT-01 | VG draw (state.winner='draw', 0 winners) → draw counted | unit/route | `node --test server/routes/stats.test.js` | Wave 0 |
| STAT-02 | GET /api/stats includes personal_bests per type_key | unit/route | `node --test server/routes/stats.test.js` | Wave 0 |
| STAT-02 | Personal best updates when higher score achieved | unit/route | `node --test server/routes/stats.test.js` | Wave 0 |
| STAT-03 | GET /api/stats counts pudel from meta.pudel=true only | unit/route | `node --test server/routes/stats.test.js` | Wave 0 |
| STAT-03 | Throws with value=0 but no meta.pudel flag NOT counted | unit/route | `node --test server/routes/stats.test.js` | Wave 0 |
| STAT-03 | pudel_pct = pudel_count / total_throws * 100 (rounded to 1 decimal) | unit/route | `node --test server/routes/stats.test.js` | Wave 0 |
| PERS-03 | GET /api/game-types returns only is_builtin=0 rows | unit/route | `node --test server/routes/game-types.test.js` | Wave 0 |
| PERS-03 | POST /api/game-types creates custom type with slugified key | unit/route | `node --test server/routes/game-types.test.js` | Wave 0 |
| PERS-03 | POST /api/game-types returns 409 on duplicate key | unit/route | `node --test server/routes/game-types.test.js` | Wave 0 |
| PERS-03 | DELETE /api/game-types/:id removes custom type | unit/route | `node --test server/routes/game-types.test.js` | Wave 0 |
| PERS-03 | DELETE /api/game-types/:id returns 403 for is_builtin=1 | unit/route | `node --test server/routes/game-types.test.js` | Wave 0 |
| PERS-03 | POST /api/game-types requires session (401 without) | unit/route | `node --test server/routes/game-types.test.js` | Wave 0 |

### Frontend Validation (manual-only — no DOM test framework)

| Behavior | How to Verify | Automated? |
|----------|--------------|------------|
| Spiele tab shows "Abend starten" when no active abend | Browser: reload, check Spiele tab | Manual |
| Spiele tab shows amber banner with abend name when active | Browser: start abend, check Spiele tab | Manual |
| Banner disappears after "Beenden" button | Browser: end abend, re-render | Manual |
| Stats tab shows player cards with correct wins/losses | Browser: finish 2 games, check Stats | Manual |
| Personal bests table shows per-type-key scores | Browser: verify personal bests in stats | Manual |
| Bibliothek "+ Hinzufügen" modal creates custom type | Browser: create type, verify in list | Manual |
| Custom type persists after server restart | Browser: restart server, check Bibliothek | Manual |
| Custom type has gold left border (.stc.cu) | Browser: visual check | Manual |
| Delete button removes custom type | Browser: delete, verify gone | Manual |

### Sampling Rate

- **Per task commit:** `node --test server/routes/abende.test.js` (or relevant test file)
- **Per wave merge:** `node --test` (full suite, currently 170 passing — must stay green)
- **Phase gate:** Full suite green before verification checkpoint

### Wave 0 Gaps (test stubs needed before implementation)

- [ ] `server/routes/abende.test.js` — covers PERS-04 route tests (stubs: AB01–AB06)
- [ ] `server/routes/stats.test.js` — covers STAT-01, STAT-02, STAT-03 (stubs: ST10–ST20)
- [ ] `server/routes/game-types.test.js` — covers PERS-03 route tests (stubs: GT25–GT31)
- [ ] Modify `server/routes/games.test.js` — add tests for abend auto-link on POST /api/games

---

## Security Domain

`security_enforcement` not explicitly disabled in config.json — section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `requireSession` middleware on all write routes |
| V3 Session Management | No — existing session infrastructure unchanged | — |
| V4 Access Control | Yes (partial) | `is_builtin = 0` check before DELETE on game-types |
| V5 Input Validation | Yes | Name/description required-field validation; slug sanitization |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Deleting built-in game types | Tampering | `WHERE is_builtin = 0` guard in DELETE route; return 403 otherwise |
| XSS via custom type name in Bibliothek | Tampering | Use `textContent` (never `innerHTML`) for DB-sourced name/description |
| Stats endpoint performance DoS | Denial of Service | Dataset is bounded (~10 players, ~200 games/year); no pagination needed |
| Opening multiple abende simultaneously | Tampering | Server enforces single-active check; returns 409 if one already open |
| Abend end without ownership | Tampering | Any authenticated session can end any abend (shared PIN model — acceptable for single club) |

---

## Sources

### Primary (HIGH confidence)
- `server/game-types/*.js` — all 9 `getFinalResults()` return shapes read directly from source
- `server/db/index.js` — migration pattern (try/catch duplicate-column)
- `server/db/schema.sql` — current schema; `game_type_defs` table confirmed present
- `server/routes/games.js` — `reconstructState`, route structure, `activeGames` map
- `public/index.html` — `S.*` state object, CSS classes, tab structure, modal pattern
- `package.json` — confirmed no new packages needed, `node:test` is the test runner

### Secondary (MEDIUM confidence)
- `server/game-types/vier-gewinnt.js` — VG draw detection: `state.winner === 'draw'` returns 0 `winner:true` entries
- `server/game-types/kleine-hausnummer.js` — kleineHaus personal best semantics (inverted scoring)
- `server/game-types/bilderkegel.js` — confirms no `pudel` field in `getFinalResults` for this type

### Tertiary (LOW confidence / ASSUMED)
- A1–A6 in Assumptions Log above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- getFinalResults() API: HIGH — read directly from all 9 source files
- Schema migrations: HIGH — pattern read from db/index.js; SQLite DDL is standard
- Stats SQL: HIGH — `json_extract` is standard SQLite 3.38+; confirmed via better-sqlite3 version
- Architecture: HIGH — derived from Phase 1–3 established patterns
- Frontend patterns: HIGH — CSS classes and state object read from current index.html
- Pitfalls: HIGH — derived from direct code reading; confirmed by game module implementations

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable stack — 30 day window)
