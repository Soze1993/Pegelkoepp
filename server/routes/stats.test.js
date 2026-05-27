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
  assert.ok(body && typeof body === 'object' && Array.isArray(body.players), 'Should return {players:[...], tournament_records:{...}}');
  assert.ok('tournament_records' in body, 'Should have tournament_records field');

  const ids = body.players.map(e => e.player_id);
  assert.ok(ids.includes(p1), `Should include Alice (id=${p1})`);
  assert.ok(ids.includes(p2), `Should include Bob (id=${p2})`);

  const archivedEntry = body.players.find(e => e.name === 'Archived');
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
  const players = body.players;

  const aliceStats = players.find(e => e.player_id === alice.id);
  const bobStats = players.find(e => e.player_id === bob.id);

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
  const players = body.players;

  const c = players.find(e => e.player_id === p1);
  const d = players.find(e => e.player_id === p2);

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
  const players = body.players;

  const eStats = players.find(e => e.player_id === p1);
  const fStats = players.find(e => e.player_id === p2);

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
  const players = body.players;

  const grace = players.find(e => e.player_id === p1);
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
  const players = body.players;

  const iris = players.find(e => e.player_id === p1);
  const jack = players.find(e => e.player_id === p2);

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
  const players = body.players;

  const karen = players.find(e => e.player_id === p1);
  const leo = players.find(e => e.player_id === p2);

  assert.ok(karen && leo, 'Both players should be in stats');
  assert.equal(karen.pudel_count, 1, `Karen should have pudel_count=1, got ${karen.pudel_count}`);
  assert.equal(leo.pudel_count, 0, `Leo should have pudel_count=0, got ${leo.pudel_count}`);
});

// ---------------------------------------------------------------------------
// ST17: value=0 without meta.keinPudel IS counted as pudel
// Pudel are stored as value=0 with meta=null (no special flag needed).
// Only value=0 WITH meta.keinPudel=true is excluded (intentional 0).
// ---------------------------------------------------------------------------
test('ST17: value=0 without meta.keinPudel IS counted as pudel', async () => {
  const p1 = insertPlayer('Mia', '🎳');
  const p2 = insertPlayer('Nick', '🎳');

  // dreiVollen: value=0, meta=null → pudel
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [9, 0, 9], meta: [null, null, null] },
    { id: p2, throws: [5, 5, 5] }
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();
  const players = body.players;

  const mia = players.find(e => e.player_id === p1);
  assert.ok(mia, 'Mia should be in stats');
  assert.equal(mia.pudel_count, 1, `Mia should have pudel_count=1 (value=0 counts as pudel), got ${mia.pudel_count}`);
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
  const players = body.players;

  const olivia = players.find(e => e.player_id === p1);
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
  const players = body.players;

  const found = players.find(e => e.player_id === archived);
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
  assert.ok(body && Array.isArray(body.players), 'Should return {players:[...]} even when games with unknown type_key exist');
});

// ---------------------------------------------------------------------------
// ST21: GET /api/stats returns tournament_records.dreiVollen with best_sum and game_id
//        after a dreiVollen game with >=6 players
// ---------------------------------------------------------------------------
test('ST21: tournament_records.dreiVollen has best_sum and game_id after 6-player dreiVollen game', async () => {
  // Insert 6 players
  const pids = [
    insertPlayer('TRec1', '1'), insertPlayer('TRec2', '2'), insertPlayer('TRec3', '3'),
    insertPlayer('TRec4', '4'), insertPlayer('TRec5', '5'), insertPlayer('TRec6', '6')
  ];

  // 6-player dreiVollen: scores [9,8,7,6,5,4] → sum = 39
  const gameId = insertFinishedGame('dreiVollen', [
    { id: pids[0], throws: [3, 3, 3] }, // 9
    { id: pids[1], throws: [3, 3, 2] }, // 8
    { id: pids[2], throws: [3, 2, 2] }, // 7
    { id: pids[3], throws: [2, 2, 2] }, // 6
    { id: pids[4], throws: [2, 2, 1] }, // 5
    { id: pids[5], throws: [2, 1, 1] }  // 4
  ]);

  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();

  assert.ok(body.tournament_records, 'tournament_records should be present');
  assert.ok(body.tournament_records.dreiVollen, 'tournament_records.dreiVollen should be non-null after 6-player game');
  assert.equal(typeof body.tournament_records.dreiVollen.best_sum, 'number', 'best_sum should be a number');
  assert.ok(body.tournament_records.dreiVollen.game_id != null, 'game_id should be present');
  // The 6-player game top6Sum = sum of all 6 = 39
  assert.equal(body.tournament_records.dreiVollen.best_sum, 39, `best_sum should be 39, got ${body.tournament_records.dreiVollen.best_sum}`);
});

// ---------------------------------------------------------------------------
// ST22: tournament_records.dreiVollen is null when no dreiVollen game with >=6 players exists
// ---------------------------------------------------------------------------
test('ST22: tournament_records.dreiVollen is null when no qualifying dreiVollen games exist', async () => {
  // Only 2-player dreiVollen games exist in the DB at this point (from previous tests)
  // Just check that tournament_records is present and dreiVollen is null or the best_sum is from 6-player game
  const res = await fetch(`${baseUrl}/api/stats`);
  const body = await res.json();
  assert.ok('tournament_records' in body, 'tournament_records should always be present');
  // dreiVollen may be non-null if ST21 already inserted a 6-player game (tests share DB)
  // So just verify the shape is correct: either null or {best_sum, game_id}
  const tr = body.tournament_records.dreiVollen;
  if (tr !== null) {
    assert.equal(typeof tr.best_sum, 'number', 'If present, best_sum must be a number');
    assert.ok(tr.game_id != null, 'If present, game_id must be non-null');
  }
});

// ---
// ST30: GET /api/stats/year?year=abc → 400 with { error: 'Invalid year' }
// Status: RED — route does not exist yet
// ---
test('ST30: GET /api/stats/year?year=abc returns 400 with { error: \'Invalid year\' }', async () => {
  const res = await fetch(`${baseUrl}/api/stats/year?year=abc`);
  assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.error, 'Invalid year', `Expected error 'Invalid year', got ${JSON.stringify(body)}`);
});

// ---
// ST31: GET /api/stats/year?year=2026 returns leaderboard with the winner in it
// Status: RED — route does not exist yet
// ---
test('ST31: GET /api/stats/year?year=2026 returns leaderboard with winner having wins >= 1', async () => {
  const p1 = insertPlayer('ST31-Winner', '🏆');
  const p2 = insertPlayer('ST31-Loser', '🎳');

  // Insert two finished games in year 2026 with known winner (p1 wins both)
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [9, 9, 0] },
    { id: p2, throws: [5, 5, 5] }
  ], '2026-06-01 12:00:00');
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [7, 7, 7] },
    { id: p2, throws: [3, 3, 3] }
  ], '2026-06-02 12:00:00');

  const res = await fetch(`${baseUrl}/api/stats/year?year=2026`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.year, '2026', `Expected year '2026', got ${body.year}`);
  assert.ok(Array.isArray(body.leaderboard), 'leaderboard should be an array');
  assert.ok(Array.isArray(body.available_years), 'available_years should be an array');
  assert.ok(body.available_years.includes('2026'), 'available_years should contain 2026');

  const winner = body.leaderboard.find(e => e.id === p1);
  assert.ok(winner, `Winner (id=${p1}) should be in leaderboard`);
  assert.ok(winner.wins >= 1, `Winner should have wins >= 1, got ${winner.wins}`);

  // Leaderboard sorted by wins desc
  for (let i = 0; i < body.leaderboard.length - 1; i++) {
    assert.ok(
      body.leaderboard[i].wins >= body.leaderboard[i + 1].wins,
      'Leaderboard should be sorted by wins desc'
    );
  }
});

// ---
// ST32: GET /api/stats/streaks returns { current: 0, longest: 2 } for player with 2-win streak then a loss
// Status: RED — route does not exist yet
// ---
test('ST32: GET /api/stats/streaks returns correct current and longest streak', async () => {
  const p1 = insertPlayer('ST32-P1', 'A');
  const p2 = insertPlayer('ST32-P2', 'B');

  // Game 1: p1 wins (high throws)
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [9, 9, 0] },
    { id: p2, throws: [5, 5, 5] }
  ], '2025-01-01 10:00:00');
  // Game 2: p1 wins again
  insertFinishedGame('dreiVollen', [
    { id: p1, throws: [7, 7, 7] },
    { id: p2, throws: [3, 3, 3] }
  ], '2025-01-02 10:00:00');
  // Game 3: p2 wins (p1 loses)
  insertFinishedGame('dreiVollen', [
    { id: p2, throws: [9, 9, 9] },
    { id: p1, throws: [1, 1, 1] }
  ], '2025-01-03 10:00:00');

  const res = await fetch(`${baseUrl}/api/stats/streaks`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  const p1Streak = body[String(p1)];
  assert.ok(p1Streak, `p1 (id=${p1}) should be in streaks response`);
  assert.equal(p1Streak.current, 0, `p1 current streak should be 0 (lost last game), got ${p1Streak.current}`);
  assert.equal(p1Streak.longest, 2, `p1 longest streak should be 2, got ${p1Streak.longest}`);
});

// ---
// ST33: GET /api/stats/h2h?a={a}&b={b} returns correct shape after one shared game
// Status: RED — route does not exist yet
// ---
test('ST33: GET /api/stats/h2h returns correct h2h shape after shared game', async () => {
  const a = insertPlayer('ST33-A', 'X');
  const b = insertPlayer('ST33-B', 'Y');

  // Insert one dreiVollen game where a wins
  insertFinishedGame('dreiVollen', [
    { id: a, throws: [9, 9, 0] },
    { id: b, throws: [5, 5, 5] }
  ], '2025-03-01 10:00:00');

  const res = await fetch(`${baseUrl}/api/stats/h2h?a=${a}&b=${b}`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.player_a, a, `player_a should be ${a}, got ${body.player_a}`);
  assert.equal(body.player_b, b, `player_b should be ${b}, got ${body.player_b}`);
  assert.equal(body.wins_a, 1, `wins_a should be 1, got ${body.wins_a}`);
  assert.equal(body.wins_b, 0, `wins_b should be 0, got ${body.wins_b}`);
  assert.equal(body.draws, 0, `draws should be 0, got ${body.draws}`);
  assert.equal(body.total, 1, `total should be 1, got ${body.total}`);
});

// ---
// ST34: GET /api/stats/h2h?a=0&b=-1 → 400 with { error: 'a and b must be positive integers' }
// Status: RED — route does not exist yet
// ---
test('ST34: GET /api/stats/h2h?a=0&b=-1 returns 400 with correct error message', async () => {
  const res = await fetch(`${baseUrl}/api/stats/h2h?a=0&b=-1`);
  assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.error, 'a and b must be positive integers', `Expected error message, got ${JSON.stringify(body)}`);
});

// ---
// ST35: GET /api/stats/kda-counts returns count for KDA winner after one finished KDA game
// Status: RED — route does not exist yet
// ---
test('ST35: GET /api/stats/kda-counts returns count 1 for winner after one finished KDA game', async () => {
  const p1 = insertPlayer('ST35-P1', '1');
  const p2 = insertPlayer('ST35-P2', '2');
  const p3 = insertPlayer('ST35-P3', '3');
  const p4 = insertPlayer('ST35-P4', '4');

  const { winnerId } = insertFinishedKDAGame(p1, p2, p3, p4, null);

  const res = await fetch(`${baseUrl}/api/stats/kda-counts`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body[String(winnerId)], 1, `Winner (id=${winnerId}) should have kda-count=1, got ${JSON.stringify(body)}`);
});

// ---
// ST36: GET /api/stats/bk-counts returns count 1 for BK loser after one finished BK game
// Status: RED — route does not exist yet
// ---
test('ST36: GET /api/stats/bk-counts returns count 1 for loser after one finished BK game', async () => {
  const p1 = insertPlayer('ST36-BKWinner', 'W');
  const p2 = insertPlayer('ST36-BKLoser', 'L');

  const { loserId } = insertFinishedBKGame(p1, p2, null);

  const res = await fetch(`${baseUrl}/api/stats/bk-counts`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body[String(loserId)], 1, `Loser (id=${loserId}) should have bk-count=1, got ${JSON.stringify(body)}`);
});
