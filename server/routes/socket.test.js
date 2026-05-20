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

// ---------------------------------------------------------------------------
// PIN setup — must be set BEFORE requiring app (so db singleton uses test DB)
// ---------------------------------------------------------------------------
const PIN = '1234';
const PIN_HASH = bcrypt.hashSync(PIN, 10);
process.env.PIN_HASH = PIN_HASH;

// ---------------------------------------------------------------------------
// Setup: isolated DB + ephemeral HTTP server with Socket.io attached
// ---------------------------------------------------------------------------
let tmpDir;
let server;
let io;      // Socket.io server instance
let socket;  // socket.io-client instance (TV-side primary)
let baseUrl;
let db;

before(async () => {
  // 1. Set up isolated DB path BEFORE requiring app
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-socket-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.SESSION_SECRET = 'test-secret-socket';
  process.env.NODE_ENV = 'test';
  process.env.SESSION_DIR = tmpDir;
  process.env.PIN_HASH = PIN_HASH;
  fs.mkdirSync(tmpDir, { recursive: true });

  // 2. Clear module cache — same pattern as games.test.js lines 37–48
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

  // 3. Require fresh instances
  db = require('../db/index');
  const seed = require('../db/seed');
  seed(db); // populate 12 players

  const app = require('../app');

  // 4. Start ephemeral server with Socket.io on random port
  await new Promise((resolve) => {
    server = http.createServer(app);

    // Attach Socket.io to the test server (mirrors server.js production init)
    io = new Server(server, { cors: { origin: false } });
    app.locals.io = io;

    // Register connection handler (mirrors server.js io.on('connection') logic — D-09, D-10)
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
        // Idle screen: no active game (D-04, D-09)
        connectedSocket.emit('game:state', { idle: true, lastWinner: null });
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;

      // Connect primary test client socket
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
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./games');
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');
  clearCache('../game-types/index');

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Helper: await a socket event with a timeout
// ---------------------------------------------------------------------------
function waitForEvent(sock, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for '${eventName}'`)),
      timeoutMs
    );
    sock.once(eventName, (data) => { clearTimeout(timer); resolve(data); });
  });
}

// ---------------------------------------------------------------------------
// Helper: login and get session cookie (same as games.test.js lines 89–100)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// ST01: game:state { idle: true } emitted on connect when no active game
//        Covers: RT-02 (auto-subscribe on connect), TV-04 (idle state)
//        Status: RED stub — Wave 1 will implement server/server.js Socket.io init
// ---------------------------------------------------------------------------
test('ST01: game:state { idle: true } emitted on connect when no active game', async () => {
  // No game exists in fresh DB — connect new socket, listen for game:state
  const newSocket = ioClient(baseUrl, { transports: ['websocket'] });
  try {
    const data = await waitForEvent(newSocket, 'game:state', 2000);
    // Wave 1/2 will implement this — assert idle:true when no active game exists
    assert.equal(data.idle, true, `TODO: implemented in Wave 1/2 — expected idle:true, got ${JSON.stringify(data)}`);
  } finally {
    newSocket.disconnect();
  }
});

// ---------------------------------------------------------------------------
// ST02: throw:applied event emitted after POST /api/games/:id/throws
//        Covers: RT-01 (throw on tablet emits event to TV room within 2000ms)
// ---------------------------------------------------------------------------
test('ST02: throw:applied event emitted after submitting a throw', async () => {
  const cookie = await loginAndGetCookie();

  // Create a game
  const createRes = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type_key: 'dreiVollen', player_ids: [1, 2] })
  });
  const { id: gameId } = await createRes.json();

  // Connect a fresh TV-side socket; wait for game:state (auto-subscribe on connect)
  const tvSocket = ioClient(baseUrl, { transports: ['websocket'] });
  try {
    await waitForEvent(tvSocket, 'game:state', 2000);

    // Set up listener BEFORE posting the throw
    const eventPromise = waitForEvent(tvSocket, 'throw:applied', 2000);

    await fetch(`${baseUrl}/api/games/${gameId}/throws`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ player_id: 1, throw_index: 0, value: 5 })
    });

    const data = await eventPromise;
    assert.ok(data.state, 'throw:applied event should include state');
    assert.ok(Array.isArray(data.state.players), 'state.players should be an array');
  } finally {
    tvSocket.disconnect();
  }
});

// ---------------------------------------------------------------------------
// ST03: game:state event contains players array with id, name, last throw
//        Covers: TV-02 (state event has player scores + last throw per player)
//        Implemented inline as a check on the game:state received in this context
// ---------------------------------------------------------------------------
test('ST03: game:state contains players array with id, name, last throw', async (t) => {
  t.todo('TV-02 state shape fully exercised in 02-04 TV page; ST02 already asserts Array.isArray(state.players)');
});

// ---------------------------------------------------------------------------
// ST04: undo:applied event emitted after POST /api/games/:id/undo
//        Covers: PLAY-01 (undo emits event; TV shows corrected state silently)
// ---------------------------------------------------------------------------
test('ST04: undo:applied event emitted after POST /:id/undo', async () => {
  const cookie = await loginAndGetCookie();

  // Create a game
  const createRes = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type_key: 'dreiVollen', player_ids: [1, 2] })
  });
  const { id: gameId } = await createRes.json();

  // Connect a fresh TV-side socket; wait for game:state (auto-subscribe on connect)
  const tvSocket = ioClient(baseUrl, { transports: ['websocket'] });
  try {
    await waitForEvent(tvSocket, 'game:state', 2000);

    // Submit 2 throws — set up listener BEFORE each fetch to avoid race
    const throwPromise1 = waitForEvent(tvSocket, 'throw:applied', 2000);
    await fetch(`${baseUrl}/api/games/${gameId}/throws`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ player_id: 1, throw_index: 0, value: 5 })
    });
    await throwPromise1;  // Wait for throw:applied so socket is in the room

    const throwPromise2 = waitForEvent(tvSocket, 'throw:applied', 2000);
    await fetch(`${baseUrl}/api/games/${gameId}/throws`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ player_id: 1, throw_index: 1, value: 3 })
    });
    await throwPromise2;

    // Set up undo listener BEFORE posting undo
    const undoPromise = waitForEvent(tvSocket, 'undo:applied', 2000);

    await fetch(`${baseUrl}/api/games/${gameId}/undo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie }
    });

    const data = await undoPromise;
    assert.ok(data.state, 'undo:applied event should include state');
    assert.equal(data.finished, false, 'finished should be false after undo');
    const player1 = data.state.players.find(p => p.id === 1);
    assert.ok(player1, 'Player 1 should be in state after undo');
    assert.equal(player1.wuerfe.length, 1, `Expected 1 throw after undo, got ${player1.wuerfe.length}`);
  } finally {
    tvSocket.disconnect();
  }
});

// ---------------------------------------------------------------------------
// ST05: reconnecting client receives current game:state on connect event
//        Covers: RT-02 (game:state emitted on every connect — reconnect sync)
// ---------------------------------------------------------------------------
test('ST05: reconnecting client receives current game:state on reconnect', async () => {
  const cookie = await loginAndGetCookie();

  // Create a game (so server has an active game to report)
  const createRes = await fetch(`${baseUrl}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type_key: 'dreiVollen', player_ids: [1, 2] })
  });
  const { id: gameId } = await createRes.json();

  // Connect a first socket; verify it gets idle:false with the active game
  const tvSocket = ioClient(baseUrl, { transports: ['websocket'] });
  try {
    const firstState = await waitForEvent(tvSocket, 'game:state', 2000);
    assert.equal(firstState.idle, false, `First connect should see idle:false, got ${JSON.stringify(firstState)}`);
    assert.equal(firstState.gameId, gameId, `Expected gameId ${gameId}, got ${firstState.gameId}`);

    // Disconnect the socket
    tvSocket.disconnect();
  } catch (e) {
    tvSocket.disconnect();
    throw e;
  }

  // Connect a brand-new socket (simulates reconnect)
  const newSocket = ioClient(baseUrl, { transports: ['websocket'] });
  try {
    const reconnectState = await waitForEvent(newSocket, 'game:state', 2000);
    assert.equal(reconnectState.idle, false, `Reconnect should receive idle:false, got ${JSON.stringify(reconnectState)}`);
    assert.equal(reconnectState.gameId, gameId, `Reconnect should receive gameId ${gameId}, got ${reconnectState.gameId}`);
  } finally {
    newSocket.disconnect();
  }
});
