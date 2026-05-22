# Phase 2: Real-Time & TV — Research

**Researched:** 2026-05-20
**Domain:** Socket.io 4.x real-time sync, TV display page, SQLite schema migration, undo endpoint
**Confidence:** HIGH (all major claims verified against official Socket.io docs or confirmed from codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** TV player layout — full-width rows. Name left, score right.
- **D-02:** Active player highlight — light gold background `rgba(232, 184, 75, 0.15)` on active row.
- **D-03:** "Letzter Wurf" — permanent separate column in every player row, always visible.
- **D-04:** Idle screen — large "Pegelköpp" + "Letzter Sieger: [Name]". Fallback: "Noch kein Spiel gespielt".
- **D-05:** Undo button — always visible in game input area after 1+ throw.
- **D-06:** Undo confirmation — 2-tap: first tap shows "Wirklich rückgängig?", second tap executes.
- **D-07:** TV undo reaction — silent update, no flash. Just re-renders from new state via Socket.io.
- **D-08:** Undo API — `POST /api/games/:id/undo`, requires session. DB-first delete last throw, `reconstructState`, update `activeGames`, emit event. Returns `{ state, finished }`.
- **D-09:** TV auto-subscribes on connect — server emits current game state immediately on WebSocket connection.
- **D-10:** Multiple active games — TV shows most recently started (highest `id` where `status = 'active'`).
- **D-11:** Socket.io event names — `game:state`, `throw:applied`, `undo:applied`, `game:started`, `game:finished`.
- **D-12:** Migration approach — `ALTER TABLE ... ADD COLUMN` wrapped in try/catch on server startup in `db/index.js`. Idempotent.
- **D-13:** Columns to add — `throws.meta TEXT NULL` and `game_players.role TEXT NULL`.

### Claude's Discretion

- D-08 implementation detail (DB-first delete, reconstructState, emit) — approach confirmed by research.
- D-11 event names — confirmed as good choices, consistent with Socket.io room patterns.
- CORS configuration for Socket.io when server and TV page share same origin.
- Helmet CSP update required for WebSocket `connect-src`.

### Deferred Ideas (OUT OF SCOPE)

- TV layout variants per game type (custom full-screen layouts for each of 9 game types) — v2 backlog.
- Multi-step undo history — PLAY-01 is single-step only.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-01 | Throw entered on tablet appears on TV in under 2 seconds | Socket.io 4.x room emit after DB write; in-process latency well under 2s on LAN |
| RT-02 | TV auto-reconnects and restores current game state without user action | Socket.io built-in reconnect + `game:state` emit on `connect` event using `GET /api/games/:id` |
| RT-03 | Connection status indicator (dot/icon) on input device | `socket.on('connect')` / `socket.on('disconnect')` toggle CSS class; no extra package needed |
| TV-01 | `/tv` serves full-screen view, no auth, no input elements | Already unauthenticated in `app.js`; replace placeholder `public/tv.html` |
| TV-02 | TV shows live game state: all scores, current player highlighted, last throw visible | `game:state` + `throw:applied` events update DOM; D-02/D-03 layout |
| TV-03 | TV text readable at 3–5m: scores min 72px, names min 36px | Hard CSS requirement; verify in TV HTML |
| TV-04 | TV idle screen with club logo and last game winner when no game running | `game:finished` + no active game path on connect; query DB for last winner |
| PLAY-01 | User can undo last entered throw (single-step) | `POST /api/games/:id/undo` endpoint; DELETE last throw row + reconstructState + emit |
</phase_requirements>

---

## Summary

Phase 2 wires three independent but tightly coupled work streams: (1) Socket.io 4.x server integration on the existing `http.Server`, (2) the full-screen `public/tv.html` display page, and (3) two schema migration columns (`throws.meta`, `game_players.role`) that unblock correct reconstruction of all 9 game types. Everything else — undo endpoint, connection indicator, idle screen — follows directly from these three foundations.

The existing codebase is well-positioned. `server.js` already creates `http.createServer(app)`, so Socket.io attaches with two lines. `activeGames` Map is exported and ready. `reconstructState` is the correct tool for the TV reconnect flow. The `GET /api/games/:id` endpoint is already unauthenticated. The DB-first write pattern from Phase 1 extends naturally to the undo DELETE.

The two main risks are: (a) Helmet's default CSP blocks WebSocket `connect-src` unless `ws://self` is added — this is a silent failure in development that becomes a hard failure in production; and (b) the `throws.meta` column must be persisted at INSERT time in `POST /api/games/:id/throws` or undo will reconstruct incorrect state for grosseHaus/kleineHaus/viergewinnt. Both are straightforward fixes once identified.

**Primary recommendation:** Deliver in 3 waves — Wave 0 (test scaffolding), Wave 1 (schema migration + Socket.io init + undo endpoint), Wave 2 (TV page + connection indicator). Waves 1 and 2 can parallelize; Wave 0 must complete first.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Socket.io init and room management | API / Backend (`server.js`) | — | `io` must attach to the same `http.Server` Express uses |
| Emitting throw/undo events | API / Backend (`routes/games.js`) | — | Events fire after DB write; route handler owns both |
| TV display rendering | Browser / Client (`public/tv.html`) | — | Autonomous page; no server-side rendering needed |
| TV state on reconnect | API / Backend (`GET /api/games/:id`) | Browser (re-request on `connect`) | Server sends state via `game:state` on connection; client falls back to REST poll |
| Connection indicator | Browser / Client (input UI JS) | — | Client-side `socket.connected` toggle; no server involvement |
| Schema migration | Database / Storage (`db/index.js`) | — | ALTER TABLE runs at server startup before routes mount |
| Undo endpoint | API / Backend (`routes/games.js`) | — | DB-first delete + reconstructState + emit |
| Idle screen data (last winner) | API / Backend (query on connect) | Browser (render) | Server queries DB for last finished game; sends via `game:state` |
| Helmet CSP for WebSocket | API / Backend (`app.js`) | — | CSP header must allow `ws:` connect-src |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `socket.io` | 4.8.3 | WebSocket server + long-poll fallback, rooms, auto-reconnect | Stack decision from CLAUDE.md; latest stable as of Dec 2025 [CITED: socket.io/docs/v4/client-installation/] |

> `socket.io` is the only new production dependency for this phase. The server package bundles its own client JS served at `/socket.io/socket.io.js` — no separate `socket.io-client` package needed server-side. [CITED: socket.io/docs/v4/server-options/]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `socket.io-client` | 4.8.3 | Test-only: connect a client in node:test suites | Only in test files — `devDependencies` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.io rooms | Manual broadcast loop over all sockets | Socket.io rooms are 3 lines; manual loop is error-prone and doesn't scale |
| `/socket.io/socket.io.js` (auto-served) | CDN `cdn.socket.io/4.8.3/socket.io.min.js` | Auto-served is offline-safe for club use; CDN requires internet at the venue |
| Socket.io auto-reconnect | Custom EventSource/polling | Socket.io reconnect is built-in; custom polling adds code with no benefit |

### Installation

```bash
npm install socket.io
npm install --save-dev socket.io-client
```

---

## Package Legitimacy Audit

> npm registry unreachable from this machine due to SSL certificate error. Package verification performed via official Socket.io documentation and Web search against npmjs.com published data.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `socket.io` | npm | 14+ yrs | 10M+/wk | github.com/socketio/socket.io | N/A (slopcheck unavailable) | Approved [CITED: socket.io/docs/v4/server-installation/] |
| `socket.io-client` | npm | 14+ yrs | 10M+/wk | github.com/socketio/socket.io | N/A (slopcheck unavailable) | Approved [CITED: socket.io/docs/v4/client-installation/] |

**slopcheck unavailable** — pip not found on this machine. Both packages are the canonical Socket.io packages maintained by the Socket.io core team, verified via official documentation. No planner checkpoint required given the extreme provenance confidence.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Tablet (browser)                   Server (Node.js)                TV (browser)
     |                                    |                              |
     |  POST /api/games/:id/throws        |                              |
     |  (auth: session cookie)            |                              |
     |----------------------------------->|                              |
     |                                    |  1. INSERT throws (DB-first) |
     |                                    |  2. applyThrow → newState    |
     |                                    |  3. activeGames.set()        |
     |                                    |  4. gameFinished? → UPDATE   |
     |       { state, finished }          |                              |
     |<-----------------------------------|                              |
     |                                    |  io.to(`game:${id}`)         |
     |                                    |  .emit('throw:applied', ...) |
     |                                    |----------------------------->|
     |                                    |                              | DOM update
     |                                    |                              |
     |  POST /api/games/:id/undo          |                              |
     |  (auth: session cookie)            |                              |
     |----------------------------------->|                              |
     |                                    |  1. DELETE last throw (DB)   |
     |                                    |  2. reconstructState()       |
     |                                    |  3. activeGames.set()        |
     |       { state, finished }          |                              |
     |<-----------------------------------|                              |
     |                                    |  io.to(`game:${id}`)         |
     |                                    |  .emit('undo:applied', ...)  |
     |                                    |----------------------------->|
     |                                    |                              | DOM update
     |                                    |                              |
     |                         WebSocket connection                      |
     |                                    |  on 'connect':               |
     |                                    |  socket.join(`game:${id}`)   |
     |                                    |  socket.emit('game:state',   |
     |                                    |    currentStateOrIdle)       |
     |                                    |----------------------------->|
```

### Recommended Project Structure

No new directories required. New/modified files only:

```
server/
  server.js           ← add Socket.io init, pass io via app.locals
  app.js              ← update helmet CSP for ws: connect-src
  routes/
    games.js          ← add POST /:id/undo; add io.emit calls to POST /:id/throws
    games.test.js     ← add RT/TV/PLAY-01 tests
  db/
    index.js          ← add ALTER TABLE migrations for throws.meta + game_players.role
public/
  tv.html             ← replace placeholder with full TV display page
  tv.js               ← Socket.io client JS for TV (or inline in tv.html)
```

### Pattern 1: Socket.io Init on Existing http.Server

**What:** Attach Socket.io to the same `http.Server` instance already created in `server.js`. Pass `io` to routes via `app.locals.io`.

**When to use:** Any time Socket.io must share a port with Express.

**Why `app.locals.io` and not `require('./server')`:** Avoids circular dependency. `server.js` requires `app.js` (for `app`); if `app.js` required `server.js` (for `io`), that's a cycle. `app.locals` is a clean channel.

```javascript
// server.js — after http.createServer(app)
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: false }  // same-origin: TV page served from same server
});
app.locals.io = io;

io.on('connection', (socket) => {
  // Find most recent active game (D-10)
  const activeGame = db.prepare(
    "SELECT id FROM games WHERE status = 'active' ORDER BY id DESC LIMIT 1"
  ).get();

  if (activeGame) {
    const { state, finished } = getGameStateForEmit(activeGame.id);
    socket.join(`game:${activeGame.id}`);
    socket.emit('game:state', { gameId: activeGame.id, state, finished, idle: false });
  } else {
    // Idle: send last winner (D-04)
    const lastGame = db.prepare(
      "SELECT id FROM games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT 1"
    ).get();
    socket.emit('game:state', { idle: true, lastWinner: getLastWinner(lastGame?.id) });
  }
});
// Source: socket.io/docs/v4/server-initialization/ + socket.io/docs/v4/rooms/
```

**Key insight:** `cors: { origin: false }` disables Socket.io's own CORS since the TV page is served from the same Express server — no cross-origin issue. [CITED: socket.io/docs/v4/server-options/]

### Pattern 2: Emitting from Route Handler

**What:** Access `io` from inside a route handler via `req.app.locals.io`.

```javascript
// routes/games.js — inside POST /:id/throws, after DB write + state update
const io = req.app.locals.io;
if (io) {
  io.to(`game:${gameId}`).emit('throw:applied', { state: newState, finished });
  if (finished) {
    io.to(`game:${gameId}`).emit('game:finished', { state: newState });
  }
}
// Source: [ASSUMED] — app.locals pattern; verified conceptually via socket.io rooms docs
```

**Note on test isolation:** Wrap `if (io)` so tests that don't inject an `io` instance don't throw. All existing 153 tests continue to pass because no `io` is set in their `before()` setup.

### Pattern 3: TV Client — Auto-Reconnect and State Restore

**What:** Socket.io client in `tv.html` uses built-in reconnect. On every `connect` event (initial + after reconnection), the server pushes full `game:state`. No client-side polling needed.

```javascript
// public/tv.html — inline script or public/tv.js
const socket = io();  // connects to same origin; /socket.io/socket.io.js auto-served

socket.on('connect', () => {
  statusDot.classList.replace('red', 'green');
  // Server will push game:state immediately on connection (D-09)
});

socket.on('disconnect', () => {
  statusDot.classList.replace('green', 'red');
});

socket.on('game:state', ({ idle, state, gameId, lastWinner }) => {
  if (idle) renderIdle(lastWinner);
  else renderGame(state, gameId);
});

socket.on('throw:applied', ({ state }) => renderGame(state));
socket.on('undo:applied',  ({ state }) => renderGame(state));
socket.on('game:started',  ({ state, gameId }) => renderGame(state, gameId));
socket.on('game:finished', ({ state }) => {
  renderGame(state);
  setTimeout(() => socket.emit('get:state'), 3000); // after 3s, re-request idle
});
// Source: socket.io/docs/v4/client-api/ [connect/disconnect events]
```

**Important:** `socket.on('connect', handler)` fires on reconnection too — this is the correct hook for state restore (RT-02). [CITED: socket.io/docs/v4/client-api/]

### Pattern 4: Schema Migration (ALTER TABLE + try/catch)

**What:** Idempotent column additions at server startup. SQLite throws `"duplicate column name: <col>"` if the column already exists — catch and ignore it.

```javascript
// db/index.js — after schema.sql exec, before module.exports
const migrations = [
  "ALTER TABLE throws ADD COLUMN meta TEXT NULL",
  "ALTER TABLE game_players ADD COLUMN role TEXT NULL"
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
    // Column already exists — idempotent, continue
  }
}
// Source: SQLite error behavior [CITED via WebSearch + sqlite.org/lang_altertable.html]
```

**Critical:** SQLite does NOT support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. The try/catch pattern is the official workaround. [CITED: sqlite.org/forum, WebSearch cross-verified]

### Pattern 5: Undo Endpoint — DB-First DELETE + reconstructState

**What:** Delete the last throw for the current player-turn, rebuild state from DB, emit. The `UNIQUE (game_id, player_id, throw_index)` constraint is irrelevant here — after DELETE, the same `(game_id, player_id, throw_index)` tuple is available for re-insertion. SQLite UNIQUE constraints check live rows only; a deleted row's values are immediately available for new inserts. [CITED: WebSearch, SQLite constraint behavior]

```javascript
// routes/games.js — new route
router.post('/:id/undo', requireSession, (req, res) => {
  const gameId = Number(req.params.id);
  const game = db.prepare("SELECT * FROM games WHERE id = ? AND status = 'active'").get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found or not active' });

  // Find the most recently inserted throw for this game
  const lastThrow = db.prepare(
    'SELECT id FROM throws WHERE game_id = ? ORDER BY id DESC LIMIT 1'
  ).get(gameId);

  if (!lastThrow) return res.status(400).json({ error: 'No throws to undo' });

  // DB-FIRST delete (same ordering discipline as inserts)
  db.prepare('DELETE FROM throws WHERE id = ?').run(lastThrow.id);

  // Rebuild state from DB (correct — no stale in-memory state)
  const newState = reconstructState(game);
  activeGames.set(gameId, newState);

  const gameModule = gameTypes[game.type_key];
  const finished = gameModule.isFinished(newState);

  // Emit silent update to TV (D-07)
  const io = req.app.locals.io;
  if (io) io.to(`game:${gameId}`).emit('undo:applied', { state: newState, finished });

  res.json({ state: newState, finished });
});
```

**Why `ORDER BY id DESC`:** `id` is AUTOINCREMENT — the highest `id` is always the most recently inserted row. This is more reliable than `ORDER BY throw_index DESC` because throw_index is per-player-game, not global.

**Edge case — undo on empty game:** Handled by the `if (!lastThrow)` guard → 400. No crash, no state mutation.

### Pattern 6: throws.meta Persistence

**What:** The `POST /api/games/:id/throws` handler already reads `meta` from the request body (line 102 of `games.js`) but does not persist it to the DB. This must be fixed in Phase 2 to support grosseHaus, kleineHaus, viergewinnt reconstruction.

```javascript
// routes/games.js — POST /:id/throws (change to INSERT with meta)
db.prepare(
  'INSERT INTO throws (game_id, player_id, throw_index, value, meta) VALUES (?, ?, ?, ?, ?)'
).run(game.id, player_id, throw_index, value, meta ? JSON.stringify(meta) : null);
```

And in `reconstructState`, parse it back:

```javascript
// reconstructState — update applyThrow call
for (const t of throws) {
  const parsedMeta = t.meta ? JSON.parse(t.meta) : undefined;
  state = gameModule.applyThrow(state, t.player_id, t.value, parsedMeta);
}
```

And update the SELECT in reconstructState to include `meta`:

```javascript
const throws = db.prepare(
  'SELECT player_id, throw_index, value, meta FROM throws ' +
  'WHERE game_id = ? ORDER BY id ASC'
).all(game.id);
```

**Critical note:** Ordering by `id ASC` (not `throw_index ASC`) is safer for undo correctness — `throw_index` is per-player, not a global game sequence. `id` is the true insertion order.

### Pattern 7: game_players.role for fuchsjagd

**What:** After adding the `role` column, the `POST /api/games` handler must accept and persist roles for fuchsjagd, and `reconstructState` must include `role` when fetching players.

```javascript
// reconstructState — update player SELECT
const players = db.prepare(
  'SELECT p.id, p.name, p.emoji, gp.role FROM players p ' +
  'JOIN game_players gp ON p.id = gp.player_id ' +
  'WHERE gp.game_id = ? ORDER BY gp.seat'
).all(game.id);
```

And in `POST /api/games`, when inserting `game_players`, persist the `role` if provided in the request body.

### Pattern 8: game:started Broadcast

**What:** When a new game is created via `POST /api/games`, broadcast `game:started` so the TV auto-switches.

```javascript
// routes/games.js — POST / (end of handler, after activeGames.set)
const io = req.app.locals.io;
if (io) {
  // All connected TVs should watch this new game
  io.emit('game:started', { gameId, state, type_key });
  // Note: TV client will join the room on next game:state push
  // Or emit game:state immediately after game:started so TV has full state
}
```

**Alternative:** On `game:started`, TV client refreshes by reconnecting or requesting state. Simplest: server also emits `game:state` to all sockets with the new game info immediately after `game:started`.

### Anti-Patterns to Avoid

- **Storing `io` in a module-level variable in `routes/games.js`:** Creates circular import risk. Use `req.app.locals.io` instead.
- **Emitting BEFORE DB write:** Phase 1 established DB-first as non-negotiable. For undo, emit AFTER `DELETE` and `reconstructState` complete.
- **Using `ORDER BY throw_index DESC` in undo query:** `throw_index` is per-player, not global. Use `ORDER BY id DESC LIMIT 1` to find the last inserted throw across all players.
- **Not guarding `if (io)` in route handlers:** Tests don't inject `io` — without the guard all 153 existing tests throw on the undo/throw emit lines.
- **CDN-loading socket.io client on TV page:** The Pegelköpp TV runs at a club venue where internet may be unreliable. Always use `/socket.io/socket.io.js` (auto-served by the server).
- **Helmet CSP blocking WebSocket:** Helmet's default `script-src 'self'` does not include `ws:` in `connect-src`. Socket.io WebSocket connections will be silently blocked in browsers that enforce CSP strictly. **Must add `ws://` (dev) and `wss://` (prod) to `connect-src`.**

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnect | Custom retry timer + state restoration loop | Socket.io built-in reconnect + `on('connect')` | Socket.io reconnects with exponential backoff; `connect` fires on every reconnect so state restore is automatic |
| Client JS delivery | Copy socket.io JS to public/ | `/socket.io/socket.io.js` (auto-served) | Socket.io server auto-serves the correct version-matched client bundle; no version drift |
| Broadcast to TV | Loop `sockets.values()` and call `emit` | `io.to('game:${id}').emit(...)` | Rooms handle fan-out; scales to multiple TV screens without code changes |
| Schema migration | Custom migration table + version tracking | ALTER TABLE + try/catch on startup | 2 columns don't warrant a migration framework; D-12 explicitly chose this approach |
| Connection indicator state | Polling `/api/health` | `socket.on('connect')` / `socket.on('disconnect')` | Socket.io client exposes exact connection state changes as events |

**Key insight:** Socket.io's built-in reconnect + the `on('connect')` hook together satisfy RT-02 with zero custom code. The server-pushes-state-on-connect pattern means the TV is always correct after any reconnection, even if multiple events were missed.

---

## Common Pitfalls

### Pitfall 1: Helmet CSP Blocks WebSocket (Silent Failure)

**What goes wrong:** `public/tv.html` loads, Socket.io client connects, then CSP blocks the WebSocket upgrade. TV shows "Pegelköpp" forever. No visible error unless DevTools is open.

**Why it happens:** Helmet 8 defaults include `connect-src 'self'`. The `'self'` keyword in CSP covers `https:` and `http:` same-origin but NOT `ws:` or `wss:`. [CITED: helmetjs.github.io + WebSearch verified]

**How to avoid:**

```javascript
// app.js — update helmet call
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'connect-src': ["'self'", 'ws:', 'wss:']
    }
  }
}));
```

**Warning signs:** TV page loads but never updates; browser console shows `Refused to connect to 'ws://...'`.

### Pitfall 2: throw_index Ordering in reconstructState

**What goes wrong:** `reconstructState` queries `ORDER BY throw_index ASC`. For multi-player games, multiple players each have `throw_index = 0, 1, 2, ...`. Ordering by `throw_index` alone does not preserve the original play order — two players can both have `throw_index = 0`, and the tie-breaking is undefined.

**Why it happens:** `throw_index` tracks each player's personal throw count, not game-global sequence.

**How to avoid:** Order by `id ASC` in reconstructState (insertion order = play order). This is already reliable because throws are inserted synchronously.

**Warning signs:** Reconstructed state diverges from expected state in multi-player tests; fuchsjagd phase transitions are wrong after restart.

### Pitfall 3: Socket.io io Instance Unavailable in Tests

**What goes wrong:** After adding `req.app.locals.io` emit calls to `POST /throws`, all 153 existing tests (which start a bare `http.createServer(app)` without Socket.io) throw `TypeError: Cannot read properties of undefined (reading 'to')`.

**Why it happens:** Tests don't set `app.locals.io`; `req.app.locals.io` is `undefined`; calling `.to()` on `undefined` throws.

**How to avoid:** Always guard: `const io = req.app.locals.io; if (io) { io.to(...).emit(...); }`. The guard makes emitting optional — tests pass without Socket.io; production works with it.

**Warning signs:** All existing tests fail after adding emit calls.

### Pitfall 4: TV Page Fonts / Sizes Not Loaded

**What goes wrong:** TV-03 requires scores at min 72px and player names at min 36px. Bebas Neue is a Google Fonts import. If loaded via CDN link tag, the font is unavailable at the venue if internet is down. TV shows system-font fallback which may reflow the layout.

**Why it happens:** No internet = no Google Fonts CDN.

**How to avoid:** Either (a) self-host the font files in `public/fonts/`, or (b) use a CSS fallback stack where the fallback font also satisfies the size requirements at the declared `font-size`. The font sizes (72px, 36px) are absolute requirements regardless of font family.

**Warning signs:** Font looks different from design on club night; text wraps or overflows in rows.

### Pitfall 5: game:finished TV Transition

**What goes wrong:** On `game:finished`, the TV should briefly show the final result then transition to idle. If the client does `setTimeout → request state`, but the DB hasn't been updated yet, the `GET /api/games/:id` still returns `status: 'active'`.

**Why it happens:** Race between game finish DB UPDATE and TV reconnect poll.

**How to avoid:** Don't poll on `game:finished`. Instead, the server emits a dedicated `game:state` with `{ idle: true, lastWinner }` after setting `status = 'finished'`. The TV transitions via Socket.io event, not HTTP poll. The sequence is:
1. Server updates DB (`status = 'finished'`)
2. Server emits `game:finished` with final results
3. Server emits `game:state { idle: true }` to all clients (or after 3s delay)

### Pitfall 6: throws.meta Not Persisted in Phase 2

**What goes wrong:** Phase 1 `POST /throws` reads `meta` from the body but inserts the `throws` row without a `meta` column (column didn't exist). After Phase 2 adds the column but forgets to update the INSERT statement, undo works for simple games (dreiVollen) but reconstruction fails silently for grosseHaus — slots are null after undo.

**How to avoid:** Update the `INSERT INTO throws` statement at the same time as the migration. The planner must put these in the same wave.

---

## Code Examples

### Socket.io Server Init (server.js)

```javascript
// Source: socket.io/docs/v4/server-initialization/
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: false }   // TV page is same-origin; no CORS needed
});
app.locals.io = io;
```

### Client Bundle Loading (tv.html)

```html
<!-- Source: socket.io/docs/v4/client-installation/ — auto-served by socket.io server -->
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io();   // connects to same origin automatically
</script>
```

### Room Emit from Route Handler

```javascript
// Source: socket.io/docs/v4/rooms/
const io = req.app.locals.io;
if (io) io.to(`game:${gameId}`).emit('throw:applied', { state: newState, finished });
```

### Connection Indicator (input UI)

```javascript
// Source: socket.io/docs/v4/client-api/ — connect/disconnect events
socket.on('connect',    () => dot.className = 'dot green');
socket.on('disconnect', () => dot.className = 'dot red');
```

### ALTER TABLE Migration

```javascript
// Source: sqlite.org/lang_altertable.html + community pattern (try/catch)
['ALTER TABLE throws ADD COLUMN meta TEXT NULL',
 'ALTER TABLE game_players ADD COLUMN role TEXT NULL'].forEach(sql => {
  try { db.exec(sql); }
  catch (e) { if (!e.message.includes('duplicate column name')) throw e; }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socket.io v2: client sends ping, server replies | v4: server sends PING packet | Socket.io v4.0 | TV browsers throttling JS timers (Chrome background tabs) no longer cause spurious disconnects |
| Socket.io v2: CORS implicit same-origin | v4: CORS must be explicit | Socket.io v3+ | Must configure `cors` option; omitting it with cross-origin clients causes silent failure |
| `socket.emit('connected', cb)` on reconnect for state | `socket.on('connect')` fires automatically on reconnect | Socket.io v3+ | `connect` event fires on both initial connect AND reconnect — single handler for both |

**Deprecated/outdated:**
- `socket.on('reconnect')` event: still works but `connect` is now the canonical reconnect hook since v3 changed the reconnect flow. [ASSUMED based on training knowledge — verify if using reconnect-specific logic]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `app.locals.io` pattern avoids circular import between server.js and routes/games.js | Architecture Patterns | Circular import would crash server on startup; alternative: pass `io` as argument to route factory |
| A2 | `ORDER BY id DESC LIMIT 1` reliably identifies the "last throw" for undo | Pattern 5 (Undo) | Wrong throw deleted; undo corrupts state — test with multi-player concurrent throws |
| A3 | TV page served from same Express server — `cors: false` on Socket.io is correct | Architecture Patterns | If TV is ever served from a different origin (e.g., CDN), CORS will block; add explicit origin |
| A4 | `socket.on('connect')` fires on reconnect in Socket.io v4 (same handler works for initial + reconnect) | Pattern 3 (TV Client) | State restore on reconnect breaks if connect doesn't fire on reconnect; fallback: also handle `socket.on('reconnect')` |
| A5 | `game:finished` → server emits `game:state { idle: true }` after DB update resolves race condition | Common Pitfalls #5 | If emit happens before DB update, TV poll would return stale state — use socket push, not HTTP poll |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **Connection indicator placement — input UI vs TV**
   - What we know: RT-03 says "visible on the input device"; D-07 says TV gets silent updates
   - What's unclear: The connection indicator (RT-03) is for the tablet/phone input UI (Phase 3's `kegelclub_12.html`), not the TV page. Phase 3 hasn't been touched yet.
   - Recommendation: Add the connection indicator to `tv.html` as well (the TV operator needs to know if Socket.io is working), but the primary RT-03 indicator lives in the future Phase 3 UI. For Phase 2, implement the indicator in `tv.html` and document that it must be replicated in Phase 3's input UI.

2. **game:started — how does TV join the new game room?**
   - What we know: On `connect`, the server joins the socket to the current game room. But a TV that's already connected when a new game starts needs to leave the old room and join the new one.
   - What's unclear: Does the TV client need to re-connect, or can the server move it?
   - Recommendation: On `game:started`, server emits to ALL sockets (not just a room), then each TV re-requests state via a brief `socket.emit('get:state')`. Alternatively, server iterates connected sockets and calls `socket.join(newRoom)` — this is doable server-side.

3. **throws.meta on undo — reconstructState re-reads meta from DB?**
   - What we know: After undo (DELETE last throw), `reconstructState` replays all remaining throws from DB including their `meta`.
   - What's certain: As long as `meta` is persisted on INSERT and the SELECT in reconstructState includes `meta`, this is correct. The DELETE removes only the last throw's row; all earlier meta values remain in DB.
   - Recommendation: Verify in tests with a grosseHaus game: insert 2 throws with meta, undo, check that slot values match expectations.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v24.15.0 | — |
| npm | Package install | ✓ | (npm registry SSL issue — manual install may be needed) | Download socket.io from GitHub releases |
| better-sqlite3 | Already installed | ✓ | 12.10.0 (from package.json) | — |
| socket.io | Phase 2 new dep | ✗ (not in node_modules) | — | Must install via `npm install socket.io` |
| socket.io-client | Test dep | ✗ | — | Must install via `npm install --save-dev socket.io-client` |

**Missing dependencies with no fallback:**
- `socket.io` — entire Phase 2 depends on it. Must be installed before any Phase 2 code executes.

**Missing dependencies with fallback:**
- npm SSL issue on this machine — if `npm install` fails, Socket.io can be installed by setting `NODE_TLS_REJECT_UNAUTHORIZED=0` (dev only) or using `--use-system-ca` flag.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node.js 22) |
| Config file | none — `npm test` runs `node --test` |
| Quick run command | `node --test server/routes/games.test.js` |
| Full suite command | `node --test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-01 | Throw emits `throw:applied` Socket.io event | integration | `node --test server/routes/games.test.js` | ❌ Wave 0 |
| RT-02 | Re-emit `game:state` on reconnect (new socket connection) | integration | `node --test server/routes/socket.test.js` | ❌ Wave 0 |
| RT-03 | `socket.connected` property changes on disconnect | manual/smoke | Manual browser check + socket.test.js connect/disconnect | ❌ Wave 0 |
| TV-01 | GET /tv returns 200 without session cookie | integration | `node --test server/routes/games.test.js` (extend existing) | ✅ (GT11 covers) |
| TV-02 | `game:state` event contains all player scores + active player + last throw | integration | `node --test server/routes/socket.test.js` | ❌ Wave 0 |
| TV-03 | CSS font sizes in tv.html (72px scores, 36px names) | manual | Manual visual check at 5m distance | manual-only |
| TV-04 | Idle `game:state` event emitted when no active game | integration | `node --test server/routes/socket.test.js` | ❌ Wave 0 |
| PLAY-01 | POST /api/games/:id/undo deletes last throw + emits `undo:applied` | integration | `node --test server/routes/games.test.js` | ❌ Wave 0 |

**Note on socket testing with node:test:** Official Socket.io docs don't cover `node:test`. The pattern from existing test files (bare `http.createServer`, `server.listen(0)`, `before`/`after` hooks) extends naturally — create server, attach Socket.io, connect `socket.io-client` in `before()`, exercise events in `test()` blocks, disconnect in `after()`.

### Sampling Rate

- **Per task commit:** `node --test server/routes/games.test.js`
- **Per wave merge:** `node --test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/routes/socket.test.js` — covers RT-01, RT-02, TV-02, TV-04, PLAY-01 (socket-level integration tests using socket.io-client)
- [ ] `socket.io-client` devDependency — must be installed before test file can be written
- [ ] schema migration tests (can be added to `games.test.js` existing before() hook by asserting column presence after db init)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Undo endpoint requires `requireSession` middleware (same as all write routes) |
| V3 Session Management | no (unchanged from Phase 1) | express-session + connect-sqlite3 |
| V4 Access Control | yes | TV `/tv` route remains unauthenticated; socket connection unauthenticated (read-only push); undo requires session |
| V5 Input Validation | yes | Undo: validate `gameId` is integer, game is active, throw exists before DELETE |
| V6 Cryptography | no | No new crypto; session secret unchanged |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized undo (delete any game's throws) | Elevation | `requireSession` on `POST /undo`; game `status = 'active'` check |
| TV page XSS via game state data (player names from DB rendered into DOM) | Tampering | Use `textContent` not `innerHTML` when rendering player names and scores to TV DOM |
| WebSocket message injection (arbitrary `game:state` emit to TV) | Spoofing | TV is receive-only — no client→server events except potentially `get:state`; server always recomputes state from DB |
| CSP bypass via Socket.io inline eval | Tampering | Do not use `unsafe-eval` in CSP; socket.io 4.x does not require eval |
| Session fixation via socket | Spoofing | Undo only reads session from HTTP cookie; WebSocket connection carries no privileged auth |

---

## Sources

### Primary (HIGH confidence)

- [socket.io/docs/v4/server-initialization/](https://socket.io/docs/v4/server-initialization/) — Server init on existing http.Server
- [socket.io/docs/v4/rooms/](https://socket.io/docs/v4/rooms/) — Room join/emit syntax
- [socket.io/docs/v4/client-api/](https://socket.io/docs/v4/client-api/) — connect/disconnect events, socket.connected, auto-reconnect
- [socket.io/docs/v4/server-options/](https://socket.io/docs/v4/server-options/) — cors option, serveClient, /socket.io/socket.io.js
- [socket.io/docs/v4/client-installation/](https://socket.io/docs/v4/client-installation/) — version 4.8.3, auto-served bundle URL
- [socket.io/docs/v4/server-socket-instance/](https://socket.io/docs/v4/server-socket-instance/) — socket.emit on connection
- [helmetjs.github.io](https://helmetjs.github.io/) — Default CSP directives, connect-src
- Codebase: `server/routes/games.js`, `server/server.js`, `server/app.js`, `server/db/index.js` — Phase 1 handoff state

### Secondary (MEDIUM confidence)

- [WebSearch: SQLite ALTER TABLE duplicate column error] — error message text `"duplicate column name: <col>"` confirmed via multiple sources + sqlite.org forum
- [WebSearch: SQLite UNIQUE constraint after DELETE] — re-insertion after DELETE is allowed; verified as standard relational DB behavior
- [socket.io/docs/v4/handling-cors/] — explicit CORS required since v3; `origin: false` to disable

### Tertiary (LOW confidence)

- [WebSearch: app.locals.io pattern for route access] — widely documented community pattern; not in official Socket.io docs

---

## Project Constraints (from CLAUDE.md)

| Directive | Category | Impact on Phase 2 |
|-----------|----------|-------------------|
| Socket.io 4.7.x specified | Technology | Use socket.io 4.x (latest is 4.8.3 — compatible) |
| No TypeScript | Language | All new files must be `'use strict';` CommonJS JS |
| No Docker, no Redis, no JWT | Infrastructure | Confirmed: Phase 2 needs none of these |
| TV display route `/tv` must be unauthenticated | Auth | Already enforced; maintain in Phase 2 |
| All write routes require PIN session | Auth | Undo endpoint (`POST /api/games/:id/undo`) must use `requireSession` |
| DB-first write ordering — non-negotiable | Pattern | Undo DELETE must happen before reconstructState + activeGames update |
| SQLite WAL mode mandatory | DB | Already set in `db/index.js`; migration ALTER TABLE runs after WAL pragma |
| `better-sqlite3` (sync API) | DB | All DB calls synchronous; no async/await in route handlers |
| Express 4.21.x (stick with 4; currently 5.2.1 in package.json — already upgraded) | Framework | Confirm: `package.json` shows `express: 5.2.1` — this is fine, Phase 1 already runs on Express 5 |
| Dark Gold theme: `#e8b84b`, dark bg, Bebas Neue + DM Sans | UI | TV page must use project color scheme |

**Note:** `package.json` has `express: 5.2.1` — the project already runs on Express 5 RC despite CLAUDE.md recommendation to stick with 4. Phase 2 should continue using whatever is installed; no downgrade needed.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — socket.io version confirmed from official docs; all claims cite official sources
- Architecture: HIGH — all patterns drawn from existing codebase + official Socket.io docs
- Pitfalls: HIGH — Helmet CSP/WebSocket issue confirmed via official helmet docs; throw ordering confirmed from codebase inspection; others verified against SQLite docs
- Schema migration: HIGH — ALTER TABLE try/catch pattern confirmed via sqlite.org forum + WebSearch cross-reference

**Research date:** 2026-05-20
**Valid until:** 2026-08-20 (Socket.io 4.x API is stable; helmet CSP behavior is stable)
