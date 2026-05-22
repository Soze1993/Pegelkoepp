# Phase 1 Context — Backend Foundation

**Phase:** 1 of 5
**Goal:** Running Node.js/Express server, SQLite schema, 9 game-type modules, REST API, PIN auth
**Discussed:** 2026-05-19

---

## Locked Decisions

### D1 — Player Seeding
**Decision:** Seed script approach (`scripts/seed.js`)
**Detail:** On first start, if `players` table is empty, the seed script inserts all 12 Pegelköpp members with their names and emojis. Players can be added, renamed, or archived via API at any time. No manual SQL required for initial setup.
**Why:** Simple, repeatable, keeps member data in source control. Avoids manual SQL and setup screens.

### D2 — PIN Setup
**Decision:** PIN hash stored in `.env` file — no setup screen
**Detail:** Admin generates hash via `node -e "require('bcryptjs').hash('yourpin',10).then(console.log)"` once, pastes into `.env` as `PIN_HASH`. Session secret also in `.env`.
**Why:** Club app — no need for a setup wizard. Simple and secure baseline.
**Implementation note:** `.env.example` must be committed with placeholder values; `.env` in `.gitignore`.

### D3 — Projektstruktur (Folder Layout)
**Decision:** Organized structure from day 1
```
server/
  app.js              ← Express setup, middleware, route mounting
  server.js           ← HTTP server + Socket.io init, entry point
  routes/
    auth.js
    players.js
    games.js
  game-types/
    index.js          ← exports all 9 modules
    vier-gewinnt.js
    fuchsjagd.js
    drei-vollen.js
    grosse-hausnummer.js
    kleine-hausnummer.js
    plus-minus-mal.js
    anker.js
    kegler-des-abends.js
    bilderkegel.js
  db/
    index.js          ← better-sqlite3 setup, WAL mode, exports `db`
    schema.sql        ← DDL for all tables
    seed.js           ← initial 12 players
  middleware/
    auth.js           ← requireSession middleware
public/               ← static files (kegelclub_12.html lives here eventually)
.env
.env.example
package.json
```
**Why:** Scales cleanly into Phase 2+ without refactoring. Matches architecture research Layer 0–2.

### D4 — Game-Modul-Extraktion
**Decision:** Extract all 9 game types as pure-function modules in Phase 1
**Detail:** Each module exports: `initState(players)`, `applyThrow(state, playerId, value)`, `isFinished(state)`, `getFinalResults(state)`. Logic is extracted from `kegelclub_12.html` and ported to Node.js modules — no browser APIs, no DOM, no global `S`.
**Why:** All 9 modules are needed before REST API and Socket.io can be wired up. Extracting only a scaffold would block Phase 2. Phase 1 success criterion 4 explicitly requires all 9 to work with known test inputs.

### D5 — Migrationsstrategie
**Decision:** Simple SQL init script (`db/schema.sql`) — no migration tool
**Detail:** `db/index.js` runs `schema.sql` via `execScript` on startup using `CREATE TABLE IF NOT EXISTS`. Schema is idempotent. No knex, no db-migrate, no versioned migration files for Phase 1.
**Caveat:** Before Phase 5 (production deployment), add versioned migrations or document that schema changes require a manual `ALTER TABLE`. This is the M5 pitfall from research.
**Why:** Knex adds complexity and a learning curve for a 4-table schema. `IF NOT EXISTS` is sufficient for a single-instance app through Phase 4.

---

## Carryover from Prior Research

### Critical constraints that must be implemented in Phase 1:
- **C5 — WAL mode:** `db.pragma('journal_mode = WAL'); db.pragma('busy_timeout = 5000');` — must not be skipped
- **C3 — Duplicate throw prevention:** `UNIQUE (game_id, player_id, throw_index)` in schema
- **C2 — Crash recovery:** Every throw written to DB immediately; server reload must restore game state from `throws` table

### Auth boundary (locked from research):
- `GET /tv` — unauthenticated (TV has no keyboard, sits on HDMI)
- All write routes (`POST`, `PUT`, `DELETE`, `/api/*` write endpoints, Socket.io `throw:submit`) — require valid session

### Game state strategy (locked from research):
- In-memory `Map<gameId, state>` during active games — correct for 2–3h club nights
- `throws` table is source of truth — server reconstructs in-memory state from DB on restart
- Client-computed scores are **not trusted** — server recomputes from throw log

---

## SQLite Schema (Phase 1)

```sql
CREATE TABLE IF NOT EXISTS players (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  emoji     TEXT NOT NULL DEFAULT '🎳',
  archived  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type_key    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active', -- active | finished
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS game_players (
  game_id   INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL REFERENCES players(id),
  seat      INTEGER NOT NULL,
  PRIMARY KEY (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS throws (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     INTEGER NOT NULL REFERENCES games(id),
  player_id   INTEGER NOT NULL REFERENCES players(id),
  throw_index INTEGER NOT NULL,
  value       INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (game_id, player_id, throw_index)
);

-- Empty in Phase 1; populated in Phase 4 (PERS-03)
-- Stores user-created game types (generic scoring: name + max throws + target score)
-- Built-in game types (9) are code modules, not rows in this table
CREATE TABLE IF NOT EXISTS game_type_defs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  is_builtin  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Open Questions (deferred to later phases)

| Question | Deferred to |
|----------|-------------|
| Kegelabend session grouping (explicit "Start Abend" button) | Phase 4 |
| Custom game types (user-created) | Phase 4 |
| Statistics views (wins, records, Pudel%) | Phase 4 |
| TV layout per game type | Phase 2 |
| TV layout per game type | Phase 2 |
| Favoritenliste der Spieltypen | v2 (Backlog) |
| WhatsApp share link | v2 (out of scope) |

---

## Next Step

Run `/gsd-plan-phase 1` — planner reads this file + ROADMAP.md Phase 1 success criteria and produces an executable task plan.
