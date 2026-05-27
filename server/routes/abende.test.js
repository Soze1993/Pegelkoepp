'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// PIN setup — must be set BEFORE requiring app (so db singleton uses test DB)
// ---------------------------------------------------------------------------
const PIN = '1234';
const PIN_HASH = bcrypt.hashSync(PIN, 10);
process.env.PIN_HASH = PIN_HASH;

// ---------------------------------------------------------------------------
// Setup: isolated DB + ephemeral HTTP server
// ---------------------------------------------------------------------------
let tmpDir;
let server;
let baseUrl;
let db;
let cookie; // authenticated session cookie

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-abende-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.SESSION_SECRET = 'test-secret-do-not-use-in-prod';
  process.env.NODE_ENV = 'test';
  process.env.SESSION_DIR = tmpDir;
  process.env.PIN_HASH = PIN_HASH;
  fs.mkdirSync(tmpDir, { recursive: true });

  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./abende');
  clearCache('./highlights');
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
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Login once, reuse cookie for all auth-required tests
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: PIN })
  });
  assert.equal(loginRes.status, 200, 'Login should succeed');
  const raw = loginRes.headers.get('set-cookie');
  cookie = raw.split(';')[0];
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));

  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./abende');
  clearCache('./highlights');
  clearCache('./games');
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');
  clearCache('../game-types/index');

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

// ---------------------------------------------------------------------------
// AB01: POST /api/abende with name returns {id, name} 201
// ---------------------------------------------------------------------------
test('AB01: POST /api/abende with name returns 201 with {id, name}', async () => {
  const res = await fetch(`${baseUrl}/api/abende`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'Testabend' })
  });
  assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
  const body = await res.json();
  assert.ok(Number.isInteger(body.id) && body.id > 0, `id should be a positive integer, got ${JSON.stringify(body)}`);
  assert.equal(body.name, 'Testabend', `Expected name "Testabend", got "${body.name}"`);

  // Clean up: end the abend so subsequent tests start fresh
  await fetch(`${baseUrl}/api/abende/${body.id}/end`, {
    method: 'POST',
    headers: { cookie }
  });
});

// ---------------------------------------------------------------------------
// AB02: POST /api/abende with blank name uses German weekday+date default
// ---------------------------------------------------------------------------
test('AB02: POST /api/abende with blank name uses German weekday+date default', async () => {
  const res = await fetch(`${baseUrl}/api/abende`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: '' })
  });
  assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
  const body = await res.json();
  // Default format: "Fr. 23.05." — weekday abbreviation + space + DD.MM.
  assert.match(body.name, /^[A-Z][a-z]\. \d{2}\.\d{2}\.$/, `Default name "${body.name}" should match /^[A-Z][a-z]\\. \\d{2}\\.\\d{2}\\.$/ `);

  // Clean up
  await fetch(`${baseUrl}/api/abende/${body.id}/end`, {
    method: 'POST',
    headers: { cookie }
  });
});

// ---------------------------------------------------------------------------
// AB03: GET /api/abende/active returns null when no abend open
// ---------------------------------------------------------------------------
test('AB03: GET /api/abende/active returns null when no abend is open', async () => {
  // Ensure no abend is open (end any leftover from before)
  const activeCheck = db.prepare('SELECT id FROM abende WHERE ended_at IS NULL LIMIT 1').get();
  if (activeCheck) {
    await fetch(`${baseUrl}/api/abende/${activeCheck.id}/end`, {
      method: 'POST',
      headers: { cookie }
    });
  }

  const res = await fetch(`${baseUrl}/api/abende/active`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body, null, `Expected null when no abend open, got ${JSON.stringify(body)}`);
});

// ---------------------------------------------------------------------------
// AB04: GET /api/abende/active returns {id, name, started_at} when one is open
// ---------------------------------------------------------------------------
test('AB04: GET /api/abende/active returns {id, name, started_at} when one is open', async () => {
  // Create an abend
  const createRes = await fetch(`${baseUrl}/api/abende`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'AktuellerAbend' })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();

  const res = await fetch(`${baseUrl}/api/abende/active`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.ok(body !== null, 'Expected non-null active abend');
  assert.equal(body.id, created.id, `Expected id ${created.id}, got ${body.id}`);
  assert.equal(body.name, 'AktuellerAbend', `Expected name "AktuellerAbend", got "${body.name}"`);
  assert.ok(typeof body.started_at === 'string' && body.started_at.length > 0, `Expected started_at string, got ${JSON.stringify(body.started_at)}`);

  // Clean up
  await fetch(`${baseUrl}/api/abende/${created.id}/end`, {
    method: 'POST',
    headers: { cookie }
  });
});

// ---------------------------------------------------------------------------
// AB05: POST /api/abende when one already open returns 409
// ---------------------------------------------------------------------------
test('AB05: POST /api/abende when one already open returns 409', async () => {
  // Create first abend
  const firstRes = await fetch(`${baseUrl}/api/abende`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'ErsterAbend' })
  });
  assert.equal(firstRes.status, 201);
  const first = await firstRes.json();

  // Try to create second abend while first is open
  const secondRes = await fetch(`${baseUrl}/api/abende`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'ZweiterAbend' })
  });
  assert.equal(secondRes.status, 409, `Expected 409 when abend already open, got ${secondRes.status}`);
  const body = await secondRes.json();
  assert.ok(body.error, `Expected error message, got ${JSON.stringify(body)}`);

  // Clean up
  await fetch(`${baseUrl}/api/abende/${first.id}/end`, {
    method: 'POST',
    headers: { cookie }
  });
});

// ---------------------------------------------------------------------------
// AB06: POST /api/abende/:id/end sets ended_at; GET /api/abende/active returns null
// ---------------------------------------------------------------------------
test('AB06: POST /api/abende/:id/end closes abend; GET /api/abende/active returns null', async () => {
  // Create an abend
  const createRes = await fetch(`${baseUrl}/api/abende`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'EndTest' })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();

  // End the abend
  const endRes = await fetch(`${baseUrl}/api/abende/${created.id}/end`, {
    method: 'POST',
    headers: { cookie }
  });
  assert.equal(endRes.status, 200, `Expected 200, got ${endRes.status}`);
  const endBody = await endRes.json();
  assert.equal(endBody.ok, true, `Expected {ok:true}, got ${JSON.stringify(endBody)}`);

  // Verify ended_at is set in DB
  const row = db.prepare('SELECT ended_at FROM abende WHERE id = ?').get(created.id);
  assert.ok(row && row.ended_at !== null, `ended_at should be set, got ${JSON.stringify(row)}`);

  // GET /api/abende/active should now return null
  const activeRes = await fetch(`${baseUrl}/api/abende/active`);
  assert.equal(activeRes.status, 200);
  const activeBody = await activeRes.json();
  assert.equal(activeBody, null, `Expected null after ending abend, got ${JSON.stringify(activeBody)}`);
});

// ---------------------------------------------------------------------------
// Helpers for Phase 8 recap tests
// ---------------------------------------------------------------------------

function insertPlayer(name, emoji = '🎳', archived = 0) {
  const result = db.prepare(
    'INSERT INTO players (name, emoji, archived) VALUES (?, ?, ?)'
  ).run(name, emoji, archived);
  return result.lastInsertRowid;
}

/**
 * Insert a finished game with players and throws.
 * playerRows: [{ id, throws: [value, ...], meta: [metaObj|null, ...] }]
 * finishedAt: optional ISO datetime string to set finished_at explicitly
 * Returns gameId.
 */
function insertFinishedGame(type_key, playerRows, finishedAt) {
  const stmt = finishedAt
    ? db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES (?, 'finished', ?)")
    : db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES (?, 'finished', datetime('now'))");
  const gameResult = finishedAt ? stmt.run(type_key, finishedAt) : stmt.run(type_key);
  const gameId = gameResult.lastInsertRowid;

  playerRows.forEach((p, seat) => {
    db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(gameId, p.id, seat);
  });

  let throwIdx = 0;
  for (const p of playerRows) {
    const metas = p.meta || [];
    for (let i = 0; i < (p.throws || []).length; i++) {
      const metaObj = metas[i] || null;
      db.prepare(
        'INSERT INTO throws (game_id, player_id, throw_index, value, meta) VALUES (?, ?, ?, ?, ?)'
      ).run(gameId, p.id, throwIdx++, p.throws[i], metaObj ? JSON.stringify(metaObj) : null);
    }
  }

  return gameId;
}

function insertFinishedKDAGame(p1Id, p2Id, p3Id, p4Id, finishedAt) {
  const kda = require('../game-types/kegler-des-abends');

  // Build players array — KDA initState shuffles them randomly.
  const players = [
    { id: p1Id, name: 'P1', emoji: '1' },
    { id: p2Id, name: 'P2', emoji: '2' },
    { id: p3Id, name: 'P3', emoji: '3' },
    { id: p4Id, name: 'P4', emoji: '4' }
  ];

  // Insert the game FIRST so we have the gameId.
  // reconstructState uses String(game.id) as the KDA bracket seed — we must
  // use the same seed here so the throw sequence matches on reconstruction.
  const stmt = finishedAt
    ? db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES ('kda', 'finished', ?)")
    : db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES ('kda', 'finished', datetime('now'))");
  const gameResult = finishedAt ? stmt.run(finishedAt) : stmt.run();
  const gameId = gameResult.lastInsertRowid;

  // Insert game_players (seat = index in players array)
  players.forEach((p, seat) => {
    db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(gameId, p.id, seat);
  });

  // Use String(gameId) as seed to match reconstructState exactly
  let state = kda.initState(players, { seed: String(gameId) });

  // Play out the tournament: for each undone match, give match.p1 high scores and match.p2 low scores.
  const throwRows = [];

  while (!state.done) {
    // Find the next undone, non-bye, fully-seated match
    const match = state.bracket.find(m =>
      !m.done && !m.isBye && m.p1 && m.p2
    );
    if (!match) break;

    // Determine required throw count
    const required = match.throwsRequired || (match.bracket === 'GF' ? 4 : 2);
    const halfReq = required / 2;
    for (let i = 0; i < halfReq; i++) {
      throwRows.push({ playerId: match.p1.id, value: 5 });
      state = kda.applyThrow(state, match.p1.id, 5);
      throwRows.push({ playerId: match.p2.id, value: 1 });
      state = kda.applyThrow(state, match.p2.id, 1);
    }
  }

  if (!state.done || !state.gewinner) {
    throw new Error('insertFinishedKDAGame: tournament did not finish as expected');
  }

  const winnerId = state.gewinner.id;

  // Insert throws in order
  throwRows.forEach((t, idx) => {
    db.prepare(
      'INSERT INTO throws (game_id, player_id, throw_index, value) VALUES (?, ?, ?, ?)'
    ).run(gameId, t.playerId, idx, t.value);
  });

  return { gameId, winnerId };
}

/**
 * Insert a finished Bilderkegeln game with 2 players where p1 scores more than p2.
 * BK: 5 images × 2 throws per player = 10 throws per player (alternating by player).
 * p1 gets value=9 per throw, p2 gets value=1 per throw → p1 is the winner, p2 is the loser.
 * Returns the loserId (p2Id).
 */
function insertFinishedBKGame(p1Id, p2Id, finishedAt) {
  const bilderkegel = require('../game-types/bilderkegel');
  const players = [
    { id: p1Id, name: 'BKP1', emoji: 'A' },
    { id: p2Id, name: 'BKP2', emoji: 'B' }
  ];

  let state = bilderkegel.initState(players);
  const throwRows = [];

  // BK alternates: player at aktSpIdx throws twice, then next player, etc.
  // 5 images × 2 players × 2 throws = 20 throws total
  // We interleave throws to drive both players through all images.
  // aktSpIdx cycles 0,1,0,1... within each Bild round.
  // For each Bild: p1 throws twice (value=9 each), p2 throws twice (value=1 each).
  // But the order depends on aktSpIdx — let's replay to see:
  while (!state.done) {
    const aktP = state.players[state.aktSpIdx];
    const value = aktP.id === p1Id ? 9 : 1;
    throwRows.push({ playerId: aktP.id, value });
    state = bilderkegel.applyThrow(state, aktP.id, value);
  }

  if (!state.done) {
    throw new Error('insertFinishedBKGame: BK game did not finish as expected');
  }

  // p2 is the loser (lowest score)
  const loserId = p2Id;

  // Insert game in DB
  const stmt = finishedAt
    ? db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES ('bilderkegel', 'finished', ?)")
    : db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES ('bilderkegel', 'finished', datetime('now'))");
  const gameResult = finishedAt ? stmt.run(finishedAt) : stmt.run();
  const gameId = gameResult.lastInsertRowid;

  players.forEach((p, seat) => {
    db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(gameId, p.id, seat);
  });

  throwRows.forEach((t, idx) => {
    db.prepare(
      'INSERT INTO throws (game_id, player_id, throw_index, value) VALUES (?, ?, ?, ?)'
    ).run(gameId, t.playerId, idx, t.value);
  });

  return { gameId, loserId };
}

function insertClosedAbend(name, endedAt) {
  const result = db.prepare(
    "INSERT INTO abende (name, started_at, ended_at) VALUES (?, datetime('now', '-2 hours'), ?)"
  ).run(name || 'Test Abend', endedAt || '2026-04-01 22:00:00');
  return result.lastInsertRowid;
}

function linkGameToAbend(gameId, abendId) {
  db.prepare('UPDATE games SET abend_id = ? WHERE id = ?').run(abendId, gameId);
}

// ---
// AB30: GET /api/abende/last-summary returns null when no closed abend exists
// Status: RED — route does not exist yet
// ---
test('AB30: GET /api/abende/last-summary returns null when no closed abend exists', async () => {
  // AB01..AB06 close abende via /end which sets ended_at — delete them first so
  // there are no closed abende when this test runs.
  db.prepare('DELETE FROM abende WHERE ended_at IS NOT NULL').run();
  const res = await fetch(`${baseUrl}/api/abende/last-summary`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body, null, `Expected null when no closed abend exists, got ${JSON.stringify(body)}`);
});

// ---
// AB31: GET /api/abende/last-summary returns abend + kda_champion + bk_loser + games[]
// Status: RED — route does not exist yet
// ---
test('AB31: GET /api/abende/last-summary returns full shape with abend, kda_champion, bk_loser, games[]', async () => {
  // Insert 4 players for KDA and 2 for BK
  const kp1 = insertPlayer('AB31-KP1', '1');
  const kp2 = insertPlayer('AB31-KP2', '2');
  const kp3 = insertPlayer('AB31-KP3', '3');
  const kp4 = insertPlayer('AB31-KP4', '4');
  const bp1 = insertPlayer('AB31-BP1', 'A');
  const bp2 = insertPlayer('AB31-BP2', 'B');

  const abendId = insertClosedAbend('Testabend AB31', '2026-04-01 22:00:00');

  const { gameId: kgid, winnerId } = insertFinishedKDAGame(kp1, kp2, kp3, kp4, '2026-04-01 20:00:00');
  const { gameId: bgid, loserId } = insertFinishedBKGame(bp1, bp2, '2026-04-01 21:00:00');

  linkGameToAbend(kgid, abendId);
  linkGameToAbend(bgid, abendId);

  const res = await fetch(`${baseUrl}/api/abende/last-summary`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();

  assert.ok(body !== null, 'body should be non-null');
  assert.ok(body.abend && typeof body.abend === 'object', 'body.abend should be an object');
  assert.ok('id' in body.abend, 'abend should have id');
  assert.ok('name' in body.abend, 'abend should have name');
  assert.ok('started_at' in body.abend, 'abend should have started_at');
  assert.ok('ended_at' in body.abend, 'abend should have ended_at');

  assert.ok(body.kda_champion !== null, 'kda_champion should be non-null after KDA game');
  assert.ok(typeof body.kda_champion === 'object', 'kda_champion should be an object');
  assert.ok('id' in body.kda_champion, 'kda_champion should have id');
  assert.ok('name' in body.kda_champion, 'kda_champion should have name');
  assert.ok('emoji' in body.kda_champion, 'kda_champion should have emoji');
  assert.equal(body.kda_champion.id, winnerId, `kda_champion.id should be ${winnerId}, got ${body.kda_champion.id}`);

  assert.ok(body.bk_loser !== null, 'bk_loser should be non-null after BK game');
  assert.ok(typeof body.bk_loser === 'object', 'bk_loser should be an object');
  assert.ok('id' in body.bk_loser, 'bk_loser should have id');
  assert.ok('name' in body.bk_loser, 'bk_loser should have name');
  assert.ok('emoji' in body.bk_loser, 'bk_loser should have emoji');
  assert.equal(body.bk_loser.id, loserId, `bk_loser.id should be ${loserId}, got ${body.bk_loser.id}`);

  assert.ok(Array.isArray(body.games), 'body.games should be an array');
  assert.equal(body.games.length, 2, `games.length should be 2, got ${body.games.length}`);
  for (const g of body.games) {
    assert.ok('id' in g, 'game entry should have id');
    assert.ok('type_key' in g, 'game entry should have type_key');
    assert.ok('finished_at' in g, 'game entry should have finished_at');
    assert.ok('winner_name' in g, 'game entry should have winner_name');
    assert.ok('player_count' in g, 'game entry should have player_count');
  }
});

// ---
// AB32: GET /api/abende/last-summary handles closed abend with no KDA/BK games
// Status: RED — route does not exist yet
// ---
test('AB32: GET /api/abende/last-summary returns null kda_champion and bk_loser when no games linked', async () => {
  // Insert a new closed abend with a later ended_at so it becomes the "last" one
  const abendId = insertClosedAbend('Testabend AB32 leer', '2027-01-01 22:00:00');

  const res = await fetch(`${baseUrl}/api/abende/last-summary`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();

  assert.ok(body !== null, 'body should be non-null');
  assert.ok(body.abend && typeof body.abend === 'object', 'body.abend should be present');
  assert.equal(body.abend.id, abendId, `abend.id should be ${abendId}, got ${body.abend.id}`);
  assert.equal(body.kda_champion, null, `kda_champion should be null, got ${JSON.stringify(body.kda_champion)}`);
  assert.equal(body.bk_loser, null, `bk_loser should be null, got ${JSON.stringify(body.bk_loser)}`);
  assert.ok(Array.isArray(body.games), 'body.games should be an array');
  assert.equal(body.games.length, 0, `games should be empty array, got length ${body.games.length}`);
});
