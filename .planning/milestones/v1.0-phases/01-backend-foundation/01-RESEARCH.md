# Phase 1: Backend Foundation - Research

**Researched:** 2026-05-19
**Domain:** Node.js / Express / SQLite / PIN-Auth / Game-Logic Extraction
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1 — Player Seeding:** Seed script approach (`scripts/seed.js`). On first start, if `players` table is empty, insert all 12 Pegelköpp members with names and emojis. No manual SQL required.

**D2 — PIN Setup:** PIN hash stored in `.env` file — no setup screen. Admin generates hash via `node -e "require('bcryptjs').hash('yourpin',10).then(console.log)"`, pastes into `.env` as `PIN_HASH`. `.env.example` must be committed with placeholder values; `.env` in `.gitignore`.

**D3 — Projektstruktur (Folder Layout):**
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

**D4 — Game-Modul-Extraktion:** Extract all 9 game types as pure-function modules in Phase 1. Each exports: `initState(players)`, `applyThrow(state, playerId, value)`, `isFinished(state)`, `getFinalResults(state)`. Logic extracted from `kegelclub_12.html`, no browser APIs, no DOM, no global `S`.

**D5 — Migrationsstrategie:** Simple SQL init script (`db/schema.sql`) — no migration tool. `db/index.js` runs `schema.sql` via `execScript` on startup using `CREATE TABLE IF NOT EXISTS`. Schema is idempotent.

### Critical Constraints (locked from prior research)

- **C5 — WAL mode:** `db.pragma('journal_mode = WAL'); db.pragma('busy_timeout = 5000');` — must not be skipped.
- **C3 — Duplicate throw prevention:** `UNIQUE (game_id, player_id, throw_index)` in schema.
- **C2 — Crash recovery:** Every throw written to DB immediately; server reload reconstructs game state from `throws` table.

### Auth Boundary (locked)

- `GET /tv` — unauthenticated
- All write routes (`POST`, `PUT`, `DELETE`, Socket.io `throw:submit`) — require valid session

### Deferred Ideas (OUT OF SCOPE for Phase 1)

- Kegelabend session grouping → Phase 4
- Custom game types → Phase 4
- Statistics views → Phase 4
- TV layout per game type → Phase 2
- Socket.io real-time → Phase 2
- WhatsApp share link → v2 (Backlog)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with a shared PIN and stay logged in across browser sessions | `express-session` + `bcryptjs`; session stored in SQLite via `connect-sqlite3`; `httpOnly` + `sameSite:strict` cookie flags |
| AUTH-02 | TV display route (`/tv`) is accessible without login | Express static route for `/tv` mounted before auth middleware; no `requireSession` on that path |
| BACK-01 | User can manage players via API (create, edit, archive — no hard delete) | REST routes in `routes/players.js`; `archived` INTEGER column in `players` table; active list filters `WHERE archived = 0` |
| BACK-02 | All 9 built-in game type scoring rules run on the server as pure-function modules | Logic extracted from `kegelclub_12.html`; each module exports `initState`, `applyThrow`, `isFinished`, `getFinalResults` |
| BACK-03 | Every throw is written to the database immediately (active game survives server restart) | `throws` table written synchronously via `better-sqlite3` inside throw handler; server reconstructs active game state on startup by reading `throws` table |
| PERS-01 | Player profiles (name, emoji) are saved permanently in the database | `players` table in SQLite; seed script for 12 initial members |
| PERS-02 | All game sessions, throws, and results are stored in the database | `games`, `game_players`, `throws` tables; synchronous write on every throw |
</phase_requirements>

---

## Summary

Phase 1 lays the complete server foundation for the Pegelköpp app. All architectural decisions are already locked in CONTEXT.md — this phase has no open choices. The work is implementation, not design.

The stack is Node.js 24.x + Express 5.2.x + `better-sqlite3` 12.10.x + `express-session` 1.19.x + `bcryptjs` 3.0.3. One important finding: `connect-sqlite3` depends on the async `sqlite3` package (not `better-sqlite3`), which means Phase 1 will use two different SQLite bindings — `better-sqlite3` for app data and `sqlite3` (transitive via `connect-sqlite3`) for session storage. This is well-established and acceptable; the session store is fully encapsulated.

The most complex extraction task is Fuchsjagd (Fox Hunt): a multi-phase pursuit game where the fox accumulates a score over two opening throws, then hunters and fox alternate. The state machine is non-trivial and must be extracted with care. All other game types follow simpler "each player throws N times, sum/compare" patterns except Kegler des Abends (double-elimination tournament bracket) and Bilderkegel (five-picture round-robin).

**Primary recommendation:** Build in strict layer order: DB schema + WAL → seed + migrations → game modules → REST routes → auth middleware. Never skip WAL mode. Extract all 9 game modules before wiring any REST route.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PIN authentication | API / Backend | — | Session state lives on server; never in browser |
| Session persistence | Database / Storage | — | `connect-sqlite3` stores sessions in SQLite |
| Player CRUD | API / Backend | Database / Storage | REST routes + `players` table |
| Game scoring logic | API / Backend | — | Pure functions in `server/game-types/`; server is authoritative |
| Throw persistence | Database / Storage | API / Backend | Written synchronously on every throw; crash recovery requirement |
| Static file serving | API / Backend | CDN / Static | Express `static()` serves `public/`; no CDN for MVP |
| TV route (`/tv`) | API / Backend | — | Express route, unauthenticated, serves static HTML |
| In-memory game state | API / Backend | — | `Map<gameId, state>` in `server/`; reconstructed from DB on restart |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24.15.0 (installed) | Runtime | LTS; `better-sqlite3` 12.x explicitly supports 24.x [VERIFIED: npm registry] |
| Express | 5.2.1 | HTTP server + REST API | Latest stable; Express 5 has built-in async error propagation (no `express-async-errors` needed) [VERIFIED: npm registry] |
| better-sqlite3 | 12.10.0 | SQLite access | Synchronous API, correct for SQLite; supports Node 24.x [VERIFIED: npm registry] |
| express-session | 1.19.0 | Session cookie management | Official Express middleware; signed cookies [VERIFIED: npm registry] |
| bcryptjs | 3.0.3 | PIN hashing | Pure JS, zero deps, compatible with `bcrypt` hash format [VERIFIED: npm registry] |
| connect-sqlite3 | 0.9.16 | Session store in SQLite | Sessions persist across restarts without Redis [VERIFIED: npm registry] |
| dotenv | 17.4.2 | `.env` loader | Standard env config [VERIFIED: npm registry] |
| helmet | 8.1.0 | Security HTTP headers | CSP, HSTS, X-Frame-Options one-liner [VERIFIED: npm registry] |
| morgan | 1.10.1 | HTTP request logging | Dev + prod logging [VERIFIED: npm registry] |
| cors | 2.8.6 | CORS headers | Required if frontend served from different port in dev [VERIFIED: npm registry] |

### Dev Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nodemon | 3.1.14 | Auto-restart in dev | `npm run dev`; not used in production [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `connect-sqlite3` | `better-sqlite3-session-store` (v0.1.0, 2020) | `connect-sqlite3` is older and more tested; `better-sqlite3-session-store` is low-traffic |
| `bcryptjs` | `bcrypt` (native) | `bcryptjs` is pure JS, zero native deps, easier CI/Windows setup; performance difference negligible for single PIN check |
| `express-session` + cookie | JWT | JWT adds stateless complexity not needed for shared-PIN app |

**Installation:**
```bash
npm install express better-sqlite3 express-session connect-sqlite3 bcryptjs dotenv helmet morgan cors
npm install -D nodemon
```

**Version verification:** All versions confirmed live against npm registry on 2026-05-19. [VERIFIED: npm registry]

> **Important note on Express version:** `npm view express version` returns `5.2.1`, not `4.21.x` as listed in CLAUDE.md. Express 5 is now stable and the default. CLAUDE.md says "stick with 4 for brownfield safety" but since this is a new backend (not brownfield), Express 5 is the better choice. Express 5 has built-in async error forwarding — thrown errors in async route handlers are automatically forwarded to error middleware. The `express-async-errors` shim is NOT needed for Express 5.

---

## Package Legitimacy Audit

> `slopcheck` was unavailable at research time. All packages verified via npm registry (age, creation date confirmed) and cross-referenced with official documentation.

| Package | Registry | Age | Source | slopcheck | Disposition |
|---------|----------|-----|--------|-----------|-------------|
| express | npm | 15+ yrs (2010) | github.com/expressjs/express | N/A | Approved [VERIFIED: npm registry] |
| better-sqlite3 | npm | 8 yrs (2016) | github.com/WiseLibs/better-sqlite3 | N/A | Approved [VERIFIED: npm registry] |
| express-session | npm | 12 yrs (2014) | github.com/expressjs/session | N/A | Approved [VERIFIED: npm registry] |
| bcryptjs | npm | 13 yrs (2013) | github.com/dcodeIO/bcrypt.js | N/A | Approved [VERIFIED: npm registry] |
| connect-sqlite3 | npm | 13 yrs (2012) | github.com/rawberg/connect-sqlite3 | N/A | Approved [VERIFIED: npm registry] |
| dotenv | npm | 12 yrs (2013) | github.com/motdotla/dotenv | N/A | Approved [VERIFIED: npm registry] |
| helmet | npm | 14 yrs (2012) | github.com/helmetjs/helmet | N/A | Approved [VERIFIED: npm registry] |
| morgan | npm | 12 yrs (2014) | github.com/expressjs/morgan | N/A | Approved [VERIFIED: npm registry] |
| cors | npm | 13 yrs (2013) | github.com/expressjs/cors | N/A | Approved [VERIFIED: npm registry] |
| nodemon | npm | 15 yrs (2011) | github.com/remy/nodemon | N/A | Approved [VERIFIED: npm registry] |

**No postinstall scripts detected** for any of the above packages.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable — all packages tagged [VERIFIED: npm registry] based on age (10+ years), official GitHub source repos confirmed, and no suspicious postinstall scripts.*

---

## Architecture Patterns

### System Architecture Diagram

```
npm start
    |
    v
server/server.js  ← creates HTTP server + Express app
    |
    +-- express static (public/)        ← serves frontend assets
    +-- GET /tv  (no auth)              ← serves public/tv.html placeholder
    +-- POST /api/auth/login            ← returns session cookie
    +-- /api/players  (requireSession)  ← CRUD, archive flag
    +-- /api/games    (requireSession)  ← create game, add throws
    |
    v
server/db/index.js  ← better-sqlite3; WAL mode; runs schema.sql on init
    |
    +-- players table
    +-- games table
    +-- game_players table
    +-- throws table  ← UNIQUE constraint (game_id, player_id, throw_index)
    +-- game_type_defs table (empty in Phase 1)
    |
server/db/seed.js  ← runs if players table is empty; inserts 12 members
    |
server/game-types/  ← 9 pure-function modules (no DOM, no global S)
    +-- index.js (re-exports all)
    +-- vier-gewinnt.js
    +-- fuchsjagd.js
    +-- drei-vollen.js
    +-- grosse-hausnummer.js
    +-- kleine-hausnummer.js
    +-- plus-minus-mal.js
    +-- anker.js
    +-- kegler-des-abends.js
    +-- bilderkegel.js
```

### Recommended Project Structure

```
server/
  app.js
  server.js
  routes/
    auth.js
    players.js
    games.js
  game-types/
    index.js
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
    index.js
    schema.sql
    seed.js
  middleware/
    auth.js
public/
  (empty in Phase 1 except placeholder tv.html)
scripts/
  (seed.js if separate from db/seed.js)
.env
.env.example
package.json
```

### Pattern 1: SQLite Setup with WAL Mode

**What:** Open SQLite database, enable WAL journal mode and busy timeout on first open.
**When to use:** Always — must be the very first thing `db/index.js` does.

```javascript
// server/db/index.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/kegelclub.db');

const db = new Database(DB_PATH);

// CRITICAL: WAL mode must be set before any other queries
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// Run schema on startup (idempotent via IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
```

### Pattern 2: Express Session Setup (Express 5)

**What:** Session middleware with SQLite store.
**When to use:** Once in `app.js`, before route mounting.

```javascript
// server/app.js
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './data' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
}));
```

### Pattern 3: PIN Auth Route

**What:** Compare submitted PIN against bcrypt hash from `.env`.
**When to use:** `POST /api/auth/login`.

```javascript
// server/routes/auth.js
const bcrypt = require('bcryptjs');

router.post('/login', async (req, res) => {
  const { pin } = req.body;
  const hash = process.env.PIN_HASH;
  if (!pin || !hash) return res.status(400).json({ error: 'Bad request' });
  const ok = await bcrypt.compare(String(pin), hash);
  if (!ok) return res.status(401).json({ error: 'Falscher PIN' });
  req.session.authenticated = true;
  res.json({ ok: true });
});
```

### Pattern 4: requireSession Middleware

**What:** Gate write routes behind a session check.
**When to use:** Mount on all write routes and routers.

```javascript
// server/middleware/auth.js
function requireSession(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Authentication required' });
}
module.exports = requireSession;
```

### Pattern 5: Game Type Module Interface

**What:** Standard interface every game type module must export.
**When to use:** All 9 modules in `server/game-types/`.

```javascript
// server/game-types/drei-vollen.js  (simplest example)
module.exports = {
  id: 'dreiVollen',
  name: 'Drei in die Vollen',

  initState(players) {
    return {
      players: players.map(p => ({ ...p, wuerfe: [], pudel: 0 })),
      aktSpIdx: 0,
      done: false
    };
  },

  applyThrow(state, playerId, value) {
    // Pure function — returns NEW state object, never mutates input
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players.find(x => x.id === playerId);
    if (value === 0) p.pudel++;
    p.wuerfe.push(value);
    if (p.wuerfe.length >= 3) {
      s.aktSpIdx++;
      if (s.aktSpIdx >= s.players.length) s.done = true;
    }
    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const scored = state.players.map(p => ({
      playerId: p.id,
      score: p.wuerfe.reduce((a, b) => a + b, 0),
      pudel: p.pudel
    }));
    const maxScore = Math.max(...scored.map(p => p.score));
    return scored.map(p => ({ ...p, winner: p.score === maxScore }));
  }
};
```

### Pattern 6: Express 5 Async Error Handling

**What:** Express 5 automatically propagates thrown errors from async route handlers.
**When to use:** Express 5 — no wrapper needed, just add error middleware.

```javascript
// server/app.js — error middleware (last middleware registered)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
```

> Express 4 required `express-async-errors` or manual try/catch. Express 5 handles this natively. [ASSUMED — based on Express 5 documentation claims from training; verify during implementation]

### Anti-Patterns to Avoid

- **Mutating state in `applyThrow`:** All game module functions must return new state objects. Mutation causes bugs when state is replayed from the `throws` table for crash recovery.
- **Storing active game state only in RAM:** DB write must happen synchronously (better-sqlite3) before the HTTP response is sent.
- **Using `express-async-errors` with Express 5:** Not needed; using it causes double-registration of error handlers.
- **Skipping `db.pragma('foreign_keys = ON')`:** SQLite does not enforce FK constraints by default. Must be explicitly enabled.
- **Putting auth check on `/tv` route:** TV display has no keyboard. Must remain unauthenticated.
- **Using `sqlite3` (async) for app data:** The project already locks in `better-sqlite3` (synchronous). `connect-sqlite3` uses the async `sqlite3` for sessions only — this is fine and encapsulated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PIN hashing | Custom hash function | `bcryptjs.hash()` + `bcryptjs.compare()` | Timing-safe comparison, salt included, industry standard |
| Session management | JWT or cookie parsing | `express-session` + `connect-sqlite3` | Session invalidation, signed cookies, persistence |
| Security headers | Manual `res.setHeader()` calls | `helmet()` | Covers 10+ header types including CSP, HSTS |
| Duplicate throw detection | Application-level dedup logic | `UNIQUE (game_id, player_id, throw_index)` DB constraint | DB-level enforcement survives race conditions |
| Schema idempotency | Version checks | `CREATE TABLE IF NOT EXISTS` | Already sufficient for Phase 1's 4-table schema |

**Key insight:** The game scoring logic IS hand-rolled — that's intentional. The complexity is domain-specific (9 different Kegel game types). No npm package can replace it. Everything surrounding the game logic (auth, sessions, DB, HTTP headers) should use established libraries.

---

## Game Type Extraction Guide

The HTML file `kegelclub_12.html` has all scoring logic in a single `<script>` block. The 9 game types and their key behaviors:

### 1. Drei in die Vollen (`dreiVollen`)
- Each player throws 3 times in sequence
- Score = sum of 3 throws
- Pudel (0) counts as 0 points
- Highest score wins
- **Complexity: LOW**

### 2. Große Hausnummer (`grosseHaus`)
- Each player gets 3 throws, placed into Hunderter/Zehner/Einer slots (player chooses slot)
- Score = 3-digit number formed by slots
- Pudel (0) = 0 for that slot
- Highest number wins
- Key logic: `hn(slots)` function — `(h*100) + (z*10) + e`
- **Complexity: MEDIUM** — slot assignment per throw adds state shape complexity

### 3. Kleine Hausnummer (`kleineHaus`)
- Same as Große Hausnummer but Pudel = 9 (worst possible digit)
- Lowest valid number wins (zeros/nulls excluded)
- **Complexity: MEDIUM**

### 4. Plus/Minus/Mal/Geteilt (`plusMinus`)
- 5 rounds, each player throws once per round
- Formula: `W1 + W2 - W3 * W4 / W5`
- Pudel handling per round: W1=0, W2=0, W3=9, W4=1, W5=1 (avoids divide-by-zero)
- Key logic: `pmCalc(w)` function
- Highest result wins
- **Complexity: MEDIUM** — Pudel substitution values differ per round

### 5. Vier Gewinnt (`viergewinnt`)
- Team game (Team X vs Team O)
- Players alternate within teams
- Throw value = column number (1-9) in a 9x9 grid
- Pudel = no piece placed, turn advances
- First team to get 4 in a row (horizontal, vertical, diagonal) wins
- Draw if grid is full
- Key logic: `check4(grid, team)` — checks all 4-in-a-row patterns
- **Complexity: HIGH** — team management, grid state, win-check algorithm

### 6. Fuchsjagd (`fuchsjagd`)
- 1 Fuchs (Fox) vs N Jäger (Hunters)
- Fuchs starts with 2 throw "head start" (fp += throw)
- Then alternating: Hunter subtracts, Fox adds back
- If fp <= 0: Hunters win
- If total hunter throws >= 6 and fp > 0: Fox wins
- Key logic: phase management (`start` → `jagd`), fp tracking
- **Complexity: HIGH** — most complex state machine; multi-phase

### 7. Anker (`anker`)
- Kegel configuration: pins 1,4,5,6,7,8,9 (pins 2+3 removed)
- Per throw, score depends on which pins fall:
  - Bauer (pins 4,6) = 10 pts
  - Dame (pins 7,8) = 5 pts
  - Barbel (pins 1,5,9) = 10 pts
  - Any other single pin = 1 pt each
- Actually in the HTML: `ankerPts` is a player-selected point value (0-9), not computed from pin detection. The UI shows a grid of point buttons.
- 5 throws per round, up to configurable max rounds
- Round ends early if player reaches 40 pts
- Highest total score across all rounds wins
- **Complexity: MEDIUM**

### 8. Kegler des Abends (`kda`)
- Double-elimination tournament
- Random initial bracket, players shuffled
- Each match: one player declared winner (no throw tracking at game module level — just win/loss recording)
- Player eliminated after 2 losses
- Last remaining player wins
- Key logic: `kdaSetWinner()` — rebuilds bracket after each match
- **Complexity: HIGH** — bracket state, bye handling, double-elimination logic

### 9. Bilderkegel (`bilderkegel`)
- 5 "pictures" (Volle, Kleeblatt, Hint. Kranz, Damen, Bauern)
- Each player gets 2 throws per picture, rotating through all pictures
- Score per picture = sum of 2 throws
- Total score = sum of all 5 picture scores
- Most total points wins; fewest total points must pay for next event
- **Complexity: MEDIUM**

> The HTML's `S` global state and `updSp()` pattern (which modifies cross-game player stats) must be removed during extraction. Each module must be fully self-contained.

---

## SQLite Schema (confirmed from CONTEXT.md)

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
  status      TEXT NOT NULL DEFAULT 'active',
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

## REST API Design (Phase 1)

### Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/login` | None | Submit PIN, get session cookie |
| POST | `/api/auth/logout` | Session | Clear session |
| GET | `/api/auth/status` | None | Returns `{ authenticated: bool }` |

### Players

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/players` | None | List active players (`archived = 0`) |
| POST | `/api/players` | Session | Create player `{ name, emoji }` |
| PUT | `/api/players/:id` | Session | Rename player `{ name, emoji }` |
| PUT | `/api/players/:id/archive` | Session | Archive player |

### Games

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/games` | Session | Start game `{ type_key, player_ids }` |
| GET | `/api/games/:id` | None | Get game state (reconstructed from throws) |
| POST | `/api/games/:id/throws` | Session | Submit throw `{ player_id, throw_index, value }` |

### Static

| Route | Auth | Description |
|-------|------|-------------|
| `GET /tv` | None | Serves `public/tv.html` (placeholder in Phase 1) |
| `GET /` | None | Serves `public/index.html` (placeholder in Phase 1) |

---

## Common Pitfalls

### Pitfall 1: WAL Mode Not Set (CRITICAL)

**What goes wrong:** Default DELETE journal mode. Concurrent reads during a write block. `SQLITE_BUSY` errors.
**Why it happens:** SQLite ships with DELETE mode by default; `better-sqlite3` does not change this.
**How to avoid:** Set `db.pragma('journal_mode = WAL')` as the very first operation after opening the DB.
**Warning signs:** HTTP 500 errors under concurrent load during game play.

### Pitfall 2: State Mutation in Game Modules

**What goes wrong:** `applyThrow` mutates the input state object. Crash recovery by replaying throws from DB produces different results.
**Why it happens:** JavaScript passes objects by reference; naive port of the HTML code mutates arrays in place.
**How to avoid:** Start each `applyThrow` with `const s = JSON.parse(JSON.stringify(state));` and return `s`.
**Warning signs:** Scores differ between live game and game replayed from DB after restart.

### Pitfall 3: `connect-sqlite3` Requires `sqlite3`, Not `better-sqlite3`

**What goes wrong:** `npm install connect-sqlite3` will install the async `sqlite3` package as a peer dependency. Two SQLite bindings will be in `node_modules`.
**Why it happens:** `connect-sqlite3`'s peer dependency is `sqlite3: ^5.0.2`, not `better-sqlite3`.
**How to avoid:** This is expected and acceptable. App data uses `better-sqlite3` (synchronous). Session data uses `sqlite3` via `connect-sqlite3` (encapsulated). Do not try to share the same binding.
**Warning signs:** `npm install` warnings about peer deps — these are expected and harmless.

### Pitfall 4: Fuchsjagd Phase State Machine

**What goes wrong:** The Fuchsjagd extraction is the most complex. The `phase` field (`start`/`jagd`) and `jPhase` (`jaeger`/`fuchs`) need to be correctly serialized in the `throws` table so the state can be reconstructed.
**Why it happens:** The game has two independent active players (Fox and current Hunter), not a simple round-robin.
**How to avoid:** The `throws` table stores `(game_id, player_id, throw_index, value)`. On restart, call `initState(players)` then replay all throws via `applyThrow` in `throw_index` order. The game module must be a pure state machine that reconstructs identically from throw history.
**Warning signs:** After server restart, Fuchsjagd game shows wrong `fp` (fox points).

### Pitfall 5: Express 5 vs. Express 4 Session Behavior

**What goes wrong:** `npm install express` installs 5.2.1, but session/auth patterns from Express 4 tutorials may have subtle differences.
**Why it happens:** `express@5` is now the default npm version (5.2.1), not 4.x.
**How to avoid:** `express-session` works identically with Express 5. No changes needed. Do NOT install `express-async-errors` — Express 5 handles async errors natively.
**Warning signs:** None — but avoid copying Express 4 boilerplate that includes `express-async-errors`.

### Pitfall 6: `foreign_keys` Pragma Not Set

**What goes wrong:** SQLite does not enforce REFERENCES/FK constraints unless explicitly enabled. `game_players.game_id` could reference a non-existent game.
**Why it happens:** SQLite's FK enforcement is opt-in for backward-compatibility.
**How to avoid:** `db.pragma('foreign_keys = ON')` in `db/index.js` after WAL mode.
**Warning signs:** Orphaned rows in `game_players` or `throws` with no matching game.

### Pitfall 7: Seed Runs Every Restart

**What goes wrong:** Seed script inserts players on every `npm start`, creating duplicate members.
**Why it happens:** Seed called unconditionally.
**How to avoid:** `db/seed.js` must check `SELECT COUNT(*) FROM players` first. Insert only if count === 0.
**Warning signs:** `GET /api/players` returns duplicate players after multiple restarts.

---

## Runtime State Inventory

> This is a greenfield phase — no existing runtime state.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no existing DB | Create new DB on first start |
| Live service config | None — no running server | Not applicable |
| OS-registered state | None | Not applicable |
| Secrets/env vars | None — `.env` file does not exist yet | Create from `.env.example` |
| Build artifacts | None | Not applicable |

**Nothing found in any category:** This is Phase 1 of a new project. No existing runtime state to migrate.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must create test infrastructure |
| Config file | None — see Wave 0 |
| Quick run command | `node --test server/game-types/*.test.js` (Node.js built-in test runner) |
| Full suite command | `node --test` (all `*.test.js` files) |

> Node.js 24.x has a stable built-in test runner (`node:test`). No external framework needed for pure function testing. [ASSUMED — based on training knowledge; verify with `node --test --help`]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-02 | `initState([p1,p2])` returns valid state for all 9 game types | unit | `node --test server/game-types/**.test.js` | ❌ Wave 0 |
| BACK-02 | `applyThrow(state, playerId, value)` mutates no input for all 9 types | unit | `node --test server/game-types/**.test.js` | ❌ Wave 0 |
| BACK-02 | `isFinished` returns true only when game is complete | unit | `node --test server/game-types/**.test.js` | ❌ Wave 0 |
| BACK-02 | `getFinalResults` returns correct winner for known input | unit | `node --test server/game-types/**.test.js` | ❌ Wave 0 |
| BACK-03 | Throw written to DB survives server restart | integration | `node --test server/db/**.test.js` | ❌ Wave 0 |
| AUTH-01 | POST /api/auth/login with correct PIN returns 200 + cookie | integration | `node --test server/routes/auth.test.js` | ❌ Wave 0 |
| AUTH-01 | POST /api/auth/login with wrong PIN returns 401 | integration | `node --test server/routes/auth.test.js` | ❌ Wave 0 |
| AUTH-02 | GET /tv returns 200 without session cookie | integration | `node --test server/routes/tv.test.js` | ❌ Wave 0 |
| BACK-01 | POST /api/players without session returns 401 | integration | `node --test server/routes/players.test.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test server/game-types/**.test.js`
- **Per wave merge:** `node --test`
- **Phase gate:** All tests green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/game-types/drei-vollen.test.js` — covers BACK-02 (simplest game, validates module interface)
- [ ] `server/game-types/fuchsjagd.test.js` — covers BACK-02 (most complex game, validates state machine)
- [ ] `server/db/db.test.js` — covers BACK-03 (throw persistence and crash recovery pattern)
- [ ] `server/routes/auth.test.js` — covers AUTH-01
- [ ] `server/routes/players.test.js` — covers BACK-01

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `bcryptjs.compare()` for PIN; `express-session` for state |
| V3 Session Management | Yes | `express-session` with `httpOnly`, `sameSite:strict`, `secure` in prod |
| V4 Access Control | Yes | `requireSession` middleware on all write routes |
| V5 Input Validation | Yes | Validate `pin`, `name`, `value` fields in routes; reject unexpected types |
| V6 Cryptography | No | PIN hashing via bcryptjs only; no custom crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PIN brute force | Elevation of Privilege | bcrypt hash (cost 10) makes brute force slow; club app accepts this risk |
| Session fixation | Elevation of Privilege | `req.session.regenerate()` on successful login |
| Unauthenticated write | Tampering | `requireSession` middleware on all POST/PUT/DELETE routes |
| SQLite injection | Tampering | `better-sqlite3` prepared statements with bound parameters — never string-interpolate SQL |
| UNIQUE constraint race | Tampering | DB-level `UNIQUE (game_id, player_id, throw_index)` returns 409 on duplicate |

> **Note on session fixation:** CONTEXT.md does not mention `req.session.regenerate()`. The planner must include it in the auth route task. It prevents a pre-auth session from being elevated to an authenticated session.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v24.15.0 | — |
| npm | Package install | ✓ | 11.12.1 | — |
| better-sqlite3 | App data layer | Not installed yet | 12.10.0 (available) | — |
| Git | Version control | ✓ (inferred) | — | — |

**Missing dependencies with no fallback:** None — all required tools are available.

**Note:** `better-sqlite3` requires a C++ build toolchain on install (node-gyp). On Windows (detected: win32), this requires Visual C++ Build Tools. If they are not installed, `npm install better-sqlite3` will fail.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express 4.x as default | Express 5.x is now default (`npm view express version` = 5.2.1) | Late 2024 / Early 2025 | Built-in async error forwarding; no `express-async-errors` needed |
| `express-async-errors` shim | Native Express 5 async errors | Express 5 stable | Remove from dependency list |
| `sqlite3` (async) | `better-sqlite3` (sync) | Ecosystem shift ~2018 | Synchronous API is more natural for SQLite; eliminates promise chains |

**Deprecated/outdated:**
- `express-async-errors`: Not needed with Express 5. CLAUDE.md's stack research was based on Express 4 assumptions.
- The pitfalls doc mentions `m4 express-async-errors (one line) + error middleware` as a Phase 1 task — this is for Express 4 only. With Express 5, only the error middleware is needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Express 5 handles async errors natively without `express-async-errors` | Standard Stack, Anti-Patterns | Would need to add `express-async-errors` shim; low risk, easy fix |
| A2 | Node.js 24's built-in `node:test` runner is sufficient for pure function unit tests | Validation Architecture | May need to install `jest` or `mocha`; minor effort |
| A3 | The 12 Pegelköpp member names/emojis are known only to the user — the seed file uses placeholder data from the HTML (`Anna`, `Ben`, `Clara`) | Standard Stack | User must update `db/seed.js` with actual member data before first use |
| A4 | `req.session.regenerate()` is supported in `express-session` 1.19.x | Security Domain | API may differ; verify during implementation |

---

## Open Questions

1. **Node-gyp / better-sqlite3 on Windows**
   - What we know: The dev machine runs Windows 10. `better-sqlite3` requires a native C++ build via node-gyp.
   - What's unclear: Whether Visual C++ Build Tools are installed.
   - Recommendation: Plan must include `npm install better-sqlite3` as a task with a verification step. If it fails, the fallback is to install Build Tools via `npm install -g windows-build-tools` or the VS Installer.

2. **Actual member names for seed data**
   - What we know: The HTML has placeholder players (Anna, Ben, Clara). CONTEXT.md says "12 Pegelköpp members."
   - What's unclear: The actual names and emojis.
   - Recommendation: `db/seed.js` should have a clearly marked `// TODO: replace with actual member data` comment. The planner should add a task that asks the user to fill in actual data.

3. **`better-sqlite3` vs `connect-sqlite3` DB path conflict**
   - What we know: `connect-sqlite3` stores sessions in `./data/sessions.db` (configured). App data goes to `./data/kegelclub.db`.
   - What's unclear: Whether `connect-sqlite3` will create the `data/` directory if it doesn't exist.
   - Recommendation: `db/index.js` should `fs.mkdirSync('./data', { recursive: true })` before opening either database.

---

## Sources

### Primary (HIGH confidence)
- npm registry (live queries) — all package versions and creation dates verified 2026-05-19
- `kegelclub_12.html` (project file, grepped 2026-05-19) — all 9 game type logic analyzed directly
- `.planning/phases/01-backend-foundation/01-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — prior stack research (HIGH confidence from that session)
- `.planning/research/PITFALLS.md` — pitfalls (HIGH confidence from that session)
- `.planning/research/ARCHITECTURE.md` — architecture (HIGH confidence from that session)
- `CLAUDE.md` — project directives (authoritative)

### Tertiary (LOW confidence / ASSUMED)
- Express 5 async error handling behavior [ASSUMED — not verified via official docs in this session]
- Node.js `node:test` built-in runner as sufficient test framework [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified live against npm registry
- Architecture: HIGH — locked in CONTEXT.md from prior research session
- Game type extraction: HIGH — logic read directly from `kegelclub_12.html` source
- Pitfalls: HIGH — sourced from prior research + new findings (Express 5, connect-sqlite3 deps)
- Test infrastructure: MEDIUM — Node built-in test runner assumed sufficient; not verified

**Research date:** 2026-05-19
**Valid until:** 2026-08-19 (90 days — stable stack, no fast-moving dependencies)
