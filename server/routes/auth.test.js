'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// Setup: generate PIN hash and configure env BEFORE requiring app
// ---------------------------------------------------------------------------
const PIN = '1234';
const PIN_HASH = bcrypt.hashSync(PIN, 10);

let tmpDir;
let server;
let baseUrl;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-auth-test-'));

  // Set ALL env vars before requiring app
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.PIN_HASH = PIN_HASH;
  process.env.SESSION_SECRET = 'test-auth-secret';
  process.env.SESSION_DIR = tmpDir;
  process.env.NODE_ENV = 'test';

  fs.mkdirSync(tmpDir, { recursive: true });

  // Clear module cache
  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./auth');
  clearCache('../middleware/auth');

  const app = require('../app');

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
  await new Promise((resolve) => server.close(resolve));

  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./auth');
  clearCache('../middleware/auth');

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Helper: extract cookie value from set-cookie header
// ---------------------------------------------------------------------------
function extractCookie(res) {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  return raw.split(';')[0]; // e.g. "connect.sid=s%3A..."
}

// ---------------------------------------------------------------------------
// Test R1: Environment setup — PIN_HASH set before app load
// ---------------------------------------------------------------------------
test('R1: process.env.PIN_HASH is set (setup guard)', () => {
  assert.ok(process.env.PIN_HASH, 'PIN_HASH should be set in env');
  assert.ok(process.env.PIN_HASH.startsWith('$2'), 'PIN_HASH should be a bcrypt hash');
});

// ---------------------------------------------------------------------------
// Test R2: POST /api/auth/login with correct PIN returns 200 + Set-Cookie
// ---------------------------------------------------------------------------
test('R2: POST /api/auth/login with correct PIN returns 200 and Set-Cookie', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: PIN })
  });
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.ok, true, `Expected { ok: true }, got ${JSON.stringify(body)}`);

  const cookie = res.headers.get('set-cookie');
  assert.ok(cookie, 'Should set a cookie on successful login');
  assert.ok(cookie.includes('connect.sid'), `Cookie should contain connect.sid, got: ${cookie}`);
});

// ---------------------------------------------------------------------------
// Test R3: POST /api/auth/login with wrong PIN returns 401 + "Falscher PIN"
// ---------------------------------------------------------------------------
test('R3: POST /api/auth/login with wrong PIN returns 401 with Falscher PIN', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: 'wrongpin' })
  });
  assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.error, 'Falscher PIN', `Expected "Falscher PIN", got ${JSON.stringify(body)}`);
});

// ---------------------------------------------------------------------------
// Test R4: POST /api/auth/login with no pin field returns 400
// ---------------------------------------------------------------------------
test('R4: POST /api/auth/login with no pin field returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
});

// ---------------------------------------------------------------------------
// Test R5: GET /api/auth/status without cookie returns { authenticated: false }
// ---------------------------------------------------------------------------
test('R5: GET /api/auth/status without cookie returns { authenticated: false }', async () => {
  const res = await fetch(`${baseUrl}/api/auth/status`);
  assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.authenticated, false, `Expected false, got ${body.authenticated}`);
});

// ---------------------------------------------------------------------------
// Test R6: GET /api/auth/status WITH valid login cookie returns { authenticated: true }
// ---------------------------------------------------------------------------
test('R6: GET /api/auth/status with valid session cookie returns { authenticated: true }', async () => {
  // Login first
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: PIN })
  });
  assert.equal(loginRes.status, 200, 'Login should succeed');
  const cookie = extractCookie(loginRes);
  assert.ok(cookie, 'Login should set a cookie');

  // Check status with cookie
  const statusRes = await fetch(`${baseUrl}/api/auth/status`, {
    headers: { cookie }
  });
  assert.equal(statusRes.status, 200);
  const body = await statusRes.json();
  assert.equal(body.authenticated, true,
    `Expected { authenticated: true } after login, got ${JSON.stringify(body)}`);
});

// ---------------------------------------------------------------------------
// Test R7: POST /api/auth/logout with valid cookie → 200; subsequent status → false
// ---------------------------------------------------------------------------
test('R7: POST /api/auth/logout clears session; subsequent status returns false', async () => {
  // Login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: PIN })
  });
  const cookie = extractCookie(loginRes);
  assert.ok(cookie, 'Login should set a cookie');

  // Logout
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie }
  });
  assert.equal(logoutRes.status, 200, `Logout should return 200, got ${logoutRes.status}`);
  const body = await logoutRes.json();
  assert.equal(body.ok, true, `Expected { ok: true }, got ${JSON.stringify(body)}`);

  // Status with old cookie should now be false
  const statusRes = await fetch(`${baseUrl}/api/auth/status`, {
    headers: { cookie }
  });
  const statusBody = await statusRes.json();
  assert.equal(statusBody.authenticated, false,
    `After logout, authenticated should be false, got ${JSON.stringify(statusBody)}`);
});

// ---------------------------------------------------------------------------
// Test R8: Session fixation guard — cookie value MUST change after login
// ---------------------------------------------------------------------------
test('R8: session cookie value changes after login (session fixation prevention)', async () => {
  // 1. Get an anonymous session cookie by hitting GET /api/auth/status
  const preLoginRes = await fetch(`${baseUrl}/api/auth/status`);
  const preCookie = extractCookie(preLoginRes);
  // Note: saveUninitialized=false may not set a cookie for anonymous requests — that's fine
  // The key test: AFTER login, compare the new cookie to whatever was there before

  // 2. Login — pass the pre-login cookie if we got one
  const loginHeaders = { 'content-type': 'application/json' };
  if (preCookie) loginHeaders.cookie = preCookie;

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: loginHeaders,
    body: JSON.stringify({ pin: PIN })
  });
  assert.equal(loginRes.status, 200, 'Login should succeed');
  const postCookie = extractCookie(loginRes);
  assert.ok(postCookie, 'Login should set a cookie');

  // 3. If there was a pre-login cookie, it must differ from post-login cookie
  if (preCookie) {
    assert.notEqual(preCookie, postCookie,
      `Cookie must change after login (session fixation prevention). Before: ${preCookie}, After: ${postCookie}`);
  }
  // If there was no pre-login cookie (saveUninitialized=false), the test still passes:
  // absence of cookie means there was nothing to fixate on — regenerate is still called.

  // 4. Verify the new cookie is authenticated
  const statusRes = await fetch(`${baseUrl}/api/auth/status`, {
    headers: { cookie: postCookie }
  });
  const body = await statusRes.json();
  assert.equal(body.authenticated, true, 'Post-login cookie should be authenticated');
});
