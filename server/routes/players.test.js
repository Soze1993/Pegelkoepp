'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// PIN setup — must be set before requiring app
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
  // 1. Set up isolated DB path BEFORE requiring app (which requires db)
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-routes-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.SESSION_SECRET = 'test-secret-do-not-use-in-prod';
  process.env.NODE_ENV = 'test';
  // Use tmpDir for sessions.db so it's isolated and the data/ dir exists
  process.env.SESSION_DIR = tmpDir;
  process.env.PIN_HASH = PIN_HASH; // ensure it's set even if env was reset
  fs.mkdirSync(tmpDir, { recursive: true });

  // 2. Clear module cache so app + db use our DB_PATH
  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');

  // 3. Require fresh instances
  db = require('../db/index');
  const seed = require('../db/seed');
  seed(db); // populate 12 players

  const app = require('../app');

  // 4. Start ephemeral server on random port
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  // Close server
  await new Promise((resolve) => server.close(resolve));

  // Clean up module cache
  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');

  // Clean up tmp dir
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Test 1: GET /api/players returns HTTP 200 with application/json
// ---------------------------------------------------------------------------
test('GET /api/players returns 200 with Content-Type application/json', async () => {
  const res = await fetch(`${baseUrl}/api/players`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  assert.ok(ct.includes('application/json'), `Expected application/json, got: ${ct}`);
});

// ---------------------------------------------------------------------------
// Test 2: GET /api/players returns array of 12 players with correct shape
// ---------------------------------------------------------------------------
test('GET /api/players returns JSON array of 12 seeded players with {id, name, emoji}', async () => {
  const res = await fetch(`${baseUrl}/api/players`);
  const body = await res.json();
  assert.ok(Array.isArray(body), 'Response body should be an array');
  assert.equal(body.length, 12, `Expected 12 players, got ${body.length}`);
  for (const p of body) {
    assert.ok(typeof p.id === 'number', `id should be a number, got: ${JSON.stringify(p)}`);
    assert.ok(typeof p.name === 'string' && p.name.length > 0, `name should be a non-empty string: ${JSON.stringify(p)}`);
    assert.ok(typeof p.emoji === 'string' && p.emoji.length > 0, `emoji should be a non-empty string: ${JSON.stringify(p)}`);
  }
});

// ---------------------------------------------------------------------------
// Test 3: GET /api/players does NOT include archived or created_at fields
// ---------------------------------------------------------------------------
test('GET /api/players does not include archived or created_at in response', async () => {
  const res = await fetch(`${baseUrl}/api/players`);
  const body = await res.json();
  assert.ok(body.length > 0, 'Should have players');
  for (const p of body) {
    assert.ok(!('archived' in p), `archived should not be in response: ${JSON.stringify(p)}`);
    assert.ok(!('created_at' in p), `created_at should not be in response: ${JSON.stringify(p)}`);
  }
});

// ---------------------------------------------------------------------------
// Test 4: GET /api/players omits players with archived = 1
// ---------------------------------------------------------------------------
test('GET /api/players omits players with archived=1', async () => {
  // Insert an archived player directly
  db.prepare("INSERT INTO players (name, emoji, archived) VALUES ('ArchivedPlayer', '🗑️', 1)").run();

  const res = await fetch(`${baseUrl}/api/players`);
  const body = await res.json();
  const found = body.find(p => p.name === 'ArchivedPlayer');
  assert.ok(!found, `Archived player should not appear in GET /api/players response`);
  // Count should still be 12 (the original seeded players, all non-archived)
  assert.equal(body.length, 12, `Expected 12 non-archived players, got ${body.length}`);
});

// ---------------------------------------------------------------------------
// Test 5: GET /tv returns 200, text/html, body contains 'Pegelköpp'
// ---------------------------------------------------------------------------
test('GET /tv returns 200 with text/html containing Pegelköpp', async () => {
  const res = await fetch(`${baseUrl}/tv`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  assert.ok(ct.includes('text/html'), `Expected text/html, got: ${ct}`);
  const body = await res.text();
  assert.ok(body.includes('Pegelköpp'), `TV page should contain 'Pegelköpp', got: ${body.substring(0, 200)}`);
});

// ---------------------------------------------------------------------------
// Test 6: GET /tv works without any Cookie header — no 401, no redirect
// ---------------------------------------------------------------------------
test('GET /tv works without Cookie header (unauthenticated)', async () => {
  const res = await fetch(`${baseUrl}/tv`, {
    headers: {} // no cookies
  });
  assert.equal(res.status, 200, `Expected 200 without auth, got ${res.status}`);
  // Must not be a redirect
  assert.ok(res.status < 300, `Should not redirect, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// Test 7: GET /api/players ordering is by id ASC
// ---------------------------------------------------------------------------
test('GET /api/players returns players ordered by id ASC', async () => {
  const res = await fetch(`${baseUrl}/api/players`);
  const body = await res.json();
  assert.ok(body.length > 1, 'Should have multiple players to check order');
  for (let i = 1; i < body.length; i++) {
    assert.ok(
      body[i].id > body[i - 1].id,
      `Players should be ordered by id ASC: ${body[i-1].id} -> ${body[i].id}`
    );
  }
});

// ---------------------------------------------------------------------------
// Helper: login and return session cookie string
// ---------------------------------------------------------------------------
async function loginAndGetCookie(port) {
  const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: PIN })
  });
  assert.equal(r.status, 200, `Login failed: ${r.status}`);
  const raw = r.headers.get('set-cookie');
  assert.ok(raw, 'Login should set a cookie');
  return raw.split(';')[0]; // 'connect.sid=...'
}

// ---------------------------------------------------------------------------
// Test P1: POST /api/players (no cookie) → 401
// ---------------------------------------------------------------------------
test('P1: POST /api/players without session cookie returns 401', async () => {
  const res = await fetch(`${baseUrl}/api/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test' })
  });
  assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.error, 'Authentication required',
    `Expected "Authentication required", got ${JSON.stringify(body)}`);
});

// ---------------------------------------------------------------------------
// Test P2: PUT /api/players/1 (no cookie) → 401
// ---------------------------------------------------------------------------
test('P2: PUT /api/players/:id without session cookie returns 401', async () => {
  const res = await fetch(`${baseUrl}/api/players/1`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Hacker', emoji: '🔴' })
  });
  assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// Test P3: PUT /api/players/1/archive (no cookie) → 401
// ---------------------------------------------------------------------------
test('P3: PUT /api/players/:id/archive without session cookie returns 401', async () => {
  const res = await fetch(`${baseUrl}/api/players/1/archive`, {
    method: 'PUT'
  });
  assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// Test P4: POST /api/players with valid session → 201 + player in DB
// ---------------------------------------------------------------------------
test('P4: POST /api/players with valid session creates player, returns 201', async () => {
  const { port } = server.address();
  const cookie = await loginAndGetCookie(port);

  const res = await fetch(`${baseUrl}/api/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'NewPlayer', emoji: '🎲' })
  });
  assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
  const body = await res.json();
  assert.ok(Number.isInteger(body.id) && body.id > 0, `id should be a positive integer, got ${body.id}`);
  assert.equal(body.name, 'NewPlayer', `Expected name "NewPlayer", got ${body.name}`);
  assert.equal(body.emoji, '🎲', `Expected emoji "🎲", got ${body.emoji}`);

  // Verify player appears in GET /api/players
  const listRes = await fetch(`${baseUrl}/api/players`);
  const list = await listRes.json();
  const found = list.find(p => p.id === body.id);
  assert.ok(found, `Newly created player with id ${body.id} should appear in GET /api/players`);
});

// ---------------------------------------------------------------------------
// Test P5: POST /api/players with no emoji → default emoji '🎳'
// ---------------------------------------------------------------------------
test('P5: POST /api/players with no emoji uses default emoji 🎳', async () => {
  const { port } = server.address();
  const cookie = await loginAndGetCookie(port);

  const res = await fetch(`${baseUrl}/api/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'NoEmoji' })
  });
  assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.emoji, '🎳', `Expected default emoji "🎳", got "${body.emoji}"`);
});

// ---------------------------------------------------------------------------
// Test P6: POST /api/players with no name → 400
// ---------------------------------------------------------------------------
test('P6: POST /api/players with no name returns 400', async () => {
  const { port } = server.address();
  const cookie = await loginAndGetCookie(port);

  const res = await fetch(`${baseUrl}/api/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({})
  });
  assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
  const body = await res.json();
  assert.ok(body.error, `Expected an error message, got ${JSON.stringify(body)}`);
});

// ---------------------------------------------------------------------------
// Test P7: POST /api/players with name as number → 400 (type validation)
// ---------------------------------------------------------------------------
test('P7: POST /api/players with name:123 (wrong type) returns 400', async () => {
  const { port } = server.address();
  const cookie = await loginAndGetCookie(port);

  const res = await fetch(`${baseUrl}/api/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 123 })
  });
  assert.equal(res.status, 400, `Expected 400 for non-string name, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// Test P8: PUT /api/players/:id with valid session renames player
// ---------------------------------------------------------------------------
test('P8: PUT /api/players/:id with valid session renames player', async () => {
  const { port } = server.address();
  const cookie = await loginAndGetCookie(port);

  // Get an existing player id
  const listRes = await fetch(`${baseUrl}/api/players`);
  const list = await listRes.json();
  assert.ok(list.length > 0, 'Should have players to rename');
  const targetId = list[0].id;

  const res = await fetch(`${baseUrl}/api/players/${targetId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'Renamed', emoji: '🎯' })
  });
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.ok, true, `Expected { ok: true }, got ${JSON.stringify(body)}`);

  // Verify the change appears in GET /api/players
  const listRes2 = await fetch(`${baseUrl}/api/players`);
  const list2 = await listRes2.json();
  const renamed = list2.find(p => p.id === targetId);
  assert.ok(renamed, `Player ${targetId} should still exist`);
  assert.equal(renamed.name, 'Renamed', `Expected name "Renamed", got "${renamed.name}"`);
  assert.equal(renamed.emoji, '🎯', `Expected emoji "🎯", got "${renamed.emoji}"`);
});

// ---------------------------------------------------------------------------
// Test P9: PUT /api/players/:id with non-existent id → 404
// ---------------------------------------------------------------------------
test('P9: PUT /api/players/:id with non-existent id returns 404', async () => {
  const { port } = server.address();
  const cookie = await loginAndGetCookie(port);

  const res = await fetch(`${baseUrl}/api/players/999999`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'Ghost', emoji: '👻' })
  });
  assert.equal(res.status, 404, `Expected 404, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// Test P10: PUT /api/players/:id/archive archives player (no hard delete)
// ---------------------------------------------------------------------------
test('P10: PUT /api/players/:id/archive archives player; GET excludes it; DB row survives', async () => {
  const { port } = server.address();
  const cookie = await loginAndGetCookie(port);

  // Create a player to archive
  const createRes = await fetch(`${baseUrl}/api/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'ToArchive', emoji: '📦' })
  });
  assert.equal(createRes.status, 201);
  const { id } = await createRes.json();

  // Archive it
  const archiveRes = await fetch(`${baseUrl}/api/players/${id}/archive`, {
    method: 'PUT',
    headers: { cookie }
  });
  assert.equal(archiveRes.status, 200, `Expected 200, got ${archiveRes.status}`);
  const body = await archiveRes.json();
  assert.equal(body.ok, true, `Expected { ok: true }, got ${JSON.stringify(body)}`);

  // GET /api/players should NOT include this player
  const listRes = await fetch(`${baseUrl}/api/players`);
  const list = await listRes.json();
  const found = list.find(p => p.id === id);
  assert.ok(!found, `Archived player ${id} should not appear in GET /api/players`);

  // DB row must still exist with archived=1 (no hard delete — BACK-01)
  const row = db.prepare('SELECT archived FROM players WHERE id = ?').get(id);
  assert.ok(row, `DB row for player ${id} should still exist (no hard delete)`);
  assert.equal(row.archived, 1, `Player ${id} should have archived=1, got ${row.archived}`);
});

// ---------------------------------------------------------------------------
// Test P11: PUT /api/players/:id/archive on already-archived or non-existent → 404
// ---------------------------------------------------------------------------
test('P11: PUT /api/players/:id/archive on already-archived or non-existent returns 404', async () => {
  const { port } = server.address();
  const cookie = await loginAndGetCookie(port);

  // Create and archive a player
  const createRes = await fetch(`${baseUrl}/api/players`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'AlreadyArchived', emoji: '🗑️' })
  });
  const { id } = await createRes.json();

  // First archive succeeds
  await fetch(`${baseUrl}/api/players/${id}/archive`, {
    method: 'PUT',
    headers: { cookie }
  });

  // Second archive on the same player (already archived) → 404
  const secondArchive = await fetch(`${baseUrl}/api/players/${id}/archive`, {
    method: 'PUT',
    headers: { cookie }
  });
  assert.equal(secondArchive.status, 404,
    `Second archive of already-archived player should return 404, got ${secondArchive.status}`);

  // Non-existent id → 404
  const nonExistent = await fetch(`${baseUrl}/api/players/888888/archive`, {
    method: 'PUT',
    headers: { cookie }
  });
  assert.equal(nonExistent.status, 404,
    `Archive of non-existent player should return 404, got ${nonExistent.status}`);
});
