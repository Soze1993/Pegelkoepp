'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// requireSession will be required once the implementation exists
const requireSession = require('./auth');

// ---------------------------------------------------------------------------
// Test M1: session.authenticated === true → calls next() exactly once
// ---------------------------------------------------------------------------
test('M1: requireSession calls next() when session.authenticated is true', () => {
  const req = { session: { authenticated: true } };
  let nextCalled = 0;
  let nextArgs = [];
  const next = (...args) => { nextCalled++; nextArgs = args; };
  const res = {
    status: () => ({ json: () => {} })
  };
  requireSession(req, res, next);
  assert.equal(nextCalled, 1, 'next() should be called exactly once');
  assert.equal(nextArgs.length, 0, 'next() should be called with no arguments');
});

// ---------------------------------------------------------------------------
// Test M2: req.session is undefined → returns 401, does NOT call next()
// ---------------------------------------------------------------------------
test('M2: requireSession returns 401 when req.session is undefined', () => {
  const req = {}; // no session property
  let nextCalled = 0;
  let statusCode = null;
  let jsonBody = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (body) => { jsonBody = body; }
      };
    }
  };

  requireSession(req, res, () => { nextCalled++; });
  assert.equal(nextCalled, 0, 'next() should NOT be called');
  assert.equal(statusCode, 401, `Expected status 401, got ${statusCode}`);
  assert.ok(jsonBody !== null, 'Response body should be set');
});

// ---------------------------------------------------------------------------
// Test M3: session exists but authenticated is falsy → returns 401
// ---------------------------------------------------------------------------
test('M3: requireSession returns 401 when session.authenticated is falsy', () => {
  const cases = [
    { session: { authenticated: false } },
    { session: { authenticated: null } },
    { session: { authenticated: 0 } },
    { session: {} } // authenticated property absent
  ];

  for (const req of cases) {
    let nextCalled = 0;
    let statusCode = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };

    requireSession(req, res, () => { nextCalled++; });
    assert.equal(nextCalled, 0, `next() should NOT be called for req: ${JSON.stringify(req)}`);
    assert.equal(statusCode, 401, `Expected 401 for req: ${JSON.stringify(req)}`);
  }
});

// ---------------------------------------------------------------------------
// Test M4: 401 response body has shape { error: 'Authentication required' }
// ---------------------------------------------------------------------------
test('M4: requireSession 401 response has correct error shape', () => {
  const req = { session: { authenticated: false } };
  let jsonBody = null;

  const res = {
    status: () => ({
      json: (body) => { jsonBody = body; }
    })
  };

  requireSession(req, res, () => {});
  assert.ok(typeof jsonBody === 'object' && jsonBody !== null, 'Body should be an object');
  assert.ok(typeof jsonBody.error === 'string' && jsonBody.error.length > 0,
    `error field should be a non-empty string, got: ${JSON.stringify(jsonBody)}`);
  assert.equal(jsonBody.error, 'Authentication required',
    `Expected "Authentication required", got "${jsonBody.error}"`);
});
