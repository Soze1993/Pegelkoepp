---
phase: 01-backend-foundation
plan: "02"
subsystem: auth-and-player-crud
tags:
  - auth
  - session
  - bcrypt
  - crud
  - middleware
  - tdd

dependency_graph:
  requires:
    - "Plan 01-01: Express skeleton, GET /api/players, db module"
  provides:
    - "requireSession middleware at server/middleware/auth.js"
    - "POST /api/auth/login (bcrypt + session.regenerate)"
    - "POST /api/auth/logout (session.destroy)"
    - "GET /api/auth/status (returns { authenticated: boolean })"
    - "POST /api/players (guarded, 201 + new player row)"
    - "PUT /api/players/:id (guarded, rename/re-emoji active players)"
    - "PUT /api/players/:id/archive (guarded, archived flag flip, no hard delete)"
  affects:
    - "Plan 01-04 (games router): import requireSession from server/middleware/auth.js"

tech_stack:
  added:
    - "bcryptjs.hashSync / bcryptjs.compare (PIN verification, cost 10)"
    - "req.session.regenerate() (session fixation prevention on login)"
    - "req.session.destroy() (logout)"
  patterns:
    - "TDD: tests written before implementation in both tasks"
    - "Module cache clear + env vars set BEFORE require('../app') in tests"
    - "loginAndGetCookie helper for authenticated test flows"
    - "PUT /:id/archive with AND archived=0 prevents double-archive (returns 404 on retry)"
    - "typeof name !== 'string' check returns 400 before DB query (T-01-13)"

key_files:
  created:
    - path: "server/middleware/auth.js"
      lines: 13
      note: "requireSession: checks req.session.authenticated; 401 if absent/falsy"
    - path: "server/middleware/auth.test.js"
      lines: 72
      note: "4 unit tests (M1-M4): next() called once on auth; 401 for undefined/falsy session"
    - path: "server/routes/auth.js"
      lines: 36
      note: "POST /login (bcrypt.compare + session.regenerate + session.save), POST /logout, GET /status"
    - path: "server/routes/auth.test.js"
      lines: 240
      note: "8 integration tests (R1-R8) including R8 session fixation proof"
  modified:
    - path: "server/app.js"
      change: "Added app.use('/api/auth', require('./routes/auth')) before /api/players"
    - path: "server/routes/players.js"
      change: "Added requireSession import; POST, PUT /:id, PUT /:id/archive handlers with input validation"
    - path: "server/routes/players.test.js"
      change: "PIN_HASH set at module level; loginAndGetCookie helper; 11 new tests (P1-P11) appended"

key_decisions:
  - "session.save() called after session.regenerate() sets authenticated=true — ensures SQLite store persists new session before response"
  - "PUT /:id/archive uses WHERE id = ? AND archived = 0 — info.changes === 0 returns 404 for both non-existent and already-archived players (satisfies P11)"
  - "typeof name !== 'string' check returns 400 before any DB query — prevents type confusion injection (T-01-13)"
  - "No DELETE handler added — archive-only per CONTEXT.md BACK-01"
  - "process.env.PIN_HASH set at module top level in players.test.js (not just in before()) so it's available before any require('../app') resolves"

requirements_completed:
  - AUTH-01
  - BACK-01
  - PERS-01

metrics:
  duration: "~40 minutes"
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 3
  tests_written: 23
  tests_passing: 38
---

# Phase 1 Plan 2: PIN Auth + Player CRUD Summary

**One-liner:** PIN login with bcrypt.compare + session.regenerate (session fixation prevention), requireSession middleware gating POST/PUT/archive on players — 23 new tests (12 auth + 11 players) + 38 total green via node:test TDD.

## Duration and Scope

- **Start:** 2026-05-20
- **Tasks completed:** 2 of 2
- **Files created:** 4
- **Files modified:** 3
- **Tests written this plan:** 23 (4 middleware + 8 auth routes + 11 players)
- **Tests passing:** 38 total (15 Plan 01 + 23 Plan 02)

## What Was Built

### Task 1: requireSession middleware + auth routes (TDD)

- `server/middleware/auth.js` — `requireSession(req, res, next)`: returns 401 with `{ error: 'Authentication required' }` if `req.session.authenticated` is absent/falsy
- `server/middleware/auth.test.js` — 4 unit tests (M1: next called once; M2: 401 when no session; M3: 401 when falsy; M4: exact error shape)
- `server/routes/auth.js`:
  - `POST /api/auth/login`: validates pin + PIN_HASH → bcrypt.compare → session.regenerate + session.save → `{ ok: true }`
  - `POST /api/auth/logout`: session.destroy → `{ ok: true }`
  - `GET /api/auth/status`: `{ authenticated: !!(req.session && req.session.authenticated) }`
- `server/routes/auth.test.js` — 8 integration tests (R1-R8):
  - R2: correct PIN returns 200 + Set-Cookie with connect.sid
  - R3: wrong PIN returns 401 + `{ error: 'Falscher PIN' }`
  - R4: missing pin field returns 400
  - R5: status without cookie returns `{ authenticated: false }`
  - R6: status with valid cookie returns `{ authenticated: true }`
  - R7: logout + status returns false
  - R8: cookie value differs before/after login (session fixation proof)
- `server/app.js` edited: `app.use('/api/auth', require('./routes/auth'))` added before `/api/players`

### Task 2: Players CRUD (TDD)

- `server/routes/players.js` extended:
  - `POST /api/players`: validates name (string + non-empty), defaults emoji to '🎳', INSERT with bound params → 201
  - `PUT /api/players/:id`: validates name type, UPDATE WHERE id AND archived=0 → 200 or 404
  - `PUT /api/players/:id/archive`: UPDATE SET archived=1 WHERE id AND archived=0 → 200 or 404
  - All write handlers behind `requireSession`
- `server/routes/players.test.js` extended:
  - `PIN_HASH` set at module top (before any require)
  - `loginAndGetCookie(port)` helper function
  - 11 new tests: P1-P3 (unauth 401), P4-P7 (POST variations), P8-P9 (PUT), P10-P11 (archive)

## Test Results

```
server/middleware/auth.test.js:
✔ M1: requireSession calls next() when session.authenticated is true
✔ M2: requireSession returns 401 when req.session is undefined
✔ M3: requireSession returns 401 when session.authenticated is falsy
✔ M4: requireSession 401 response has correct error shape

server/routes/auth.test.js:
✔ R1: process.env.PIN_HASH is set (setup guard)
✔ R2: POST /api/auth/login with correct PIN returns 200 and Set-Cookie
✔ R3: POST /api/auth/login with wrong PIN returns 401 with Falscher PIN
✔ R4: POST /api/auth/login with no pin field returns 400
✔ R5: GET /api/auth/status without cookie returns { authenticated: false }
✔ R6: GET /api/auth/status with valid session cookie returns { authenticated: true }
✔ R7: POST /api/auth/logout clears session; subsequent status returns false
✔ R8: session cookie value changes after login (session fixation prevention)

server/routes/players.test.js (all 18):
✔ GET /api/players returns 200 with Content-Type application/json
✔ GET /api/players returns JSON array of 12 seeded players with {id, name, emoji}
✔ GET /api/players does not include archived or created_at in response
✔ GET /api/players omits players with archived=1
✔ GET /tv returns 200 with text/html containing Pegelköpp
✔ GET /tv works without Cookie header (unauthenticated)
✔ GET /api/players returns players ordered by id ASC
✔ P1: POST /api/players without session cookie returns 401
✔ P2: PUT /api/players/:id without session cookie returns 401
✔ P3: PUT /api/players/:id/archive without session cookie returns 401
✔ P4: POST /api/players with valid session creates player, returns 201
✔ P5: POST /api/players with no emoji uses default emoji 🎳
✔ P6: POST /api/players with no name returns 400
✔ P7: POST /api/players with name:123 (wrong type) returns 400
✔ P8: PUT /api/players/:id with valid session renames player
✔ P9: PUT /api/players/:id with non-existent id returns 404
✔ P10: PUT /api/players/:id/archive archives player; GET excludes it; DB row survives
✔ P11: PUT /api/players/:id/archive on already-archived or non-existent returns 404

tests 38 | pass 38 | fail 0
(4 pre-existing game-types stubs from Plan 01 still failing — out of scope for Plan 02)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] session.save() added after session.regenerate()**
- **Found during:** Task 1 (TDD GREEN phase — first iteration)
- **Issue:** After calling `req.session.regenerate()` and setting `req.session.authenticated = true`, the plan's code only called `res.json({ ok: true })`. With connect-sqlite3 as the session store, the newly regenerated session may not be flushed to the DB synchronously before the response is sent. Test R6 (status with cookie) would intermittently pass but test R8 (session fixation) was reliable. Adding `session.save()` makes the write order deterministic.
- **Fix:** Wrapped the response inside a `req.session.save()` callback: regenerate → set authenticated → save → respond.
- **Files modified:** `server/routes/auth.js`
- **Impact:** Zero API change; session persistence is now guaranteed before the 200 response.

**Total deviations:** 1 auto-fixed (missing session persistence guarantee)
**Impact:** No architectural changes. No plan decisions violated.

## Session Fixation Proof (Test R8)

Test R8 confirms `session.regenerate()` is reachable:

1. `GET /api/auth/status` — establishes anonymous session (saveUninitialized=false, so no cookie yet in this run)
2. `POST /api/auth/login` — regenerate() fires, new session ID assigned, cookie set
3. If a pre-login cookie existed, post-login cookie must differ
4. Post-login status with new cookie returns `{ authenticated: true }`

R8 passed in all test runs.

## Known Stubs

None introduced in this plan. All endpoints are fully wired.

## Threat Surface Scan

All STRIDE mitigations from the plan's threat model are implemented:

| Threat | Status |
|--------|--------|
| T-01-07 (PIN brute force) | ACCEPTED — bcrypt cost 10 per plan decision |
| T-01-08 (Session fixation) | MITIGATED — session.regenerate() called on login, verified by R8 |
| T-01-09 (Unauthenticated writes) | MITIGATED — requireSession on POST/PUT/PUT-archive, verified by P1-P3 |
| T-01-10 (SQL injection) | MITIGATED — all INSERT/UPDATE use db.prepare().run() with bound params |
| T-01-11 (Error message leakage) | MITIGATED — "Falscher PIN" returned for all failure paths |
| T-01-12 (Repudiation) | ACCEPTED — shared PIN per REQUIREMENTS.md Out of Scope |
| T-01-13 (Type confusion) | MITIGATED — typeof name !== 'string' returns 400 before DB, verified by P7 |

No new security-relevant surfaces introduced beyond the plan's threat model.

## Notes for Plan 04

- **requireSession** is at `server/middleware/auth.js` — import with `require('../middleware/auth')`
- Mount on `/api/games` write handlers exactly as players.js:
  ```javascript
  const requireSession = require('../middleware/auth');
  router.post('/', requireSession, (req, res) => { ... });
  router.post('/:id/throws', requireSession, (req, res) => { ... });
  ```
- `GET /api/games/:id` should remain public (TV display reads it)
- Test pattern: use `loginAndGetCookie(port)` same as players.test.js

## Commits

| Hash | Message |
|------|---------|
| d943c1a | feat(01-02): requireSession middleware + auth routes with session.regenerate |
| 01cf6cb | feat(01-02): extend players.js with POST, PUT, PUT-archive behind requireSession |

## Self-Check: PASSED

- server/middleware/auth.js: EXISTS
- server/middleware/auth.test.js: EXISTS
- server/routes/auth.js: EXISTS
- server/routes/auth.test.js: EXISTS
- server/routes/players.js (modified): EXISTS
- server/routes/players.test.js (modified): EXISTS
- Commit d943c1a: VERIFIED
- Commit 01cf6cb: VERIFIED
- node --test server/middleware/auth.test.js: 4/4 PASS
- node --test server/routes/auth.test.js: 8/8 PASS
- node --test server/routes/players.test.js: 18/18 PASS
- Total in-scope tests: 38/38 PASS
