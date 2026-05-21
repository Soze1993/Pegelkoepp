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
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');

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
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');

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
