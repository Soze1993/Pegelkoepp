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

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-highlights-test-'));
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
  clearCache('./highlights');
  clearCache('./games');
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');
  clearCache('../game-types/index');

  db = require('../db/index');
  // Do NOT seed — tests control exactly which players exist

  const app = require('../app');

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
  // No login needed — highlights endpoint is public (no requireSession)
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));

  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./highlights');
  clearCache('./games');
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');
  clearCache('../game-types/index');

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Helpers to insert fixture data directly into DB
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
  const ts = finishedAt || "datetime('now')";
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

/**
 * Insert a complete 4-player KDA game using a deterministic seed so the bracket
 * layout is fixed. With seed='test', the shuffle order of [p1,p2,p3,p4] is
 * determined by seededShuffle. We give player at seat 0 high throws in every
 * match so they win the whole tournament. Returns winnerId (always the first
 * player in the seededPlayers array after shuffle).
 *
 * Since we cannot predict the shuffle without running the same LCG, we instead
 * force a win for ALL matches by making every throw from p1 = 9 and every throw
 * from others = 0. This means whichever player occupies p1 in each slot always
 * wins — but to guarantee one player wins the whole tournament, we build throws
 * that are submitted in throw_index order covering ALL slots.
 *
 * SIMPLER APPROACH: directly insert DB throws that replay to a finished KDA state.
 * The KDA initState with 4 players creates 5 slots. We supply throws that drive
 * one player to win all their matches. We use the 'kda' module directly to
 * compute the required throw sequence and insert those rows.
 */
function insertFinishedKDAGame(p1Id, p2Id, p3Id, p4Id, finishedAt) {
  const kda = require('../game-types/kegler-des-abends');

  // Build players array — KDA initState shuffles them randomly.
  // We use a seed so the bracket is deterministic.
  const players = [
    { id: p1Id, name: 'P1', emoji: '1' },
    { id: p2Id, name: 'P2', emoji: '2' },
    { id: p3Id, name: 'P3', emoji: '3' },
    { id: p4Id, name: 'P4', emoji: '4' }
  ];

  // Use a fixed seed to get a deterministic bracket
  let state = kda.initState(players, { seed: 'test-hl11' });

  // Play out the tournament: for each undone match, give the first-seated player
  // 5 throws (value=5) and the second-seated player 3 throws (value=3), alternating.
  // We keep applying throws until state.done.
  const throwRows = [];
  let globalIdx = 0;

  while (!state.done) {
    // Find the next undone, non-bye, fully-seated match
    const match = state.bracket.find(m =>
      !m.done && !m.isBye && m.p1 && m.p2
    );
    if (!match) break;

    // Give p1 high, p2 low (2 throws each for normal slots, 4 for GF)
    const required = match.throwsRequired || (match.bracket === 'GF' ? 4 : 2);
    // p1 gets required/2 throws of value 5, p2 gets required/2 throws of value 1
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

  // Insert the game in DB
  const stmt = finishedAt
    ? db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES ('kda', 'finished', ?)")
    : db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES ('kda', 'finished', datetime('now'))");
  const gameResult = finishedAt ? stmt.run(finishedAt) : stmt.run();
  const gameId = gameResult.lastInsertRowid;

  // Insert game_players (seat = index in players array)
  players.forEach((p, seat) => {
    db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(gameId, p.id, seat);
  });

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

// ---------------------------------------------------------------------------
// HL10: GET /api/highlights/current returns 200 with { kda_champion: null, bk_loser: null }
//       when no finished games exist in DB.
// Status: RED — route does not exist yet (highlights.js not implemented, app.js not updated)
// ---------------------------------------------------------------------------
test('HL10: GET /api/highlights/current returns { kda_champion: null, bk_loser: null } when no finished games', async () => {
  // Insert 2 players but no games
  insertPlayer('HL10-Alice', '🎳');
  insertPlayer('HL10-Bob', '🎯');

  const res = await fetch(`${baseUrl}/api/highlights/current`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);

  const body = await res.json();
  assert.ok('kda_champion' in body, 'Response should have kda_champion field');
  assert.ok('bk_loser' in body, 'Response should have bk_loser field');
  assert.equal(body.kda_champion, null, `kda_champion should be null when no KDA games, got ${JSON.stringify(body.kda_champion)}`);
  assert.equal(body.bk_loser, null, `bk_loser should be null when no BK games, got ${JSON.stringify(body.bk_loser)}`);
});

// ---------------------------------------------------------------------------
// HL11: GET /api/highlights/current returns kda_champion after a finished KDA game exists.
// Status: RED — route does not exist yet
// ---------------------------------------------------------------------------
test('HL11: GET /api/highlights/current returns kda_champion after finished KDA game', async () => {
  // Insert 4 players for KDA (requires 4 minimum)
  const p1 = insertPlayer('HL11-P1', '🏆');
  const p2 = insertPlayer('HL11-P2', '🎳');
  const p3 = insertPlayer('HL11-P3', '🎯');
  const p4 = insertPlayer('HL11-P4', '🎱');

  // Insert a complete KDA game — returns the actual winnerId
  const { winnerId } = insertFinishedKDAGame(p1, p2, p3, p4, null);

  const res = await fetch(`${baseUrl}/api/highlights/current`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);

  const body = await res.json();
  assert.ok(body.kda_champion !== null, 'kda_champion should be non-null after a finished KDA game');
  assert.ok(typeof body.kda_champion === 'object', `kda_champion should be an object, got ${typeof body.kda_champion}`);
  assert.ok('id' in body.kda_champion, 'kda_champion should have an id field');
  assert.ok('name' in body.kda_champion, 'kda_champion should have a name field');
  assert.ok('emoji' in body.kda_champion, 'kda_champion should have an emoji field');
  assert.equal(body.kda_champion.id, winnerId, `kda_champion.id should be ${winnerId}, got ${body.kda_champion.id}`);
});

// ---------------------------------------------------------------------------
// HL12: GET /api/highlights/current returns bk_loser after a finished Bilderkegeln game exists.
// The player with the lowest bkTotal is the loser.
// Status: RED — route does not exist yet
// ---------------------------------------------------------------------------
test('HL12: GET /api/highlights/current returns bk_loser after finished Bilderkegeln game', async () => {
  // Insert 2 players for BK
  const p1 = insertPlayer('HL12-BKWinner', '🏅');
  const p2 = insertPlayer('HL12-BKLoser', '💩');

  // Insert BK game: p1 gets high scores, p2 gets low scores → p2 is the loser
  const { loserId } = insertFinishedBKGame(p1, p2, null);

  const res = await fetch(`${baseUrl}/api/highlights/current`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);

  const body = await res.json();
  assert.ok(body.bk_loser !== null, 'bk_loser should be non-null after a finished BK game');
  assert.ok(typeof body.bk_loser === 'object', `bk_loser should be an object, got ${typeof body.bk_loser}`);
  assert.ok('id' in body.bk_loser, 'bk_loser should have an id field');
  assert.ok('name' in body.bk_loser, 'bk_loser should have a name field');
  assert.ok('emoji' in body.bk_loser, 'bk_loser should have an emoji field');
  assert.equal(body.bk_loser.id, loserId, `bk_loser.id should be ${loserId}, got ${body.bk_loser.id}`);
});

// ---------------------------------------------------------------------------
// HL13: GET /api/highlights/current returns the MOST RECENT result when multiple
//       finished games of the same type exist.
// Two KDA games are inserted — the second (later finished_at) must win.
// Status: RED — route does not exist yet
// ---------------------------------------------------------------------------
test('HL13: GET /api/highlights/current returns most recent kda_champion when multiple KDA games exist', async () => {
  // Insert 4 players for first game, 4 for second (different winner expected)
  const a1 = insertPlayer('HL13-A1', 'A');
  const a2 = insertPlayer('HL13-A2', 'B');
  const a3 = insertPlayer('HL13-A3', 'C');
  const a4 = insertPlayer('HL13-A4', 'D');

  const b1 = insertPlayer('HL13-B1', 'E');
  const b2 = insertPlayer('HL13-B2', 'F');
  const b3 = insertPlayer('HL13-B3', 'G');
  const b4 = insertPlayer('HL13-B4', 'H');

  // Insert first game (older) with explicit finished_at in the past
  const { winnerId: winner1 } = insertFinishedKDAGame(a1, a2, a3, a4, '2026-01-01 10:00:00');

  // Insert second game (newer) with a later finished_at
  const { winnerId: winner2 } = insertFinishedKDAGame(b1, b2, b3, b4, '2026-06-01 10:00:00');

  const res = await fetch(`${baseUrl}/api/highlights/current`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);

  const body = await res.json();
  assert.ok(body.kda_champion !== null, 'kda_champion should be non-null');
  assert.equal(
    body.kda_champion.id,
    winner2,
    `kda_champion.id should be the winner of the MOST RECENT game (${winner2}), got ${body.kda_champion.id}`
  );
});
