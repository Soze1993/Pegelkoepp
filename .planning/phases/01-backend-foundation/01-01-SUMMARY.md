---
phase: 01-backend-foundation
plan: "01"
subsystem: backend-skeleton
tags:
  - skeleton
  - express
  - sqlite
  - node
  - wal
  - tdd

dependency_graph:
  requires: []
  provides:
    - "Express 5 HTTP server (npm start / npm run dev)"
    - "SQLite DB with WAL mode at data/kegelclub.db"
    - "GET /api/players — public JSON endpoint"
    - "GET /tv — unauthenticated HTML page"
    - "db module: better-sqlite3 instance with WAL + FK + schema"
    - "seed function: idempotent 12-player insert"
  affects:
    - "Plans 01-02, 01-03, 01-04 — all build on this skeleton"

tech_stack:
  added:
    - "express@5.2.1"
    - "better-sqlite3@12.10.0"
    - "express-session@1.19.0"
    - "connect-sqlite3@0.9.16"
    - "bcryptjs@3.0.3"
    - "dotenv@17.4.2"
    - "helmet@8.1.0"
    - "morgan@1.10.1"
    - "cors@2.8.6"
    - "nodemon@3.1.14 (dev)"
  patterns:
    - "CommonJS modules (require/module.exports) — no TypeScript"
    - "WAL journal mode as first DB pragma"
    - "Idempotent seed guard via COUNT(*) check"
    - "TDD: tests written before implementation (Tasks 2 and 3)"
    - "Isolated tmp DB paths in tests via process.env.DB_PATH"
    - "Express 5 native async error forwarding — no express-async-errors"

key_files:
  created:
    - path: "package.json"
      lines: 33
      note: "Exact versions, 5 scripts (start, dev, test, test:games, seed)"
    - path: ".gitignore"
      lines: 5
      note: "Excludes node_modules/, data/, .env"
    - path: ".env.example"
      lines: 10
      note: "PIN_HASH, SESSION_SECRET, PORT, NODE_ENV, CORS_ORIGIN placeholders"
    - path: "server/db/schema.sql"
      lines: 48
      note: "5 tables: players, games, game_players, throws (UNIQUE constraint), game_type_defs"
    - path: "server/db/index.js"
      lines: 22
      note: "WAL + busy_timeout + foreign_keys as first 3 pragmas; mkdirSync before DB open"
    - path: "server/db/seed.js"
      lines: 40
      note: "COUNT(*) guard; 12 placeholder players in transaction"
    - path: "server/db/db.test.js"
      lines: 140
      note: "8 tests: WAL, FK, 5 tables, UNIQUE, seed-once, idempotent, shape, isolated DB"
    - path: "server/app.js"
      lines: 58
      note: "Express 5; helmet, morgan, cors, session, /tv, /api/players, error middleware"
    - path: "server/server.js"
      lines: 17
      note: "HTTP entry point; seed on startup; listens on PORT"
    - path: "server/routes/players.js"
      lines: 15
      note: "GET /api/players — SELECT id, name, emoji WHERE archived=0 ORDER BY id ASC"
    - path: "server/routes/players.test.js"
      lines: 140
      note: "7 tests: shape, no hidden fields, archived filter, TV unauth, id order"
    - path: "public/tv.html"
      lines: 18
      note: "Black placeholder with Pegelköpp heading (8vw); no auth required"
    - path: "public/index.html"
      lines: 4
      note: "Minimal placeholder for Phase 3 frontend"
  modified: []

key_decisions:
  - "Express 5.2.1 chosen over Express 4 — native async error forwarding, no express-async-errors shim"
  - "WAL journal mode set as first DB pragma (CONTEXT.md C5) — concurrent read safety"
  - "connect-sqlite3 uses async sqlite3 internally (separate from better-sqlite3) — acceptable, encapsulated"
  - "SESSION_DIR env var added to app.js to allow tests to redirect sessions.db to isolated tmp path"
  - "Tests use per-test fresh DB files (incrementing counter in path) to avoid shared state"

requirements_completed:
  - PERS-01
  - PERS-02
  - AUTH-02

metrics:
  duration: "~35 minutes"
  completed: "2026-05-20"
  tasks_completed: 3
  tasks_total: 4
  files_created: 13
  tests_written: 15
  tests_passing: 15
---

# Phase 1 Plan 1: Walking Skeleton Summary

**One-liner:** Express 5 + better-sqlite3 (WAL mode) walking skeleton with 12 seeded players, public GET /api/players, and unauthenticated GET /tv — 15 tests green via node:test TDD.

## Duration and Scope

- **Start:** 2026-05-20
- **Tasks completed:** 3 of 4 (Task 4 is a human verification checkpoint — PAUSED)
- **Files created:** 13
- **Tests written:** 15 (8 DB + 7 routes)
- **Tests passing:** 15/15

## What Was Built

### Task 1: Node.js Scaffold
- `package.json` with exact dependency versions and 5 npm scripts
- Runtime: express@5.2.1, better-sqlite3@12.10.0, express-session@1.19.0, connect-sqlite3@0.9.16, bcryptjs@3.0.3, dotenv@17.4.2, helmet@8.1.0, morgan@1.10.1, cors@2.8.6
- Dev: nodemon@3.1.14
- `.gitignore` (node_modules/, data/, .env excluded)
- `.env.example` (PIN_HASH, SESSION_SECRET, PORT, NODE_ENV, CORS_ORIGIN placeholders)
- `better-sqlite3` compiled successfully on Windows 10 (C++ build tools present)

### Task 2: Database Layer (TDD)
- `server/db/schema.sql` — 5 tables verbatim from CONTEXT.md including `UNIQUE (game_id, player_id, throw_index)` on throws
- `server/db/index.js` — WAL + busy_timeout(5000) + foreign_keys(ON) as first 3 pragmas; `fs.mkdirSync` before `new Database()`
- `server/db/seed.js` — `COUNT(*) > 0` guard; 12 placeholder players inserted in a `db.transaction()`
- `server/db/db.test.js` — 8 tests, all passing

### Task 3: Express App + Routes (TDD)
- `server/routes/players.js` — `GET /api/players`: `SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id ASC`
- `server/app.js` — Express 5; helmet → morgan → cors → json → urlencoded → session → /tv → static → /api/players → error middleware
- `server/server.js` — `http.createServer(app)`; `seed(db)` on startup; `server.listen(PORT)`
- `public/tv.html` — black background, "Pegelköpp" at 8vw, no auth
- `public/index.html` — minimal Phase 3 placeholder
- `server/routes/players.test.js` — 7 tests, all passing

## Test Results

```
✔ DB sets journal_mode to WAL
✔ DB sets foreign_keys ON
✔ All 5 tables exist after init
✔ throws table has UNIQUE constraint on (game_id, player_id, throw_index)
✔ seed() inserts exactly 12 players on first call
✔ seed() is idempotent — calling twice does not add duplicates
✔ All seeded players have non-empty name, emoji and archived=0
✔ Tests use isolated tmp DB path, not data/kegelclub.db
✔ GET /api/players returns 200 with Content-Type application/json
✔ GET /api/players returns JSON array of 12 seeded players with {id, name, emoji}
✔ GET /api/players does not include archived or created_at in response
✔ GET /api/players omits players with archived=1
✔ GET /tv returns 200 with text/html containing Pegelköpp
✔ GET /tv works without Cookie header (unauthenticated)
✔ GET /api/players returns players ordered by id ASC

tests 15 | pass 15 | fail 0
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLite sqlite_sequence table caused Test 3 to fail**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** SQLite automatically creates an internal `sqlite_sequence` table when using AUTOINCREMENT. Test 3 (count 5 tables) found 6 tables, not 5.
- **Fix:** Filtered `sqlite_master` query with `WHERE name NOT LIKE 'sqlite_%'` to exclude SQLite internals.
- **Files modified:** `server/db/db.test.js`
- **Impact:** Zero — test now correctly counts the 5 application tables.

**2. [Rule 1 - Bug] Shared DB state caused Tests 5 & 6 to fail**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** Tests 5 and 6 (seed tests) shared state with Test 4 (which had inserted a player row). The `freshDb()` helper cleared the require cache but reused the same DB file path, so Test 5 saw 1 pre-existing player instead of 0.
- **Fix:** Each `freshDb()` call now uses a unique file path (`test-${counter}.db`) in the tmp dir.
- **Files modified:** `server/db/db.test.js`
- **Impact:** Zero — each test now has a fully isolated SQLite file.

**3. [Rule 2 - Missing Critical] SESSION_DIR env var added for test isolation**
- **Found during:** Task 3 (TDD GREEN phase)
- **Issue:** `connect-sqlite3` creates `sessions.db` at `./data/sessions.db` (relative CWD path). After tests closed the server and removed the tmpDir, async cleanup inside `connect-sqlite3` fired `SQLITE_CANTOPEN`. This caused the test file to report a failure even though all 7 test assertions passed.
- **Fix:** Added `SESSION_DIR` env var support to `app.js`. Tests set `SESSION_DIR = tmpDir` so sessions land in the isolated tmp directory.
- **Files modified:** `server/app.js`, `server/routes/players.test.js`
- **Impact:** Tests now run cleanly with zero async leakage. The `SESSION_DIR` env var is documented in `.env.example` context (production uses default `./data`).

**Total deviations:** 3 auto-fixed (2 test logic bugs, 1 missing test isolation feature)
**Impact:** All deviations were within Task 2 and Task 3 scope. No architectural changes. No plan decisions violated.

## Known Stubs

- `server/db/seed.js` — Player names are placeholders (`Anna`, `Ben`, `Clara`, etc.). The `// TODO: replace with actual Pegelköpp member names and emojis (Pegelköpp #2)` comment is intentional per RESEARCH.md Assumption A3. The user must update these with real club member data.
- `public/tv.html` — Static placeholder. Phase 2 wires Socket.io + dynamic game state display.
- `public/index.html` — Minimal placeholder. Phase 3 wires the actual frontend.

## Threat Surface Scan

All STRIDE mitigations from the plan's threat model are implemented:
- **T-01-01** (`.env` disclosure): `.env` in `.gitignore`, only `.env.example` committed — DONE
- **T-01-02** (SQL injection): Only `db.prepare(...).all()` with bound parameters in players.js — DONE
- **T-01-03** (DoS via SQLite): WAL + busy_timeout=5000 as first DB pragmas — DONE (verified by db.test.js test 1)
- **T-01-04** (Missing security headers): `helmet()` is first middleware in app.js — DONE
- **T-01-05** (Stack trace leak): Error middleware returns `{ error: err.message }` only — DONE
- **T-01-06** (Session cookie flags): httpOnly + sameSite:strict + secure-in-prod + 7-day maxAge — DONE

No new security-relevant surfaces introduced beyond the plan's threat model.

## Notes for Plans 02-04

- **Plan 02 (PIN auth + player CRUD):** Mount `auth.js` routes with `app.use('/api/auth', ...)` BEFORE `/api/players`. Add `requireSession` middleware to POST/PUT routes in players.js. The public `GET /api/players` is already wired without auth.
- **Plan 02:** `server/middleware/auth.js` directory already exists per D3 folder layout — just needs the file.
- **Plan 03 (game types):** `server/game-types/` directory already in plan structure — create index.js and 9 modules there.
- **Plan 04 (games API):** `server/routes/games.js` will need `activeGames` Map and `reconstructState` function per PATTERNS.md.
- **All plans:** Session store uses `data/sessions.db`; app data uses `data/kegelclub.db` — both in gitignored `data/` directory.

## Pending: Task 4 — Human Verification

Task 4 requires the user to run a manual smoke test:

1. `npm start` → console prints `Pegelköpp server listening on port 3000`
2. `curl http://localhost:3000/api/players` → JSON array of 12 players `[{id, name, emoji}]`
3. Open `http://localhost:3000/tv` → black page, "Pegelköpp" visible (8vw), no login prompt
4. `ls data/` → confirms `kegelclub.db`, `kegelclub.db-shm`, `kegelclub.db-wal` exist
5. Restart server → still exactly 12 players (idempotent seed)
6. `npm test` → 15/15 tests pass
7. Git status → `.env.example` committed, `.env` and `data/` NOT in git

## Self-Check: PASSED

- All 13 created files exist on disk: VERIFIED
- 3 production commits exist: 186b5a1, df467e4, 34227f7
- `npm test` passes 15/15: VERIFIED (run output above)
- `.env` does NOT exist: VERIFIED
- `express-async-errors` NOT in node_modules: VERIFIED
- WAL pragma is first operation in db/index.js: VERIFIED (line 14)
- UNIQUE constraint in schema.sql: VERIFIED (line 31)
- COUNT(*) guard in seed.js: VERIFIED (line 8)
