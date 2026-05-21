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
let cookie;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-stats-test-'));
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
  clearCache('./stats');
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

  // Login once
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
  clearCache('./stats');
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
 * players: [{ id, throws: [value, ...], meta: [metaObj|null, ...] }]
 * Returns gameId.
 */
function insertFinishedGame(type_key, players) {
  // Insert game row
  const gameResult = db.prepare("INSERT INTO games (type_key, status) VALUES (?, 'finished')").run(type_key);
  const gameId = gameResult.lastInsertRowid;

  // Insert game_players
  players.forEach((p, seat) => {
    db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(gameId, p.id, seat);
  });

  // Insert throws
  let throwIdx = 0;
  for (const p of players) {
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

// ---------------------------------------------------------------------------
// ST10: GET /api/stats returns an array with one entry per non-archived player
// ---------------------------------------------------------------------------
test('ST10: GET /api/stats returns one entry per non-archived player', async () => {
  // Insert 2 non-archived players
  const p1 = insertPlayer('Alice', '🎳');
  const p2 = insertPlayer('Bob', '🎯');
  // Insert 1 archived player
  insertPlayer('Archived', '📦', 1);

  const res = await fetch(`${baseUrl}/api/stats`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.ok(Array.isArray(body), 'Should return array');

  const ids = body.map(e => e.player_id);
  assert.ok(ids.includes(p1), `Should include Alice (id=${p1})`);
  assert.ok(ids.includes(p2), `Should include Bob (id=${p2})`);

  const archivedEntry = body.find(e => e.name === 'Archived');
  assert.ok(!archivedEntry, 'Archived player should NOT appear in stats');
});

// ---------------------------------------------------------------------------
// ST11: After one finished dreiVollen game with single winner, winner has wins=1 losses=0, loser has wins=0 losses=1
// ---------------------------------------------------------------------------
test('ST11: Single winner gets wins=1 losses=0; loser gets losses=1 wins=0', async () => {
  // Find Alice and Bob created in ST10
  const alice = db.prepare("SELECT id FROM players WHERE name = 'Alice'").get();
  const bob = db.prepare("SELECT id FROM players WHERE name = 'Bob'").get();

  // dreiVollen: 3 throws each. Alice: 9+9+0=18, Bob: 5+5+5=15 → Alice wins
  insertFinishedGame('dreiVollen', [
    { id: alice.id, throws: [9, 9, 0] },
    { id: bob.id, throws: [5, 5, 5] }
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const aliceStats = body.find(e => e.player_id === alice.id);
  const bobStats = body.find(e => e.player_id === bob.id);

  assert.ok(aliceStats, 'Alice should be in stats');
  assert.ok(bobStats, 'Bob should be in stats');

  assert.equal(aliceStats.wins, 1, `Alice should have wins=1, got ${aliceStats.wins}`);
  assert.equal(aliceStats.losses, 0, `Alice should have losses=0, got ${aliceStats.losses}`);
  assert.equal(bobStats.wins, 0, `Bob should have wins=0, got ${bobStats.wins}`);
  assert.equal(bobStats.losses, 1, `Bob should have losses=1, got ${bobStats.losses}`);
});

// ---------------------------------------------------------------------------
// ST12: After one finished game where two players tie (both winner:true), both have draws=1
// ---------------------------------------------------------------------------
test('ST12: Two-player tie (both winner:true) → both get draws=1, wins=0, losses=0', async () => {
  const p1 = insertPlayer('Charlie', '⚽');
  const p2 = insertPlayer('Diana', '🏀');

  // dreiVollen: same score = tie → isDraw because winners.length === 2 !== 1
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [6, 6, 6] }, // score=18
    { id: p2, throws: [6, 6, 6] }  // score=18
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const c = body.find(e => e.player_id === p1);
  const d = body.find(e => e.player_id === p2);

  assert.ok(c && d, 'Both players should be in stats');
  assert.equal(c.draws, 1, `Charlie should have draws=1, got ${c.draws}`);
  assert.equal(c.wins, 0, `Charlie should have wins=0, got ${c.wins}`);
  assert.equal(c.losses, 0, `Charlie should have losses=0, got ${c.losses}`);
  assert.equal(d.draws, 1, `Diana should have draws=1, got ${d.draws}`);
});

// ---------------------------------------------------------------------------
// ST13: VG draw (state.winner='draw', zero winner:true entries) → all players get draws=1
// isDraw = winners.length !== 1 (handles 0 winners case)
// ---------------------------------------------------------------------------
test('ST13: VG draw (0 winner:true entries) → all players get draws=1', async () => {
  const p1 = insertPlayer('Eve', '♟️');
  const p2 = insertPlayer('Frank', '🎮');

  // For VG draw, we simulate directly: insert a finished VG game but use dreiVollen
  // with equal scores so we get a draw (both winner=true → isDraw = winners.length !== 1 = 2 !== 1)
  // Actually we want to test the 0-winner case. Insert VG game manually with
  // game_players having roles X and O, and a state where winner='draw' — but
  // that requires reconstructing a VG state. Instead, manipulate DB directly
  // by inserting a finished game whose reconstructed state has 0 winners.

  // VG with full board no winner → draw. The simplest approach: insert a finished
  // VG game that, when reconstructed, has winner='draw' in state.
  // We'll use a direct approach: insert a game row, 2 game_players, and
  // enough throws that the VG board fills up without either team winning.

  // Easier: use dreiVollen with equal scores → 2 winners (isDraw per ST12).
  // For 0-winner case specifically, we need to test VG. Let's construct it:
  // VG with winner=draw means all 81 cells filled with no winner.
  // This is complex to set up. Instead, use the DB+reconstructState approach.

  // Strategy: insert a VG game where we set status='finished' but no throws
  // at all. When reconstructed: initState gives 0 throws applied → winner=null, done=false
  // → getFinalResults: allPlayers, winner=null|'draw' → false for all.
  // But then getFinalResults returns winner: false for all → winners.length === 0 → isDraw.
  // The issue: isFinished(state) returns false for this state, but game status='finished' in DB.
  // The stats route calls getFinalResults without isFinished check. Let's verify.

  // Actually looking at stats.js: it gets finished games from DB and calls getFinalResults
  // without checking isFinished. So we can insert a finished VG game with 0 throws →
  // getFinalResults returns all with winner:false (since winner=null) → winners.length=0 → isDraw=true.

  // Insert VG game - need game_players with roles
  const gameResult = db.prepare("INSERT INTO games (type_key, status) VALUES ('viergewinnt', 'finished')").run();
  const vgGameId = gameResult.lastInsertRowid;
  // Roles: p1=X, p2=O
  db.prepare('INSERT INTO game_players (game_id, player_id, seat, role) VALUES (?, ?, ?, ?)').run(vgGameId, p1, 0, 'X');
  db.prepare('INSERT INTO game_players (game_id, player_id, seat, role) VALUES (?, ?, ?, ?)').run(vgGameId, p2, 1, 'O');
  // No throws → winner=null → getFinalResults returns winner:false for all → winners.length=0 → isDraw

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const eStats = body.find(e => e.player_id === p1);
  const fStats = body.find(e => e.player_id === p2);

  assert.ok(eStats && fStats, 'Both players should be in stats');
  assert.equal(eStats.draws, 1, `Eve should have draws=1, got ${eStats.draws}`);
  assert.equal(eStats.wins, 0, `Eve should have wins=0, got ${eStats.wins}`);
  assert.equal(eStats.losses, 0, `Eve should have losses=0, got ${eStats.losses}`);
  assert.equal(fStats.draws, 1, `Frank should have draws=1, got ${fStats.draws}`);
});

// ---------------------------------------------------------------------------
// ST14: GET /api/stats includes personal_bests; after dreiVollen win with score 18,
//        winner has personal_bests=[{type_key:'dreiVollen', score:18}]
// ---------------------------------------------------------------------------
test('ST14: personal_bests contains best score after a dreiVollen game', async () => {
  const p1 = insertPlayer('Grace', '🏆');
  const p2 = insertPlayer('Hank', '🎳');

  // Grace: 9+9+0=18, Hank: 5+5+5=15 → Grace wins with score 18
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [9, 9, 0] },
    { id: p2, throws: [5, 5, 5] }
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const grace = body.find(e => e.player_id === p1);
  assert.ok(grace, 'Grace should be in stats');
  assert.ok(Array.isArray(grace.personal_bests), 'personal_bests should be an array');
  const pb = grace.personal_bests.find(b => b.type_key === 'dreiVollen');
  assert.ok(pb, `Grace should have a personal best for dreiVollen, got ${JSON.stringify(grace.personal_bests)}`);
  assert.equal(pb.score, 18, `Grace's personal best should be 18, got ${pb.score}`);
});

// ---------------------------------------------------------------------------
// ST15: Second dreiVollen win with score 21 replaces personal best (was 18);
//        loser's lower score is NOT recorded as their personal best if a prior higher exists
// ---------------------------------------------------------------------------
test('ST15: Higher score replaces personal best; lower score does not', async () => {
  const p1 = insertPlayer('Iris', '🎯');
  const p2 = insertPlayer('Jack', '🎱');

  // First game: Iris 18, Jack 15 → Iris wins
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [9, 9, 0] },
    { id: p2, throws: [5, 5, 5] }
  ]);

  // Second game: Iris 21, Jack 10 → Iris wins again with higher score
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [7, 7, 7] }, // 21
    { id: p2, throws: [3, 4, 3] }  // 10
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const iris = body.find(e => e.player_id === p1);
  const jack = body.find(e => e.player_id === p2);

  const irisPb = iris.personal_bests.find(b => b.type_key === 'dreiVollen');
  assert.ok(irisPb, 'Iris should have a dreiVollen personal best');
  assert.equal(irisPb.score, 21, `Iris personal best should be 21 (second game), got ${irisPb.score}`);

  // Jack's best across both games: 15 (from first game, higher than 10 from second)
  const jackPb = jack.personal_bests.find(b => b.type_key === 'dreiVollen');
  assert.ok(jackPb, 'Jack should have a personal best for dreiVollen');
  assert.equal(jackPb.score, 15, `Jack personal best should be 15, got ${jackPb.score}`);
});

// ---------------------------------------------------------------------------
// ST16: GET /api/stats counts pudel_count from throws.meta where meta.pudel = 1
// ---------------------------------------------------------------------------
test('ST16: pudel_count counts throws where meta.pudel = 1', async () => {
  const p1 = insertPlayer('Karen', '🎳');
  const p2 = insertPlayer('Leo', '🎳');

  // dreiVollen game with one pudel for Karen (value=0 AND meta.pudel=1)
  // For dreiVollen, value=0 is already a pudel in the game module (increments p.pudel)
  // But for DB pudel count, we use json_extract(meta, '$.pudel') = 1
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [9, 0, 9], meta: [null, { pudel: 1 }, null] }, // Karen: pudel on second throw
    { id: p2, throws: [5, 5, 5], meta: [null, null, null] }          // Leo: no pudels
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const karen = body.find(e => e.player_id === p1);
  const leo = body.find(e => e.player_id === p2);

  assert.ok(karen && leo, 'Both players should be in stats');
  assert.equal(karen.pudel_count, 1, `Karen should have pudel_count=1, got ${karen.pudel_count}`);
  assert.equal(leo.pudel_count, 0, `Leo should have pudel_count=0, got ${leo.pudel_count}`);
});

// ---------------------------------------------------------------------------
// ST17: Throws with value=0 but no meta.pudel flag are NOT counted as pudel
// ---------------------------------------------------------------------------
test('ST17: value=0 without meta.pudel flag is NOT counted as pudel', async () => {
  const p1 = insertPlayer('Mia', '🎳');
  const p2 = insertPlayer('Nick', '🎳');

  // dreiVollen: value=0 throw but meta=null (no pudel flag)
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [9, 0, 9], meta: [null, null, null] }, // value=0 but no meta.pudel
    { id: p2, throws: [5, 5, 5] }
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const mia = body.find(e => e.player_id === p1);
  assert.ok(mia, 'Mia should be in stats');
  assert.equal(mia.pudel_count, 0, `Mia should have pudel_count=0 (value=0 without meta.pudel), got ${mia.pudel_count}`);
});

// ---------------------------------------------------------------------------
// ST18: pudel_pct = Math.round(pudel_count / total_throws * 1000) / 10 (one decimal)
// ---------------------------------------------------------------------------
test('ST18: pudel_pct = Math.round(pudel_count / total_throws * 1000) / 10', async () => {
  const p1 = insertPlayer('Olivia', '🎳');
  const p2 = insertPlayer('Pete', '🎳');

  // 3 throws total for Olivia, 1 pudel → pudel_pct = round(1/3 * 1000) / 10 = round(333.33) / 10 = 333 / 10 = 33.3
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [9, 0, 9], meta: [null, { pudel: 1 }, null] },
    { id: p2, throws: [5, 5, 5] }
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const olivia = body.find(e => e.player_id === p1);
  assert.ok(olivia, 'Olivia should be in stats');
  assert.equal(olivia.pudel_count, 1, `pudel_count should be 1, got ${olivia.pudel_count}`);
  assert.equal(olivia.total_throws, 3, `total_throws should be 3, got ${olivia.total_throws}`);
  const expected = Math.round(1 / 3 * 1000) / 10;
  assert.equal(olivia.pudel_pct, expected, `pudel_pct should be ${expected}, got ${olivia.pudel_pct}`);
});

// ---------------------------------------------------------------------------
// ST19: Archived players (archived=1) do NOT appear in GET /api/stats response
// ---------------------------------------------------------------------------
test('ST19: Archived players do NOT appear in GET /api/stats', async () => {
  const archived = insertPlayer('Archived Player', '📦', 1);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  const found = body.find(e => e.player_id === archived);
  assert.ok(!found, `Archived player (id=${archived}) should not appear in stats`);
});

// ---------------------------------------------------------------------------
// ST20: GET /api/stats — game with unknown type_key skipped gracefully; no 500 error
// ---------------------------------------------------------------------------
test('ST20: Game with unknown type_key is skipped gracefully, no 500 error', async () => {
  const p1 = insertPlayer('Quinn', '🎳');
  const p2 = insertPlayer('Ruth', '🎳');

  // Insert a finished game with an unknown type_key
  const gameResult = db.prepare("INSERT INTO games (type_key, status) VALUES ('unknownGameType', 'finished')").run();
  const unknownGameId = gameResult.lastInsertRowid;
  db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(unknownGameId, p1, 0);
  db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(unknownGameId, p2, 1);

  // Should not throw 500
  const res = await fetch(`${baseUrl}/api/stats`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status} (unknown type_key should be skipped gracefully)`);
  const body = await res.json();
  assert.ok(Array.isArray(body), 'Should return array even when games with unknown type_key exist');
});
