'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

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
  fs.mkdirSync(tmpDir, { recursive: true });

  // 2. Clear module cache so app + db use our DB_PATH
  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./players');

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
