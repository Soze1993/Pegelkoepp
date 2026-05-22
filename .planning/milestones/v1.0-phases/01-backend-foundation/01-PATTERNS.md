# Phase 1: Backend Foundation - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 22 new files
**Analogs found:** 22 / 22 (all from `kegelclub_12.html` JS source; no prior server-side code exists)

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `server/app.js` | config | request-response | RESEARCH.md Pattern 2 (session setup) | research-pattern |
| `server/server.js` | config | request-response | RESEARCH.md Pattern 1 (entry point) | research-pattern |
| `server/db/index.js` | config | CRUD | RESEARCH.md Pattern 1 (SQLite + WAL) | research-pattern |
| `server/db/schema.sql` | config | CRUD | CONTEXT.md § SQLite Schema | context-exact |
| `server/db/seed.js` | utility | CRUD | `kegelclub_12.html` line 243 (`mkSp` + player array) | role-match |
| `server/middleware/auth.js` | middleware | request-response | RESEARCH.md Pattern 4 (`requireSession`) | research-pattern |
| `server/routes/auth.js` | route | request-response | RESEARCH.md Pattern 3 (PIN auth) | research-pattern |
| `server/routes/players.js` | route | CRUD | `kegelclub_12.html` lines 268-271 (player add/list logic) | role-match |
| `server/routes/games.js` | route | CRUD | `kegelclub_12.html` lines 284-320 (game start + throw handling) | role-match |
| `server/game-types/index.js` | utility | transform | `kegelclub_12.html` line 242 (`S.typen` array) | role-match |
| `server/game-types/drei-vollen.js` | service | CRUD | `kegelclub_12.html` lines 318-320 (`dreiVollen` branch in `doNWurf`) | exact |
| `server/game-types/grosse-hausnummer.js` | service | CRUD | `kegelclub_12.html` lines 287, 318-322 (`hn()` + `grosseHaus` branch) | exact |
| `server/game-types/kleine-hausnummer.js` | service | CRUD | `kegelclub_12.html` lines 287, 318-322 (`kleineHaus` branch, Pudel=9) | exact |
| `server/game-types/plus-minus-mal.js` | service | CRUD | `kegelclub_12.html` lines 288, 318-322 (`pmCalc()` + `plusMinus` branch) | exact |
| `server/game-types/vier-gewinnt.js` | service | event-driven | `kegelclub_12.html` lines 328-336 (`startVG`, `doVGWurf`, `check4`) | exact |
| `server/game-types/fuchsjagd.js` | service | event-driven | `kegelclub_12.html` lines 343-348 (`startFJ`, `doFJWurf`, `endFJ`) | exact |
| `server/game-types/anker.js` | service | CRUD | `kegelclub_12.html` lines 354-359 (`startAnker`, `doAnkerWurf`, `endAnker`) | exact |
| `server/game-types/kegler-des-abends.js` | service | event-driven | `kegelclub_12.html` lines 365-368 (`startKDA`, `kdaSetWinner`) | exact |
| `server/game-types/bilderkegel.js` | service | CRUD | `kegelclub_12.html` lines 304-312 (`startBK`, `doBKWurf`, `endBK`) | exact |
| `.env.example` | config | — | RESEARCH.md D2 (PIN hash, session secret) | research-pattern |
| `package.json` | config | — | RESEARCH.md Standard Stack | research-pattern |
| `scripts/seed.js` | utility | CRUD | same as `server/db/seed.js` — see that entry | role-match |

---

## Pattern Assignments

### `server/db/index.js` (config, CRUD)

**Analog:** RESEARCH.md Pattern 1 — no prior server code exists; use research pattern verbatim.

**Core pattern** (RESEARCH.md lines 270-289):
```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/kegelclub.db');

// Create data dir if it doesn't exist (needed before connect-sqlite3 too)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

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

**Critical note:** `fs.mkdirSync` for `data/` directory must precede both `new Database()` and `connect-sqlite3` initialization (RESEARCH.md open question 3).

---

### `server/db/schema.sql` (config, CRUD)

**Analog:** CONTEXT.md § SQLite Schema — copy verbatim.

**Full schema** (CONTEXT.md lines 89-135):
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

### `server/db/seed.js` (utility, CRUD)

**Analog:** `kegelclub_12.html` line 243 — the `S.spieler` array and `mkSp()` function show the player data shape. Extract player objects from there.

**Player data shape from HTML** (line 240-243):
```javascript
// HTML source: mkSp(id, name, emoji) produces this shape:
// { id, name, emoji, spiele, siege, niederlagen, pts, best, wuerfe, pudel, ... }
// Server seed only needs: id (AUTOINCREMENT), name, emoji

// Server seed pattern (guard against duplicate seeding — Pitfall 7):
function seed(db) {
  const count = db.prepare('SELECT COUNT(*) as n FROM players').get().n;
  if (count > 0) return; // already seeded

  const insert = db.prepare('INSERT INTO players (name, emoji) VALUES (?, ?)');
  const insertMany = db.transaction((players) => {
    for (const p of players) insert.run(p.name, p.emoji);
  });

  // TODO: replace with actual Pegelköpp member names and emojis
  insertMany([
    { name: 'Anna',  emoji: '🌟' },
    { name: 'Ben',   emoji: '🔥' },
    { name: 'Clara', emoji: '🎯' },
    // ... 9 more members
  ]);
}
module.exports = seed;
```

**Key constraint:** Check `COUNT(*) === 0` before inserting. Use `better-sqlite3` transaction for atomic multi-row insert.

---

### `server/app.js` (config, request-response)

**Analog:** RESEARCH.md Patterns 2, 4, 6.

**Imports and session setup** (RESEARCH.md lines 297-314):
```javascript
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(cors({ origin: process.env.CORS_ORIGIN || false, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './data' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
```

**Route mounting pattern:**
```javascript
// Unauthenticated routes first (auth boundary from CONTEXT.md)
app.get('/tv', (req, res) => res.sendFile(path.join(__dirname, '../public/tv.html')));
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/games', require('./routes/games'));

// Error middleware — last (Express 5: async errors auto-forwarded, no wrapper needed)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
```

---

### `server/server.js` (config, request-response)

**Core pattern:**
```javascript
require('dotenv').config();
const http = require('http');
const app = require('./app');
const db = require('./db/index');
const seed = require('./db/seed');

seed(db); // runs only if players table is empty

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Pegelköpp server listening on port ${PORT}`);
});
```

---

### `server/middleware/auth.js` (middleware, request-response)

**Analog:** RESEARCH.md Pattern 4 — verbatim.

**Core pattern** (RESEARCH.md lines 342-347):
```javascript
function requireSession(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Authentication required' });
}
module.exports = requireSession;
```

---

### `server/routes/auth.js` (route, request-response)

**Analog:** RESEARCH.md Pattern 3 — extend with `session.regenerate()` (security requirement from RESEARCH.md Security Domain).

**Core pattern** (RESEARCH.md lines 325-334, extended):
```javascript
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { pin } = req.body;
  const hash = process.env.PIN_HASH;
  if (!pin || !hash) return res.status(400).json({ error: 'Bad request' });
  const ok = await bcrypt.compare(String(pin), hash);
  if (!ok) return res.status(401).json({ error: 'Falscher PIN' });
  // Regenerate session to prevent session fixation (RESEARCH.md Security Domain)
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.authenticated = true;
    res.json({ ok: true });
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/status
router.get('/status', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

module.exports = router;
```

---

### `server/routes/players.js` (route, CRUD)

**Analog:** `kegelclub_12.html` lines 268-271 — the `addSpieler`, `renderSpielerListe` functions show the data shape; port to REST handlers with `better-sqlite3` prepared statements.

**Player shape from HTML** (line 240):
```javascript
// HTML mkSp: { id, name, emoji, spiele, siege, niederlagen, pts, ... }
// Server: only stores id, name, emoji, archived, created_at
```

**Core CRUD pattern:**
```javascript
const { Router } = require('express');
const db = require('../db/index');
const requireSession = require('../middleware/auth');
const router = Router();

// GET /api/players — public, returns active players only
router.get('/', (req, res) => {
  const players = db.prepare('SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id').all();
  res.json(players);
});

// POST /api/players — requires session
router.post('/', requireSession, (req, res) => {
  const { name, emoji } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  const result = db.prepare('INSERT INTO players (name, emoji) VALUES (?, ?)').run(name.trim(), emoji || '🎳');
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), emoji: emoji || '🎳' });
});

// PUT /api/players/:id — requires session
router.put('/:id', requireSession, (req, res) => {
  const { name, emoji } = req.body;
  const info = db.prepare('UPDATE players SET name = ?, emoji = ? WHERE id = ? AND archived = 0').run(name, emoji, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// PUT /api/players/:id/archive — requires session (no hard delete per CONTEXT.md BACK-01)
router.put('/:id/archive', requireSession, (req, res) => {
  const info = db.prepare('UPDATE players SET archived = 1 WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
```

**Security note:** Always use `db.prepare(...).run(...)` with bound parameters — never string-interpolate SQL (RESEARCH.md Security Domain).

---

### `server/routes/games.js` (route, CRUD)

**Analog:** `kegelclub_12.html` lines 284-320 — `startGenSpiel`, `doNWurf`, `doFJWurf`, etc. show the game start and throw dispatch pattern.

**Game start pattern from HTML** (line 284):
```javascript
// HTML: sp = { id, datum, stid, stname, spieler: genSel.map(makeGP), aktSpIdx: 0, pmRunde: 1, done: false }
// Server: creates game row in DB, then calls gameModule.initState(players)
```

**Core route pattern:**
```javascript
const { Router } = require('express');
const db = require('../db/index');
const requireSession = require('../middleware/auth');
const gameTypes = require('../game-types/index');
const router = Router();

// In-memory active game states: Map<gameId, state>
// Reconstructed from DB on startup (CONTEXT.md C2 crash recovery)
const activeGames = new Map();

// POST /api/games — start a game
router.post('/', requireSession, (req, res) => {
  const { type_key, player_ids } = req.body;
  const module = gameTypes[type_key];
  if (!module) return res.status(400).json({ error: 'Unknown game type' });

  const players = player_ids.map(id =>
    db.prepare('SELECT id, name, emoji FROM players WHERE id = ? AND archived = 0').get(id)
  ).filter(Boolean);
  if (players.length !== player_ids.length) return res.status(400).json({ error: 'Invalid player_ids' });

  const gameRow = db.prepare('INSERT INTO games (type_key) VALUES (?)').run(type_key);
  const gameId = gameRow.lastInsertRowid;

  const insertGP = db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)');
  const insertAll = db.transaction(() => {
    players.forEach((p, i) => insertGP.run(gameId, p.id, i));
  });
  insertAll();

  const state = module.initState(players);
  activeGames.set(gameId, state);

  res.status(201).json({ id: gameId, type_key, status: 'active' });
});

// GET /api/games/:id — get current state (reconstructed if not in memory)
router.get('/:id', (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });

  let state = activeGames.get(game.id);
  if (!state) state = reconstructState(game);  // crash recovery

  const module = gameTypes[game.type_key];
  res.json({
    game,
    state,
    finished: module.isFinished(state),
    results: module.isFinished(state) ? module.getFinalResults(state) : null
  });
});

// POST /api/games/:id/throws — submit a throw
router.post('/:id/throws', requireSession, (req, res) => {
  const { player_id, throw_index, value } = req.body;
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND status = ?').get(req.params.id, 'active');
  if (!game) return res.status(404).json({ error: 'Game not found or not active' });

  // Write to DB first — synchronous, crash-safe (CONTEXT.md BACK-03)
  try {
    db.prepare('INSERT INTO throws (game_id, player_id, throw_index, value) VALUES (?, ?, ?, ?)')
      .run(game.id, player_id, throw_index, value);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Duplicate throw' });
    throw e;
  }

  const module = gameTypes[game.type_key];
  let state = activeGames.get(game.id) || reconstructState(game);
  state = module.applyThrow(state, player_id, value);
  activeGames.set(game.id, state);

  if (module.isFinished(state)) {
    db.prepare('UPDATE games SET status = ?, finished_at = datetime(\'now\') WHERE id = ?').run('finished', game.id);
    activeGames.delete(game.id);
  }

  res.json({ state, finished: module.isFinished(state) });
});

function reconstructState(game) {
  const module = gameTypes[game.type_key];
  const players = db.prepare(
    'SELECT p.id, p.name, p.emoji FROM players p JOIN game_players gp ON p.id = gp.player_id WHERE gp.game_id = ? ORDER BY gp.seat'
  ).all(game.id);
  const throws = db.prepare('SELECT player_id, value FROM throws WHERE game_id = ? ORDER BY throw_index').all(game.id);
  let state = module.initState(players);
  for (const t of throws) {
    state = module.applyThrow(state, t.player_id, t.value);
  }
  return state;
}

module.exports = router;
module.exports.activeGames = activeGames;
module.exports.reconstructState = reconstructState;
```

---

### `server/game-types/index.js` (utility, transform)

**Analog:** `kegelclub_12.html` line 242-254 — `S.typen` array lists all 9 game type IDs. Port as a re-export map.

**Pattern:**
```javascript
module.exports = {
  'viergewinnt':      require('./vier-gewinnt'),
  'fuchsjagd':        require('./fuchsjagd'),
  'dreiVollen':       require('./drei-vollen'),
  'grosseHaus':       require('./grosse-hausnummer'),
  'kleineHaus':       require('./kleine-hausnummer'),
  'plusMinus':        require('./plus-minus-mal'),
  'anker':            require('./anker'),
  'kda':              require('./kegler-des-abends'),
  'bilderkegel':      require('./bilderkegel'),
};
```

**Note:** Keys must exactly match `type_key` values stored in the `games` table.

---

### `server/game-types/drei-vollen.js` (service, CRUD)

**Analog:** `kegelclub_12.html` lines 318-320 — `dreiVollen` branch in `doNWurf` + `endNSpiel`.

**Original HTML logic** (line 318 — `dreiVollen` branch):
```javascript
// doNWurf dreiVollen branch:
if(selK===0) akt.pudel++;
akt.wuerfe.push(selK);
if(akt.wuerfe.length>=3) advGenSp(sp);  // advance to next player

// endNSpiel (line 320):
var pts = sp.spieler.map(p => totPts(p, stid));  // totPts = wuerfe.reduce sum
var best = Math.max(...pts);
// updSp called for each player

// totPts (line 289):
return p.wuerfe.reduce((a,b) => a+b, 0);
```

**Server module (pure function extraction):**
```javascript
module.exports = {
  id: 'dreiVollen',
  name: 'Drei in die Vollen',

  initState(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, wuerfe: [], pudel: 0 })),
      aktSpIdx: 0,
      done: false
    };
  },

  applyThrow(state, playerId, value) {
    // Deep copy — never mutate input (RESEARCH.md Pitfall 2)
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players.find(x => x.id === playerId);
    if (!p) return s;
    if (value === 0) p.pudel++;
    p.wuerfe.push(value);
    if (p.wuerfe.length >= 3) {
      s.aktSpIdx++;
      if (s.aktSpIdx >= s.players.length) s.done = true;
    }
    return s;
  },

  isFinished(state) { return state.done; },

  getFinalResults(state) {
    const scores = state.players.map(p => ({
      playerId: p.id,
      score: p.wuerfe.reduce((a, b) => a + b, 0),
      pudel: p.pudel
    }));
    const best = Math.max(...scores.map(x => x.score));
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
```

---

### `server/game-types/grosse-hausnummer.js` (service, CRUD)

**Analog:** `kegelclub_12.html` lines 287, 318-322 — `hn()` helper + `grosseHaus` branch in `doNWurf`.

**Original HTML logic** (lines 287, 318):
```javascript
// hn helper (line 287):
function hn(slots) {
  if(slots.h===null||slots.z===null||slots.e===null) return null;
  return (slots.h*100) + (slots.z*10) + slots.e;
}

// grosseHaus branch doNWurf (line 318):
var val = hausWurf;
// grosseHaus: Pudel=0 (no substitution)
if(hausWurf===0) akt.pudel++;
akt.slots[hausSlot] = val;   // hausSlot is 'h','z','e'
sp.aktSpIdx++;
// All players rotate: after each player places one throw, rotate
// Finished when every player has all 3 slots filled
var allF = sp.spieler.every(p => p.slots.h!==null && p.slots.z!==null && p.slots.e!==null);

// endNSpiel grosseHaus winner (line 320):
var pts = sp.spieler.map(p => hn(p.slots) || 0);
var best = Math.max(...pts);  // highest number wins
```

**Server module — key difference from `drei-vollen`:** Each "throw" carries both a `value` AND a `slot` ('h'/'z'/'e'). The `value` parameter in `applyThrow` must encode both: use an object `{ value, slot }` or encode as metadata in the state. Recommend: `applyThrow(state, playerId, value, meta)` where `meta = { slot: 'h'|'z'|'e' }`.

```javascript
module.exports = {
  id: 'grosseHaus',
  name: 'Grosse Hausnummer',

  initState(players) {
    return {
      players: players.map(p => ({
        id: p.id, name: p.name, emoji: p.emoji,
        slots: { h: null, z: null, e: null }, pudel: 0
      })),
      aktSpIdx: 0,
      done: false
    };
  },

  // meta: { slot: 'h'|'z'|'e' }
  applyThrow(state, playerId, value, meta = {}) {
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players.find(x => x.id === playerId);
    if (!p || !meta.slot) return s;
    if (value === 0) p.pudel++;
    p.slots[meta.slot] = value;  // Pudel=0 for grosseHaus
    // Rotate to next player
    s.aktSpIdx++;
    if (s.aktSpIdx >= s.players.length) {
      s.aktSpIdx = 0;
      // Check all done
      const allFilled = s.players.every(x => x.slots.h !== null && x.slots.z !== null && x.slots.e !== null);
      if (allFilled) s.done = true;
    }
    return s;
  },

  isFinished(state) { return state.done; },

  getFinalResults(state) {
    const hn = s => s.h !== null && s.z !== null && s.e !== null ? (s.h*100 + s.z*10 + s.e) : 0;
    const scores = state.players.map(p => ({ playerId: p.id, score: hn(p.slots), pudel: p.pudel }));
    const best = Math.max(...scores.map(x => x.score));
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
```

---

### `server/game-types/kleine-hausnummer.js` (service, CRUD)

**Analog:** `kegelclub_12.html` lines 287, 318 — same as `grosseHaus` with two differences.

**Original HTML differences** (line 318):
```javascript
// kleineHaus branch — Pudel substitution = 9 (worst digit):
var val = hausWurf;
if(stid==='kleineHaus' && hausWurf===0) val = 9;

// Winner = lowest valid number (exclude zeros/nulls — line 320):
var valid = pts.filter(v => v > 0);
var best = valid.length ? Math.min(...valid) : 0;  // lowest wins
```

**Server module:** Copy `grosse-hausnummer.js` exactly, then change:
1. `applyThrow`: if `value === 0`, set slot to `9` (not `0`), and still increment `p.pudel`
2. `getFinalResults`: winner = lowest `hn()` score (excluding 0); use `Math.min`

---

### `server/game-types/plus-minus-mal.js` (service, CRUD)

**Analog:** `kegelclub_12.html` lines 288, 318-319 — `pmCalc()` + `plusMinus` branch.

**Original HTML logic:**
```javascript
// pmCalc (line 288):
function pmCalc(w) {
  if(!w||!w.length) return 0;
  var r = w[0];
  if(w.length>1) r += w[1];
  if(w.length>2) r -= w[2];
  if(w.length>3) r *= w[3];
  if(w.length>4) r = w[4]!==0 ? r/w[4] : r;
  return Math.round(r*100)/100;
}

// plusMinus branch doNWurf (line 318):
var pmR = sp.pmRunde || 1, wi = pmR-1, pmVal = selK;
if(selK === 0) {
  akt.pudel++;
  if(wi===2) pmVal = 9;        // W3 Pudel = 9
  else if(wi===3||wi===4) pmVal = 1;  // W4/W5 Pudel = 1
  else pmVal = 0;              // W1/W2 Pudel = 0
}
akt.wuerfe.push(pmVal);
sp.aktSpIdx++;
if(sp.aktSpIdx >= sp.spieler.length) {
  sp.aktSpIdx = 0;
  sp.pmRunde = (sp.pmRunde||1) + 1;
  if(sp.pmRunde > 5) { endNSpiel(sp); return; }
}
```

**Server module:**
```javascript
// Pudel substitution per round index (0-based):
// round 0 (W1): 0, round 1 (W2): 0, round 2 (W3): 9, round 3 (W4): 1, round 4 (W5): 1
const PUDEL_SUB = [0, 0, 9, 1, 1];

module.exports = {
  id: 'plusMinus',
  name: 'Plus/Minus/Mal/Geteilt',

  initState(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, wuerfe: [], pudel: 0 })),
      aktSpIdx: 0,
      pmRunde: 1,  // 1-5
      done: false
    };
  },

  applyThrow(state, playerId, value) {
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players.find(x => x.id === playerId);
    if (!p) return s;
    const roundIdx = s.pmRunde - 1;  // 0-based for PUDEL_SUB
    let storedVal = value;
    if (value === 0) {
      p.pudel++;
      storedVal = PUDEL_SUB[roundIdx];
    }
    p.wuerfe.push(storedVal);
    s.aktSpIdx++;
    if (s.aktSpIdx >= s.players.length) {
      s.aktSpIdx = 0;
      s.pmRunde++;
      if (s.pmRunde > 5) s.done = true;
    }
    return s;
  },

  isFinished(state) { return state.done; },

  getFinalResults(state) {
    function pmCalc(w) {
      if (!w.length) return 0;
      let r = w[0];
      if (w.length > 1) r += w[1];
      if (w.length > 2) r -= w[2];
      if (w.length > 3) r *= w[3];
      if (w.length > 4) r = w[4] !== 0 ? r / w[4] : r;
      return Math.round(r * 100) / 100;
    }
    const scores = state.players.map(p => ({ playerId: p.id, score: pmCalc(p.wuerfe), pudel: p.pudel }));
    const best = Math.max(...scores.map(x => x.score));
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
```

---

### `server/game-types/vier-gewinnt.js` (service, event-driven)

**Analog:** `kegelclub_12.html` lines 328-336 — `startVG`, `doVGWurf`, `check4`, `endVG`.

**Original HTML key logic:**
```javascript
// startVG: grid = Array(9 rows) of Array(9 cols) = null
// nr = Array(9).fill(8)  // next available row per column (8 = bottom, fills upward)
// tX / tO = team arrays; aktT = 'X'|'O'; iX/iO = team player index

// doVGWurf (line 332):
if(vgSel==='P') { /* Pudel: turn advances, no piece placed */ }
var col = vgSel;
if(sp.nr[col] < 0) { notify('Spalte voll!'); return; }
sp.grid[sp.nr[col]][col] = team;
sp.nr[col]--;
if(team==='X') { sp.iX++; sp.aktT='O'; } else { sp.iO++; sp.aktT='X'; }
// Check win or draw:
if(check4(grid,'X').size > 0) endVG(sp,'X');
else if(check4(grid,'O').size > 0) endVG(sp,'O');
else if(grid.every(row => row.every(c => c!==null))) endVG(sp,'U');

// check4 (line 330): checks horizontal, vertical, diagonal patterns
// Returns a Set of 'row,col' strings for the winning cells
function check4(grid, t) {
  var win = new Set(), N = 9;
  for(var r=0; r<N; r++) for(var c=0; c<N; c++) {
    if(grid[r][c]!==t) continue;
    // horizontal, vertical, diagonal-down-right, diagonal-down-left
    if(c+3<N && grid[r][c+1]===t && grid[r][c+2]===t && grid[r][c+3]===t) mk(...);
    // ... (3 more direction checks)
  }
  return win;
}
```

**Server module — state shape:**
```javascript
initState(players) {
  // Assign teams: first half → X, second half → O
  // Or accept teams in players array with p.team = 'X'|'O'
  return {
    grid: Array.from({ length: 9 }, () => Array(9).fill(null)),
    nr: Array(9).fill(8),   // next row index per column
    tX: players.filter(p => p.team === 'X').map(p => ({ ...p, throwCount: 0 })),
    tO: players.filter(p => p.team === 'O').map(p => ({ ...p, throwCount: 0 })),
    aktT: 'X',   // whose turn
    iX: 0, iO: 0,  // round-robin index per team
    done: false,
    winner: null  // 'X' | 'O' | 'draw' | null
  };
}
// applyThrow: value = column number 0-8, or -1 for Pudel
// check4 must be ported verbatim from HTML line 330
```

**Port `check4` verbatim** from HTML line 330 — it is a pure function with no DOM dependencies.

---

### `server/game-types/fuchsjagd.js` (service, event-driven)

**Analog:** `kegelclub_12.html` lines 343-348 — `startFJ`, `doFJWurf`, `endFJ`. This is the most complex state machine.

**Original HTML state shape** (line 343 `startFJ`):
```javascript
sp = {
  fuchs: { id, name, emoji, w: [], pudel: 0 },
  jaeger: [{ id, name, emoji, w: [], pudel: 0 }, ...],
  fp: 0,           // fox points (starts at 0, grows with start throws)
  phase: 'start',  // 'start' | 'jagd'
  startW: 0,       // start throws taken (target: 2)
  jIdx: 0,         // current hunter index
  jPhase: 'jaeger' // 'jaeger' | 'fuchs'  (whose sub-turn in jagd phase)
}
```

**Original HTML state machine** (line 345 `doFJWurf`):
```javascript
if(sp.phase === 'start') {
  sp.fuchs.w.push(n); sp.fp += n;
  sp.startW++;
  if(sp.startW >= 2) { sp.phase = 'jagd'; sp.jPhase = 'jaeger'; sp.jIdx = 0; }
} else {
  if(sp.jPhase === 'jaeger') {
    var j = sp.jaeger[sp.jIdx];
    j.w.push(n); sp.fp -= n;
    var jG = sp.jaeger.reduce((sum,jj) => sum+jj.w.length, 0);
    if(sp.fp <= 0) { endFJ(sp,'jaeger',j); return; }        // hunters win
    if(sp.jIdx >= sp.jaeger.length-1 && jG >= 6) { endFJ(sp,'fuchs',null); return; }  // fox escapes
    sp.jPhase = 'fuchs';
  } else {
    sp.fuchs.w.push(n); sp.fp += n;
    sp.jIdx++;
    if(sp.jIdx >= sp.jaeger.length) {
      var tot = sp.jaeger.reduce((sum,jj) => sum+jj.w.length, 0);
      if(tot >= 6) { endFJ(sp,'fuchs',null); return; }
      sp.jIdx = 0;
    }
    sp.jPhase = 'jaeger';
  }
}
```

**Critical for crash recovery (RESEARCH.md Pitfall 4):** State must reconstruct identically from throw history. The `throws` table stores `(player_id, throw_index, value)` — throw_index must encode the ordering across fox and hunters. Recommend: `throw_index` is a global monotonic counter per game (not per player). `applyThrow` advances the state machine deterministically from that sequence.

---

### `server/game-types/anker.js` (service, CRUD)

**Analog:** `kegelclub_12.html` lines 354-359 — `startAnker`, `doAnkerWurf`, `endAnker`.

**Original HTML state shape** (line 354 `startAnker`):
```javascript
sp = {
  maxRunden: maxR,       // configurable (default 3)
  spieler: [{ id, name, emoji, runden: [], pudel: 0 }],
  aktSpIdx: 0,
  aktRunde: 1,
  wurfNr: 0   // 0-4, up to 5 throws per player per round
}
```

**Original HTML throw logic** (line 355 `doAnkerWurf`):
```javascript
var p = sp.spieler[sp.aktSpIdx];
if(!p.runden[sp.aktRunde-1]) p.runden[sp.aktRunde-1] = [];
p.runden[sp.aktRunde-1].push(ankerPts);  // ankerPts = 0,1,2,3,4,5,10
if(ankerPts===0) p.pudel++;
sp.wurfNr++;
var rPts = p.runden[sp.aktRunde-1].reduce((a,b) => a+b, 0);
if(sp.wurfNr >= 5 || rPts >= 40) {   // round ends: 5 throws OR 40+ points
  sp.wurfNr = 0;
  sp.aktSpIdx++;
  if(sp.aktSpIdx >= sp.spieler.length) {
    sp.aktSpIdx = 0;
    sp.aktRunde++;
    if(sp.aktRunde > sp.maxRunden) { endAnker(sp); return; }
  }
}
```

**Key note:** `value` in `applyThrow` is 0, 1, 2, 3, 4, 5, or 10 (Anker point values, not raw pin count). The `initState` must accept `config = { maxRunden: 3 }` as a second parameter or embed it in the players array.

---

### `server/game-types/kegler-des-abends.js` (service, event-driven)

**Analog:** `kegelclub_12.html` lines 365-368 — `startKDA`, `kdaSetWinner`.

**Original HTML state shape** (line 366 `startKDA`):
```javascript
sp = {
  spieler: [shuffled players],
  matches: [{ id, p1, p2, winner, loser, bracket: 'W'|'L', round, done }],
  mid: counter,      // next match id
  wRound: 1,
  bye: player|null,  // player with no match this round
  gewinner: null
}
```

**Original HTML match resolution** (line 367 `kdaSetWinner`):
```javascript
// Count losses per player from all done matches
// If one player has losses < 2, they remain
// If remaining === 1: tournament over
// Else: build next round matches from remaining players (shuffled)
// Note: no throw values — just win/loss declarations
```

**Key difference for server:** `applyThrow` signature doesn't fit well for KDA (no throw values). Use `value = winnerId` — the "throw value" is actually the winner's player ID. `applyThrow(state, matchId, winnerId)` where `matchId` acts as `playerId`.

---

### `server/game-types/bilderkegel.js` (service, CRUD)

**Analog:** `kegelclub_12.html` lines 303-312 — `BK_BILDER`, `startBK`, `doBKWurf`, `endBK`.

**Original HTML state shape** (line 306 `startBK`):
```javascript
sp = {
  spieler: [{ id, name, emoji, bildPts: [null,null,null,null,null], wuerfe: [[],[],[],[],[]], pudel: 0 }],
  aktSpIdx: 0,
  aktBildIdx: 0,   // which of 5 pictures (0-4)
  aktWurfNr: 0     // 0 or 1 (2 throws per picture per player)
}
// BK_BILDER (line 303):
const BK_BILDER = [
  { id:'volle', name:'Volle', pins:[1,2,3,4,5,6,7,8,9] },
  { id:'kleeblatt', name:'Kleeblatt', pins:[2,3,4,6,7,8,9] },
  { id:'hint_kranz', name:'Hint. Kranz', pins:[4,6,7,8,9] },
  { id:'damen', name:'Damen', pins:[2,3,7,8] },
  { id:'bauern', name:'Bauern', pins:[4,6] }
];
```

**Original HTML throw logic** (line 308 `doBKWurf`):
```javascript
var p = sp.spieler[sp.aktSpIdx];
if(bkK===0) p.pudel++;
p.wuerfe[sp.aktBildIdx].push(bkK);
sp.aktWurfNr++;
if(sp.aktWurfNr >= 2) {
  p.bildPts[sp.aktBildIdx] = p.wuerfe[sp.aktBildIdx].reduce((a,b)=>a+b,0);
  sp.aktWurfNr = 0;
  sp.aktSpIdx++;
  if(sp.aktSpIdx >= sp.spieler.length) {
    sp.aktSpIdx = 0;
    sp.aktBildIdx++;
    if(sp.aktBildIdx >= BK_BILDER.length) { endBK(sp); return; }
  }
}
```

**endBK winner/loser** (line 310):
```javascript
// winner = highest total; zahler (payer) = lowest total
var tots = sp.spieler.map(p => bkTotal(p));  // bkTotal = sum of bildPts
var maxP = Math.max(...tots), minP = Math.min(...tots);
sp.zahler = sp.spieler.filter(p => bkTotal(p) === minP)[0];
sp.gewinner = sp.spieler.filter(p => bkTotal(p) === maxP)[0];
```

**getFinalResults** must include both `winner` (most points) and `payer` (fewest points) flags.

---

## Shared Patterns

### Deep-Copy Pattern (CRITICAL — applies to all 9 game-type modules)

**Source:** RESEARCH.md Pitfall 2
**Apply to:** Every `applyThrow()` function in all 9 game-type modules

```javascript
// First line of every applyThrow:
const s = JSON.parse(JSON.stringify(state));
// ... mutate s only, never state ...
return s;
```

Never mutate the input `state` object. Crash recovery replays throws from DB — mutation causes score divergence between live game and replayed game.

---

### Prepared Statement Pattern (applies to all routes)

**Source:** RESEARCH.md Security Domain (SQLite injection)
**Apply to:** All `server/routes/*.js` files

```javascript
// CORRECT: bound parameters
db.prepare('SELECT * FROM players WHERE id = ?').get(id);
db.prepare('INSERT INTO throws (game_id, player_id, throw_index, value) VALUES (?, ?, ?, ?)').run(gameId, playerId, idx, val);

// WRONG: never do this
db.exec(`SELECT * FROM players WHERE id = ${id}`);
```

---

### Session Auth Guard (applies to all write routes)

**Source:** `server/middleware/auth.js`
**Apply to:** All `POST`, `PUT`, `DELETE` handlers in `server/routes/players.js` and `server/routes/games.js`

```javascript
const requireSession = require('../middleware/auth');
router.post('/', requireSession, (req, res) => { /* ... */ });
router.put('/:id', requireSession, (req, res) => { /* ... */ });
```

Do NOT apply `requireSession` to:
- `GET /api/players`
- `GET /api/games/:id`
- `GET /api/auth/status`
- `GET /tv`

---

### Synchronous DB Write Before Response (applies to throw handler)

**Source:** CONTEXT.md C2 + C3, RESEARCH.md BACK-03
**Apply to:** `POST /api/games/:id/throws` in `server/routes/games.js`

```javascript
// Write to DB synchronously BEFORE updating in-memory state
// better-sqlite3 is synchronous — no await needed
db.prepare('INSERT INTO throws ...').run(...);  // may throw UNIQUE error = 409
// Only THEN update activeGames Map
state = module.applyThrow(state, playerId, value);
activeGames.set(gameId, state);
```

---

### WAL + Foreign Keys Pragmas (applies to db/index.js only)

**Source:** CONTEXT.md C5, RESEARCH.md Pitfalls 1 and 6
**Apply to:** `server/db/index.js` — must be the first three operations after `new Database()`

```javascript
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');
```

---

### Seed Guard Pattern (applies to db/seed.js)

**Source:** RESEARCH.md Pitfall 7
**Apply to:** `server/db/seed.js`

```javascript
const count = db.prepare('SELECT COUNT(*) as n FROM players').get().n;
if (count > 0) return;  // already seeded — exit immediately
```

---

## No Analog Found

No files in Phase 1 have truly no analog — all patterns exist either in `kegelclub_12.html` or the RESEARCH.md pattern library. The following files have no exact analog in the JS source and rely entirely on research patterns:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `server/app.js` | config | request-response | No prior Express app exists; use RESEARCH.md Pattern 2 verbatim |
| `server/server.js` | config | request-response | No prior HTTP server; use RESEARCH.md Pattern 1 verbatim |
| `server/middleware/auth.js` | middleware | request-response | No prior middleware; use RESEARCH.md Pattern 4 verbatim |
| `.env.example` | config | — | Static template; use RESEARCH.md D2 for field names |

---

## Metadata

**Analog search scope:** `C:/Users/tobia/Claude/kegelclub_12.html` (single source file, lines 236-376 — the `<script>` block)
**Files scanned:** 1 (the entire JS logic lives in one file)
**Pattern extraction date:** 2026-05-19
**HTML file line count:** 377 total; JS logic: lines 236-376
