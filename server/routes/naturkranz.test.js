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
let io;
let socket;
let baseUrl;
let db;
let cookie;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-nk-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.SESSION_SECRET = 'test-secret-nk';
  process.env.NODE_ENV = 'test';
  process.env.SESSION_DIR = tmpDir;
  process.env.PIN_HASH = PIN_HASH;

  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./games');
  clearCache('./players');
  clearCache('./auth');
  clearCache('./naturkranz');
  clearCache('../middleware/auth');
  clearCache('../game-types/index');

  db = require('../db/index');
  require('../db/seed')(db);
  const app = require('../app');

  await new Promise((resolve) => {
    server = http.createServer(app);
    io = new Server(server, { cors: { origin: false } });
    app.locals.io = io;
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      socket = ioClient(baseUrl, { transports: ['websocket'] });
      socket.on('connect', () => resolve());
    });
  });

  const r = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: PIN })
  });
  cookie = r.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  socket.disconnect();
  io.close();
  await new Promise((resolve) => server.close(resolve));
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

function waitForEvent(sock, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${eventName}'`)), timeoutMs);
    sock.once(eventName, (data) => { clearTimeout(timer); resolve(data); });
  });
}

function api(method, url, body, withCookie = true) {
  const headers = { 'content-type': 'application/json' };
  if (withCookie) headers.cookie = cookie;
  const opts = { method, headers };
  if (body !== undefined) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  return fetch(baseUrl + url, opts);
}

async function startGame(playerIds) {
  const r = await api('POST', '/api/games', { type_key: 'dreiVollen', player_ids: playerIds });
  assert.equal(r.status, 201);
  return (await r.json()).id;
}

function nkCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM naturkranz').get().n;
}

function nkRow(id) {
  return db.prepare('SELECT * FROM naturkranz WHERE id = ?').get(id);
}

async function endAnyOpenAbend() {
  const open = db.prepare('SELECT id FROM abende WHERE ended_at IS NULL').all();
  for (const a of open) await api('POST', `/api/abende/${a.id}/end`);
}

// Fixture helpers (copied in spirit from stats.test.js)
function insertFinishedGame(typeKey, playerIds, abendId) {
  const r = db.prepare(
    "INSERT INTO games (type_key, status, finished_at, abend_id) VALUES (?, 'finished', datetime('now','localtime'), ?)"
  ).run(typeKey, abendId || null);
  const gid = Number(r.lastInsertRowid);
  playerIds.forEach((pid, i) => {
    db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(gid, pid, i);
  });
  return gid;
}

// ---------------------------------------------------------------------------
// NK01
// ---------------------------------------------------------------------------
test('NK01: POST /api/naturkranz without session answers 401 and inserts nothing', async () => {
  const before = nkCount();
  const r = await api('POST', '/api/naturkranz', { player_id: 1 }, false);
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'Authentication required');
  assert.equal(nkCount(), before);
});

// ---------------------------------------------------------------------------
// NK02
// ---------------------------------------------------------------------------
test('NK02: POST with session and game_id answers 201 and stores the row', async () => {
  const gameId = await startGame([1, 2]);
  const r = await api('POST', '/api/naturkranz', { player_id: 1, game_id: gameId });
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.ok(Number.isInteger(body.id));
  assert.equal(body.player_id, 1);
  assert.equal(body.game_id, gameId);
  assert.equal(body.abend_id, null);
  assert.equal(typeof body.created_at, 'string');
  const row = nkRow(body.id);
  assert.ok(row);
  assert.equal(row.player_id, 1);
  assert.equal(row.game_id, gameId);
});

// ---------------------------------------------------------------------------
// NK03
// ---------------------------------------------------------------------------
test('NK03: a Naturkranz leaves game state and throws untouched', async () => {
  const gameId = await startGame([1, 2]);
  const beforeRes = await (await fetch(`${baseUrl}/api/games/${gameId}`)).json();
  const throwsBefore = db.prepare('SELECT COUNT(*) AS n FROM throws WHERE game_id = ?').get(gameId).n;

  const r = await api('POST', '/api/naturkranz', { player_id: 1, game_id: gameId });
  assert.equal(r.status, 201);

  const afterRes = await (await fetch(`${baseUrl}/api/games/${gameId}`)).json();
  assert.deepEqual(afterRes.state, beforeRes.state);
  const throwsAfter = db.prepare('SELECT COUNT(*) AS n FROM throws WHERE game_id = ?').get(gameId).n;
  assert.equal(throwsAfter, throwsBefore);

  const t = await api('POST', `/api/games/${gameId}/throws`, { player_id: 1, throw_index: 0, value: 5 });
  assert.equal(t.status, 200);
});

// ---------------------------------------------------------------------------
// NK04
// ---------------------------------------------------------------------------
test('NK04: connected socket client receives naturkranz:changed (added)', async () => {
  const gameId = await startGame([1, 2]);
  const evPromise = waitForEvent(socket, 'naturkranz:changed');
  const r = await api('POST', '/api/naturkranz', { player_id: 2, game_id: gameId });
  assert.equal(r.status, 201);
  const ev = await evPromise;
  assert.equal(ev.action, 'added');
  assert.equal(ev.player_id, 2);
  assert.equal(ev.player_name, db.prepare('SELECT name FROM players WHERE id = 2').get().name);
  assert.equal(ev.game_id, gameId);
});

// ---------------------------------------------------------------------------
// NK05
// ---------------------------------------------------------------------------
test('NK05: validation answers 400/404 and inserts nothing', async () => {
  const gameId = await startGame([1, 2]);
  const before = nkCount();

  // no body at all
  const noBody = await fetch(baseUrl + '/api/naturkranz', { method: 'POST', headers: { cookie } });
  assert.equal(noBody.status, 400);

  for (const bad of [{}, { player_id: '1' }, { player_id: 0 }, { player_id: -3 }, { player_id: 1.5 }]) {
    const r = await api('POST', '/api/naturkranz', bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }

  const missing = await api('POST', '/api/naturkranz', { player_id: 999999 });
  assert.equal(missing.status, 404);

  db.prepare("INSERT INTO players (name, emoji, archived) VALUES ('Archiv', 'x', 1)").run();
  const archivedId = db.prepare("SELECT id FROM players WHERE name = 'Archiv'").get().id;
  const arch = await api('POST', '/api/naturkranz', { player_id: archivedId });
  assert.equal(arch.status, 404);

  for (const g of ['x', 0]) {
    const r = await api('POST', '/api/naturkranz', { player_id: 1, game_id: g });
    assert.equal(r.status, 400, 'game_id ' + g);
  }
  const noGame = await api('POST', '/api/naturkranz', { player_id: 1, game_id: 999999 });
  assert.equal(noGame.status, 404);

  const notIn = await api('POST', '/api/naturkranz', { player_id: 3, game_id: gameId });
  assert.equal(notIn.status, 400);
  assert.equal((await notIn.json()).error, 'player not in game');

  assert.equal(nkCount(), before);
});

// ---------------------------------------------------------------------------
// NK06
// ---------------------------------------------------------------------------
test('NK06: abend linking from game, open abend and none', async () => {
  await endAnyOpenAbend();
  const ar = await api('POST', '/api/abende', { name: 'NK06 Abend' });
  assert.equal(ar.status, 201);
  const abendId = (await ar.json()).id;
  try {
    const gameId = await startGame([1, 2]);
    const withGame = await (await api('POST', '/api/naturkranz', { player_id: 1, game_id: gameId })).json();
    assert.equal(withGame.abend_id, abendId);

    const noGame = await (await api('POST', '/api/naturkranz', { player_id: 1 })).json();
    assert.equal(noGame.abend_id, abendId);
    assert.equal(noGame.game_id, null);
  } finally {
    await api('POST', `/api/abende/${abendId}/end`);
  }

  const none = await (await api('POST', '/api/naturkranz', { player_id: 1 })).json();
  assert.equal(none.game_id, null);
  assert.equal(none.abend_id, null);
});

// ---------------------------------------------------------------------------
// NK10
// ---------------------------------------------------------------------------
test('NK10: DELETE without session answers 401 and keeps the row', async () => {
  const created = await (await api('POST', '/api/naturkranz', { player_id: 5 })).json();
  const r = await api('DELETE', `/api/naturkranz/${created.id}`, undefined, false);
  assert.equal(r.status, 401);
  assert.ok(nkRow(created.id));
});

// ---------------------------------------------------------------------------
// NK11
// ---------------------------------------------------------------------------
test('NK11: DELETE removes the row, 404 on repeat, 400 on bad ids, broadcasts removed', async () => {
  const created = await (await api('POST', '/api/naturkranz', { player_id: 5 })).json();
  const evPromise = waitForEvent(socket, 'naturkranz:changed');
  const r = await api('DELETE', `/api/naturkranz/${created.id}`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(nkRow(created.id), undefined);
  const ev = await evPromise;
  assert.equal(ev.action, 'removed');
  assert.equal(ev.id, created.id);
  assert.equal(ev.player_id, 5);

  assert.equal((await api('DELETE', `/api/naturkranz/${created.id}`)).status, 404);
  assert.equal((await api('DELETE', '/api/naturkranz/abc')).status, 400);
  assert.equal((await api('DELETE', '/api/naturkranz/0')).status, 400);
});

// ---------------------------------------------------------------------------
// NK12
// ---------------------------------------------------------------------------
test('NK12: GET requires a session and filters by game_id / player_id', async () => {
  assert.equal((await api('GET', '/api/naturkranz', undefined, false)).status, 401);

  const gameId = await startGame([6, 7]);
  const a = await (await api('POST', '/api/naturkranz', { player_id: 6, game_id: gameId })).json();
  const b = await (await api('POST', '/api/naturkranz', { player_id: 7, game_id: gameId })).json();
  const free = await (await api('POST', '/api/naturkranz', { player_id: 6 })).json();

  const byGame = await (await api('GET', `/api/naturkranz?game_id=${gameId}`)).json();
  assert.deepEqual(byGame.map(e => e.id), [b.id, a.id]);
  for (const e of byGame) {
    assert.equal(typeof e.player_name, 'string');
    assert.equal(typeof e.player_emoji, 'string');
    assert.equal(e.type_key, 'dreiVollen');
  }

  const byPlayer = await (await api('GET', '/api/naturkranz?player_id=6')).json();
  assert.ok(byPlayer.every(e => e.player_id === 6));
  assert.deepEqual(byPlayer.slice(0, 2).map(e => e.id), [free.id, a.id]);
  assert.equal(byPlayer[0].game_id, null);
  assert.equal(byPlayer[0].type_key, null);

  assert.equal((await api('GET', '/api/naturkranz?game_id=abc')).status, 400);
  assert.equal((await api('GET', '/api/naturkranz?player_id=0')).status, 400);
});

// ---------------------------------------------------------------------------
// NK13
// ---------------------------------------------------------------------------
test('NK13: Nachtragen with a date links the abend of that day', async () => {
  await endAnyOpenAbend();
  const ab = db.prepare(
    "INSERT INTO abende (name, started_at, ended_at) VALUES ('Frueher', '2026-04-01 19:00:00', '2026-04-01 23:00:00')"
  ).run();
  const abendId = Number(ab.lastInsertRowid);

  const r = await api('POST', '/api/naturkranz', { player_id: 4, date: '2026-04-01' });
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.ok(body.created_at.startsWith('2026-04-01'));
  assert.equal(body.abend_id, abendId);
  assert.equal(body.game_id, null);

  const open = await (await api('POST', '/api/abende', { name: 'NK13 offen' })).json();
  try {
    const r2 = await api('POST', '/api/naturkranz', { player_id: 4, date: '2026-03-15' });
    assert.equal(r2.status, 201);
    assert.equal((await r2.json()).abend_id, null);
  } finally {
    await api('POST', `/api/abende/${open.id}/end`);
  }
});

// ---------------------------------------------------------------------------
// NK14
// ---------------------------------------------------------------------------
test('NK14: invalid dates answer 400 and write nothing', async () => {
  const before = nkCount();
  const bad = ['2026-13-45', '2026-02-30', '01.04.2026', 20260401, "2026-04-01'; DROP TABLE naturkranz;--"];
  for (const d of bad) {
    const r = await api('POST', '/api/naturkranz', { player_id: 4, date: d });
    assert.equal(r.status, 400, String(d));
    assert.equal((await r.json()).error, 'invalid date');
  }
  const gameId = await startGame([4, 5]);
  const both = await api('POST', '/api/naturkranz', { player_id: 4, game_id: gameId, date: '2026-04-01' });
  assert.equal(both.status, 400);
  assert.equal((await both.json()).error, 'game_id and date are mutually exclusive');
  assert.equal(nkCount(), before);
  assert.doesNotThrow(() => db.prepare('SELECT COUNT(*) FROM naturkranz').get());
});
