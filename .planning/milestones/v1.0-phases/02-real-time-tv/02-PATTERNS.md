# Phase 2: Real-Time & TV — Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/server.js` | config/entry | request-response | `server/server.js` (current) | exact — modify in place |
| `server/app.js` | config/middleware | request-response | `server/app.js` (current) | exact — modify in place |
| `server/db/index.js` | config/migration | CRUD | `server/db/db.test.js` (ALTER TABLE) + `server/db/index.js` (current) | exact — modify in place |
| `server/routes/games.js` | route/controller | CRUD + event-driven | `server/routes/games.js` (current) | exact — modify in place |
| `server/routes/games.test.js` | test | CRUD | `server/routes/games.test.js` (current) | exact — extend in place |
| `server/routes/socket.test.js` | test | event-driven | `server/routes/games.test.js` + `server/routes/auth.test.js` | role-match (same test scaffold, new event-driven assertions) |
| `public/tv.html` | component/view | event-driven | `kegelclub_12.html` (theme) + `public/tv.html` (current placeholder) | partial — full replace using theme from kegelclub_12.html |
| `public/tv.js` | client/service | event-driven | `kegelclub_12.html` inline JS (pattern only — no analog file) | no analog (first Socket.io client file) |

---

## Pattern Assignments

### `server/server.js` (config/entry — add Socket.io init)

**Analog:** `server/server.js` (current, lines 1–26)

**Current full file** (lines 1–26):
```javascript
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });

const http = require('http');
const app = require('./app');
const db = require('./db');
const seed = require('./db/seed');
const { rebuildActiveGames } = require('./routes/games');

seed(db);
rebuildActiveGames(db);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  const active = require('./routes/games').activeGames.size;
  console.log(`Pegelköpp server listening on port ${PORT} (${active} active game(s) recovered)`);
});
```

**Socket.io init pattern to ADD** (insert between `http.createServer(app)` and `server.listen`):
```javascript
// ADD these imports at the top of the file (after existing requires):
const { Server } = require('socket.io');

// ADD after `const server = http.createServer(app);`:
const io = new Server(server, {
  cors: { origin: false }  // TV page served from same Express server — no CORS needed
});
app.locals.io = io;

io.on('connection', (socket) => {
  // Find most recently started active game (D-10: highest id where status='active')
  const activeGame = db.prepare(
    "SELECT id FROM games WHERE status = 'active' ORDER BY id DESC LIMIT 1"
  ).get();

  if (activeGame) {
    const { activeGames, reconstructState } = require('./routes/games');
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(activeGame.id);
    const state = activeGames.get(activeGame.id) || reconstructState(game);
    socket.join(`game:${activeGame.id}`);
    socket.emit('game:state', { gameId: activeGame.id, state, idle: false });
  } else {
    // Idle screen: query last finished game for winner display (D-04)
    const lastGame = db.prepare(
      "SELECT id FROM games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT 1"
    ).get();
    // lastWinner: null if no games exist yet (fallback text in TV client)
    socket.emit('game:state', { idle: true, lastWinner: null /* TODO: query winner name */ });
  }
});
```

**Key constraint:** `app.locals.io = io` must be set BEFORE `server.listen` but AFTER `http.createServer(app)`. `io.on('connection')` handler requires `db` (already imported at line 13) and re-requires `routes/games` to avoid circular import at module load time.

---

### `server/app.js` (config/middleware — update Helmet CSP)

**Analog:** `server/app.js` (current, lines 1–60)

**Current Helmet line** (line 17):
```javascript
app.use(helmet());
```

**Replace with** (Helmet CSP update for WebSocket connect-src):
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'connect-src': ["'self'", 'ws:', 'wss:']
    }
  }
}));
```

**Why:** Helmet 8 `connect-src 'self'` does NOT cover `ws:` or `wss:`. Socket.io WebSocket upgrades are silently blocked without this change. `ws:` covers dev HTTP, `wss:` covers production HTTPS/nginx. All other Helmet defaults remain unchanged.

**All other middleware lines stay identical** (lines 9–60). No other changes to `app.js`.

---

### `server/db/index.js` (config/migration — add ALTER TABLE)

**Analog:** `server/db/index.js` (current, lines 1–23) + `server/db/db.test.js` idempotency pattern

**Current full file** (lines 1–23):
```javascript
'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/kegelclub.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// CRITICAL: WAL mode must be set as the very first pragma
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// Run schema on startup — idempotent via CREATE TABLE IF NOT EXISTS
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
```

**Migration block to ADD** (insert between `db.exec(schema)` and `module.exports = db`):
```javascript
// Phase 2 schema migrations — idempotent (D-12, D-13)
// SQLite does not support ADD COLUMN IF NOT EXISTS; try/catch swallows duplicate-column errors.
const migrations = [
  'ALTER TABLE throws ADD COLUMN meta TEXT NULL',
  'ALTER TABLE game_players ADD COLUMN role TEXT NULL'
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

**Ordering constraint:** Migrations run AFTER `db.exec(schema)` (schema creates tables) and BEFORE `module.exports = db` (so the columns exist before any route handler imports `db`).

---

### `server/routes/games.js` (route/controller — 4 changes)

**Analog:** `server/routes/games.js` (current, lines 1–207)

#### Change 1: Update INSERT throws to persist meta (line 112, inside POST /:id/throws)

**Current line 111–113:**
```javascript
db.prepare(
  'INSERT INTO throws (game_id, player_id, throw_index, value) VALUES (?, ?, ?, ?)'
).run(game.id, player_id, throw_index, value);
```

**Replace with:**
```javascript
db.prepare(
  'INSERT INTO throws (game_id, player_id, throw_index, value, meta) VALUES (?, ?, ?, ?, ?)'
).run(game.id, player_id, throw_index, value, meta ? JSON.stringify(meta) : null);
```

#### Change 2: Add io.emit after throw (after line 124, inside POST /:id/throws)

**After `activeGames.set(game.id, newState)` (line 124) and before the isFinished block:**
```javascript
// Emit throw event to TV (D-11: 'throw:applied') — guarded so tests without io pass (Pitfall 3)
const io = req.app.locals.io;
if (io) {
  io.to(`game:${gameId}`).emit('throw:applied', { state: newState, finished });
}
```

**After game finish UPDATE (after line 130) when `finished === true`:**
```javascript
if (io) {
  io.to(`game:${gameId}`).emit('game:finished', { state: newState });
}
```

#### Change 3: Update reconstructState SELECT queries (lines 149–162)

**Current reconstructState player query (lines 149–152):**
```javascript
const players = db.prepare(
  'SELECT p.id, p.name, p.emoji FROM players p ' +
  'JOIN game_players gp ON p.id = gp.player_id ' +
  'WHERE gp.game_id = ? ORDER BY gp.seat'
).all(game.id);
```

**Replace with (adds `gp.role` for fuchsjagd — D-13):**
```javascript
const players = db.prepare(
  'SELECT p.id, p.name, p.emoji, gp.role FROM players p ' +
  'JOIN game_players gp ON p.id = gp.player_id ' +
  'WHERE gp.game_id = ? ORDER BY gp.seat'
).all(game.id);
```

**Current reconstructState throws query (lines 153–156):**
```javascript
const throws = db.prepare(
  'SELECT player_id, throw_index, value FROM throws ' +
  'WHERE game_id = ? ORDER BY throw_index ASC'
).all(game.id);
```

**Replace with (adds `meta`; fixes ordering to `id ASC` for undo correctness — D-13, Pitfall 2):**
```javascript
const throws = db.prepare(
  'SELECT player_id, throw_index, value, meta FROM throws ' +
  'WHERE game_id = ? ORDER BY id ASC'
).all(game.id);
```

**Current applyThrow call in loop (line 159):**
```javascript
state = gameModule.applyThrow(state, t.player_id, t.value);
```

**Replace with (parse meta — D-13):**
```javascript
const parsedMeta = t.meta ? JSON.parse(t.meta) : undefined;
state = gameModule.applyThrow(state, t.player_id, t.value, parsedMeta);
```

#### Change 4: Add POST /:id/undo endpoint (new route, add after POST /:id/throws block)

**DB-first delete + reconstructState + emit pattern** (mirrors existing POST /:id/throws structure):
```javascript
// ---------------------------------------------------------------------------
// POST /api/games/:id/undo — delete last throw, recompute state (D-08)
// Requires session (same auth boundary as throws). DB-first ordering.
// ---------------------------------------------------------------------------
router.post('/:id/undo', requireSession, (req, res) => {
  const gameId = Number(req.params.id);

  const game = db.prepare("SELECT * FROM games WHERE id = ? AND status = 'active'").get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found or not active' });

  // ORDER BY id DESC — id is AUTOINCREMENT so highest id = most recently inserted throw
  const lastThrow = db.prepare(
    'SELECT id FROM throws WHERE game_id = ? ORDER BY id DESC LIMIT 1'
  ).get(gameId);

  if (!lastThrow) return res.status(400).json({ error: 'No throws to undo' });

  // DB-FIRST: delete before any in-memory mutation (CONTEXT.md C2)
  db.prepare('DELETE FROM throws WHERE id = ?').run(lastThrow.id);

  // Rebuild state from DB (correct — no stale in-memory state, includes meta)
  const newState = reconstructState(game);
  activeGames.set(gameId, newState);

  const gameModule = gameTypes[game.type_key];
  const finished = gameModule.isFinished(newState);

  // Silent TV update (D-07) — guarded so tests without io pass (Pitfall 3)
  const io = req.app.locals.io;
  if (io) io.to(`game:${gameId}`).emit('undo:applied', { state: newState, finished });

  res.json({ state: newState, finished });
});
```

**Note on `requireSession`:** Same import used on line 5; no new import needed. Same pattern as `router.post('/:id/throws', requireSession, ...)` on line 92.

---

### `server/routes/games.test.js` (test — extend with undo + meta tests)

**Analog:** `server/routes/games.test.js` (current, lines 1–655)

**Test scaffold to copy exactly** (lines 1–84 — before/after hooks and helpers):

All new test cases (GT16+) follow the exact same structure as GT8–GT15:
1. Call `loginAndGetCookie()` helper (lines 89–100)
2. Create a game via `fetch POST /api/games` with `{ cookie }` header
3. Submit throws via `fetch POST /api/games/:id/throws`
4. Exercise the endpoint under test
5. Assert on HTTP status, response body, and DB state via direct `db.prepare(...).get()`

**New test structure to follow (mirror GT8 at lines 211–241):**
```javascript
// ---------------------------------------------------------------------------
// GT16: POST /api/games/:id/undo without session → 401
// ---------------------------------------------------------------------------
test('GT16: POST /api/games/:id/undo without session returns 401', async () => {
  const res = await fetch(`${baseUrl}/api/games/1/undo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' }
    // no cookie
  });
  assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// GT17: POST /api/games/:id/undo with no throws → 400
// ---------------------------------------------------------------------------
test('GT17: POST /api/games/:id/undo on game with no throws returns 400', async () => {
  const cookie = await loginAndGetCookie();
  const createRes = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type_key: 'dreiVollen', player_ids: [1, 2] })
  });
  const { id: gameId } = await createRes.json();

  const res = await fetch(`${baseUrl}/api/games/${gameId}/undo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie }
  });
  assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// GT18: POST /:id/undo deletes last throw row from DB, returns corrected state
// ---------------------------------------------------------------------------
test('GT18: POST /api/games/:id/undo removes last throw and returns corrected state', async () => {
  const cookie = await loginAndGetCookie();
  const createRes = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type_key: 'dreiVollen', player_ids: [1, 2] })
  });
  const { id: gameId } = await createRes.json();

  // Submit 2 throws
  await fetch(`${baseUrl}/api/games/${gameId}/throws`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ player_id: 1, throw_index: 0, value: 5 })
  });
  await fetch(`${baseUrl}/api/games/${gameId}/throws`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ player_id: 1, throw_index: 1, value: 3 })
  });

  // Undo
  const undoRes = await fetch(`${baseUrl}/api/games/${gameId}/undo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie }
  });
  assert.equal(undoRes.status, 200);
  const undoBody = await undoRes.json();

  // State should reflect only the first throw (wuerfe: [5], not [5, 3])
  const player = undoBody.state.players.find(p => p.id === 1);
  assert.deepEqual(player.wuerfe, [5], `Expected wuerfe [5] after undo, got ${JSON.stringify(player.wuerfe)}`);

  // DB: only 1 throw row remains for this game
  const throwCount = db.prepare('SELECT COUNT(*) as n FROM throws WHERE game_id = ?').get(gameId).n;
  assert.equal(throwCount, 1, `Expected 1 throw in DB after undo, got ${throwCount}`);
});
```

**Meta persistence test to add (GT19+):**
Same pattern — create grosseHaus game, submit throw with `meta: { slot: 'h' }`, assert DB row has non-null `meta` column, undo, assert column is removed.

```javascript
// Verify meta is persisted to DB (check via direct db query, mirror GT8 DB assertion at line 238)
const throwRow = db.prepare('SELECT meta FROM throws WHERE game_id = ? ORDER BY id DESC LIMIT 1').get(gameId);
assert.ok(throwRow.meta, 'meta column should be non-null after throw with meta');
assert.deepEqual(JSON.parse(throwRow.meta), { slot: 'h' }, 'meta should match submitted slot');
```

---

### `server/routes/socket.test.js` (test — NEW FILE, Socket.io integration)

**Analog:** `server/routes/games.test.js` (lines 1–84, scaffold) + `server/routes/auth.test.js` (lines 1–53, before/after pattern)

**Key differences from games.test.js:**
1. `before()` creates the server WITH Socket.io attached (not bare `http.createServer(app)`)
2. Uses `socket.io-client` to connect a test socket in `before()`
3. Tests use `socket.on('event', cb)` + Promise wrappers to await events
4. `after()` calls `socket.disconnect()` before `server.close()`

**Full scaffold template (copy and extend):**
```javascript
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const bcrypt = require('bcryptjs');

const PIN = '1234';
const PIN_HASH = bcrypt.hashSync(PIN, 10);
process.env.PIN_HASH = PIN_HASH;

let tmpDir;
let server;
let io;           // Socket.io server instance
let socket;       // socket.io-client instance (TV-side)
let baseUrl;
let db;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-socket-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.SESSION_SECRET = 'test-secret-socket';
  process.env.NODE_ENV = 'test';
  process.env.SESSION_DIR = tmpDir;
  process.env.PIN_HASH = PIN_HASH;
  fs.mkdirSync(tmpDir, { recursive: true });

  // Clear module cache — same pattern as games.test.js lines 37–48
  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./games');
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');
  clearCache('../game-types/index');

  db = require('../db/index');
  const seed = require('../db/seed');
  seed(db);

  const app = require('../app');

  await new Promise((resolve) => {
    server = http.createServer(app);
    // Attach Socket.io to the test server (same as server.js production init)
    io = new Server(server, { cors: { origin: false } });
    app.locals.io = io;

    // Register connection handler (mirrors server.js io.on('connection') logic)
    io.on('connection', (connectedSocket) => {
      const activeGame = db.prepare(
        "SELECT id FROM games WHERE status = 'active' ORDER BY id DESC LIMIT 1"
      ).get();
      if (activeGame) {
        const { activeGames, reconstructState } = require('./games');
        const game = db.prepare('SELECT * FROM games WHERE id = ?').get(activeGame.id);
        const state = activeGames.get(activeGame.id) || reconstructState(game);
        connectedSocket.join(`game:${activeGame.id}`);
        connectedSocket.emit('game:state', { gameId: activeGame.id, state, idle: false });
      } else {
        connectedSocket.emit('game:state', { idle: true, lastWinner: null });
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;

      // Connect test client socket
      socket = ioClient(baseUrl, { transports: ['websocket'] });
      socket.on('connect', () => resolve());
    });
  });
});

after(async () => {
  socket.disconnect();
  io.close();
  await new Promise((resolve) => server.close(resolve));

  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  // ... same clearCache calls as before()
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

// Helper: await a socket event with a timeout
function waitForEvent(sock, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${eventName}'`)), timeoutMs);
    sock.once(eventName, (data) => { clearTimeout(timer); resolve(data); });
  });
}

// Helper: login and get session cookie (same as games.test.js lines 89–100)
async function loginAndGetCookie() {
  const { port } = server.address();
  const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: PIN })
  });
  const raw = r.headers.get('set-cookie');
  return raw.split(';')[0];
}
```

**Individual test pattern (event-driven — RT-01, TV-02):**
```javascript
// ST01: game:state emitted on connect when no active game (TV-04 idle path)
test('ST01: game:state { idle: true } emitted on connect when no active game', async () => {
  // No game exists in fresh DB — listen for game:state before connecting
  const newSocket = ioClient(baseUrl, { transports: ['websocket'] });
  const data = await waitForEvent(newSocket, 'game:state');
  assert.equal(data.idle, true, `Expected idle:true, got ${JSON.stringify(data)}`);
  newSocket.disconnect();
});

// ST02: throw:applied emitted after POST /api/games/:id/throws (RT-01)
test('ST02: throw:applied event emitted after submitting a throw', async () => {
  const cookie = await loginAndGetCookie();

  // Create game
  const createRes = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type_key: 'dreiVollen', player_ids: [1, 2] })
  });
  const { id: gameId } = await createRes.json();

  // Connect a fresh TV-side socket and wait for game:state (auto-subscribed on connect)
  const tvSocket = ioClient(baseUrl, { transports: ['websocket'] });
  await waitForEvent(tvSocket, 'game:state');

  // Listen for throw:applied BEFORE submitting the throw
  const eventPromise = waitForEvent(tvSocket, 'throw:applied');

  await fetch(`${baseUrl}/api/games/${gameId}/throws`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ player_id: 1, throw_index: 0, value: 5 })
  });

  const data = await eventPromise;
  assert.ok(data.state, 'throw:applied event should include state');
  tvSocket.disconnect();
});
```

---

### `public/tv.html` (component/view — full replace)

**Analog:** `kegelclub_12.html` (lines 1–79) for CSS variables and font conventions; `public/tv.html` (current) as base

**CSS variables to copy exactly** from `kegelclub_12.html` (lines 11–15):
```css
:root {
  --bg:  #0f0f14;
  --bg2: #17171f;
  --bg3: #1e1e28;
  --card: #22222e;
  --card2: #2a2a38;
  --ac:  #e8b84b;   /* gold accent */
  --ac2: #f5d37a;
  --txt: #f0ede6;
  --mut: #8884a0;
  --brd: #2e2e3e;
  --fh:  'Bebas Neue', sans-serif;  /* display/headings */
  --fb:  'DM Sans', sans-serif;     /* body */
}
```

**Font import approach** — use inline `@font-face` or local copy (NOT Google Fonts CDN) per Pitfall 4. The venue may have no internet. Self-host in `public/fonts/` or use a CSS fallback that maintains the TV-03 minimum sizes (72px scores, 36px names) in any system font.

**TV-specific structure** (D-01 full-width rows, D-02 active highlight, D-03 last throw column, D-04 idle screen):
```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pegelköpp — TV</title>
  <style>
    /* CSS variables from kegelclub_12.html :root block above */
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--txt);
      font-family: var(--fb); height: 100vh; overflow: hidden; }

    /* Idle screen (D-04) */
    #idle { display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100vh; }
    #idle .club-name { font-family: var(--fh); font-size: 15vw; color: var(--ac); }
    #idle .last-winner { font-size: 3vw; color: var(--mut); margin-top: 1rem; }

    /* Game screen */
    #game { display: none; padding: 2vw; }
    #game.active { display: block; }

    /* Player rows (D-01 full-width rows) */
    .player-row {
      display: flex; align-items: center; padding: 1.5vw 2vw;
      border-radius: 12px; margin-bottom: 1vw;
    }
    /* D-02: active player highlight — gold at 15% opacity */
    .player-row.active-player {
      background: rgba(232, 184, 75, 0.15);
    }
    .player-name {
      flex: 1; font-size: 36px;   /* TV-03 min 36px — hard requirement */
      font-family: var(--fh); letter-spacing: .06em;
    }
    .last-throw {           /* D-03 permanent "Letzter Wurf" column */
      width: 12vw; text-align: center; color: var(--mut); font-size: 24px;
    }
    .last-throw .label { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; }
    .last-throw .value { font-family: var(--fh); font-size: 36px; color: var(--txt); }
    .player-score {
      width: 12vw; text-align: right; font-family: var(--fh);
      font-size: 72px;   /* TV-03 min 72px — hard requirement */
      color: var(--ac);
    }

    /* Connection dot (RT-03) */
    .conn-dot { position: fixed; top: 1rem; right: 1rem; width: 14px; height: 14px;
      border-radius: 50%; background: #888; }
    .conn-dot.green { background: #4caf7d; }
    .conn-dot.red   { background: #e05252; }
  </style>
</head>
<body>
  <div class="conn-dot" id="connDot"></div>

  <div id="idle">
    <div class="club-name">Pegelköpp</div>
    <div class="last-winner" id="lastWinnerText">Noch kein Spiel gespielt</div>
  </div>

  <div id="game">
    <ul id="playerList" style="list-style:none;margin:0;padding:0;"></ul>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/tv.js"></script>
</body>
</html>
```

---

### `public/tv.js` (client/service — NEW FILE, no analog)

**No existing analog** — first Socket.io client file in the project.

**Patterns to follow:**
- `'use strict';` at top (project convention from all server files)
- `const socket = io();` — connects to same origin; `/socket.io/socket.io.js` is auto-served
- Connection indicator via `socket.on('connect')` / `socket.on('disconnect')` CSS class toggle
- All DOM updates use `element.textContent = ...` (NOT `innerHTML`) — XSS prevention per Security Domain

**Full client structure (from RESEARCH.md Pattern 3 + D-01–D-04 decisions):**
```javascript
'use strict';

const connDot      = document.getElementById('connDot');
const idleEl       = document.getElementById('idle');
const gameEl       = document.getElementById('game');
const playerListEl = document.getElementById('playerList');
const lastWinnerEl = document.getElementById('lastWinnerText');

const socket = io();  // same-origin; socket.io.js auto-served at /socket.io/socket.io.js

// Connection indicator (RT-03)
socket.on('connect',    () => { connDot.className = 'conn-dot green'; });
socket.on('disconnect', () => { connDot.className = 'conn-dot red';   });

// State events (D-09, D-11)
socket.on('game:state',    ({ idle, state, gameId, lastWinner }) => {
  if (idle) renderIdle(lastWinner);
  else renderGame(state);
});
socket.on('throw:applied', ({ state }) => renderGame(state));
socket.on('undo:applied',  ({ state }) => renderGame(state));   // D-07: silent re-render
socket.on('game:started',  ({ state }) => renderGame(state));
socket.on('game:finished', ({ state }) => renderGame(state));

function renderIdle(lastWinner) {
  gameEl.classList.remove('active');
  idleEl.style.display = 'flex';
  // textContent only — no innerHTML (XSS prevention)
  lastWinnerEl.textContent = lastWinner
    ? `Letzter Sieger: ${lastWinner}`
    : 'Noch kein Spiel gespielt';
}

function renderGame(state) {
  if (!state || !state.players) return;
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  // Re-render player list (D-01 full-width rows)
  playerListEl.innerHTML = '';  // safe: only appending text nodes below
  for (const player of state.players) {
    const li = document.createElement('li');
    li.className = 'player-row' + (isActivePlayer(state, player.id) ? ' active-player' : '');

    // Name (min 36px via CSS class)
    const nameEl = document.createElement('span');
    nameEl.className = 'player-name';
    nameEl.textContent = `${player.emoji} ${player.name}`;  // textContent — safe

    // Last throw (D-03 permanent column)
    const throwEl = document.createElement('div');
    throwEl.className = 'last-throw';
    const throwLabel = document.createElement('div');
    throwLabel.className = 'label';
    throwLabel.textContent = 'Letzter Wurf';
    const throwValue = document.createElement('div');
    throwValue.className = 'value';
    const lastThrow = player.wuerfe && player.wuerfe.length > 0
      ? player.wuerfe[player.wuerfe.length - 1]
      : '—';
    throwValue.textContent = lastThrow;  // textContent — safe

    // Score (min 72px via CSS class)
    const scoreEl = document.createElement('span');
    scoreEl.className = 'player-score';
    scoreEl.textContent = getScore(player);  // textContent — safe

    throwEl.appendChild(throwLabel);
    throwEl.appendChild(throwValue);
    li.appendChild(nameEl);
    li.appendChild(throwEl);
    li.appendChild(scoreEl);
    playerListEl.appendChild(li);
  }
}

// These helpers depend on game type; planner should define based on state shape
function isActivePlayer(state, playerId) {
  // state.aktSpIdx points to current player index; players array is ordered by seat
  if (state.aktSpIdx === undefined) return false;
  return state.players[state.aktSpIdx]?.id === playerId;
}

function getScore(player) {
  // dreiVollen uses wuerfe.length or sum; planner should confirm per game-type state shape
  return player.score !== undefined ? player.score : (player.wuerfe ? player.wuerfe.length : 0);
}
```

---

## Shared Patterns

### Authentication Guard (`requireSession`)
**Source:** `server/middleware/auth.js` (lines 1–13)
**Apply to:** `POST /api/games/:id/undo` — add as second argument to `router.post('/:id/undo', requireSession, ...)`
```javascript
// middleware/auth.js — full file
function requireSession(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Authentication required' });
}
```
Pattern: imported at top of `routes/games.js` (line 5) via `const requireSession = require('../middleware/auth')`. No change needed to the import — just use `requireSession` in the new route.

### Error Handling in Route Handlers
**Source:** `server/routes/games.js` (lines 109–117) — try/catch for DB errors
```javascript
try {
  db.prepare('INSERT INTO throws ...').run(...);
} catch (e) {
  if (e.message && e.message.includes('UNIQUE')) {
    return res.status(409).json({ error: 'Duplicate throw' });
  }
  throw e;  // re-throw unknown errors → Express 5 error middleware catches them
}
```
**Apply to:** Any new DB write in undo endpoint (DELETE is unlikely to throw on constraint, but guard `reconstructState` call if needed).

### DB-First Write Ordering
**Source:** `server/routes/games.js` comments at lines 90–91 and 107–108
```
// 3. INSERT into throws FIRST — synchronous + crash-safe
//    If UNIQUE constraint fires → 409 (no state mutation).
```
**Apply to:** `POST /api/games/:id/undo` — DELETE throws row BEFORE calling `reconstructState` or `activeGames.set`. Non-negotiable per CONTEXT.md C2.

### Global Error Handler (Express 5)
**Source:** `server/app.js` (lines 54–58)
```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
```
**Behavior:** In Express 5, async errors in route handlers are auto-forwarded without `next(err)`. Re-throwing unknown errors (via bare `throw e`) reaches this handler automatically.

### Test Isolation Pattern
**Source:** `server/routes/games.test.js` (lines 26–65)
```javascript
before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-socket-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  // ... set all env vars BEFORE any require() of app/db
  const clearCache = (mod) => { try { delete require.cache[require.resolve(mod)]; } catch (_) {} };
  clearCache('../db/index');  // ... clear all interdependent modules
  db = require('../db/index');
  const app = require('../app');
  server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => { ... resolve(); });
});
```
**Apply to:** `socket.test.js` — identical scaffold; only difference is attaching `new Server(server, ...)` and connecting `ioClient` before resolving.

### `'use strict';` + CommonJS Convention
**Source:** Every file in `server/` (lines 1 of games.js, app.js, auth.js, middleware/auth.js, db/index.js)
**Apply to:** All new files (`socket.test.js`, `tv.js`). No TypeScript, no ESM, no top-level await.

### io Guard in Route Handlers
**Source:** RESEARCH.md Pitfall 3 + Pattern 2
```javascript
const io = req.app.locals.io;
if (io) {
  io.to(`game:${gameId}`).emit('event:name', payload);
}
```
**Apply to:** All Socket.io emit calls in `routes/games.js` (throw handler, undo handler, game finish). Tests don't set `app.locals.io`; the guard keeps all 153+ existing tests green.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `public/tv.js` | client/service | event-driven | No Socket.io client JS files exist yet — first frontend Socket.io file in the project |

---

## Metadata

**Analog search scope:** `server/`, `server/routes/`, `server/db/`, `server/middleware/`, `public/`, `kegelclub_12.html`
**Files read:** 11 source files
**Pattern extraction date:** 2026-05-20
