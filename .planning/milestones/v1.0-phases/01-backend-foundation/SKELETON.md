---
phase: 01-backend-foundation
created: 2026-05-19
type: walking-skeleton
---

# Walking Skeleton — Pegelköpp Backend

> Architectural decisions locked here. Subsequent phases build on this skeleton without renegotiating.

---

## Definition

The **thinnest possible end-to-end working stack** that proves the architecture works. After Plan 01 completes, a developer can:

1. Run `npm start` → server boots
2. Visit `http://localhost:3000/api/players` → JSON response (empty array or seeded players)
3. Visit `http://localhost:3000/tv` → static HTML placeholder loads (unauthenticated)
4. Verify SQLite file exists at `data/kegelclub.db` with WAL files (`*.db-wal`, `*.db-shm`)

This is the load-bearing axis: **HTTP request → Express → better-sqlite3 → JSON response**. Everything else in Phase 1+ extends this axis.

---

## Locked Architecture (from CONTEXT.md + RESEARCH.md)

### Runtime
- **Node.js 24.15.0** (already installed on dev machine)
- **No TypeScript** (per PROJECT.md — brownfield JS frontend stays JS)
- **CommonJS modules** (`require` / `module.exports`) — matches existing `kegelclub_12.html` style

### Framework
- **Express 5.2.1** (not 4.21.x — npm default is now 5.x; native async error forwarding, no `express-async-errors` shim)
- **better-sqlite3 12.10.0** for app data (synchronous API)
- **connect-sqlite3 0.9.16** for session storage (uses transitive async `sqlite3` — encapsulated, acceptable)
- **express-session 1.19.0**, **bcryptjs 3.0.3**, **helmet 8.1.0**, **morgan 1.10.1**, **cors 2.8.6**, **dotenv 17.4.2**

### Project Layout (LOCKED — D3)
```
server/
  app.js              Express app, middleware, route mounting
  server.js           HTTP entry point + seed bootstrap
  routes/             auth.js, players.js, games.js
  game-types/         index.js + 9 pure-function modules
  db/                 index.js (WAL setup), schema.sql, seed.js
  middleware/         auth.js (requireSession)
public/               Static files (tv.html, index.html placeholders)
scripts/              (reserved for future ops scripts)
data/                 SQLite files (gitignored)
.env                  PIN_HASH, SESSION_SECRET, PORT (gitignored)
.env.example          Committed template
package.json
```

### Database
- **SQLite** with **WAL journal mode** + **busy_timeout 5000ms** + **foreign_keys ON** (CONTEXT.md C5)
- App data: `data/kegelclub.db`
- Session data: `data/sessions.db` (managed by connect-sqlite3 — separate file)
- Schema loaded from `server/db/schema.sql` via `db.exec()` on startup (idempotent, `CREATE TABLE IF NOT EXISTS`)
- Tables: `players`, `games`, `game_players`, `throws`, `game_type_defs`
- `throws` table has `UNIQUE (game_id, player_id, throw_index)` (CONTEXT.md C3)

### Auth Boundary (LOCKED)
- `GET /tv` — **no auth**
- `GET /api/players` — public (read-only list of active players)
- `GET /api/games/:id` — public (read-only state, needed for TV display in Phase 2)
- `GET /api/auth/status` — public
- All `POST`, `PUT`, `DELETE` and Socket.io write events (Phase 2) — require valid session

### Session Strategy
- `express-session` with `connect-sqlite3` store
- Cookie flags: `httpOnly`, `sameSite: 'strict'`, `secure` in production, `maxAge: 7 days`
- `req.session.regenerate()` on successful login (prevents session fixation — RESEARCH.md Security Domain)

### Game State Strategy (LOCKED — from research)
- In-memory `Map<gameId, state>` during active games (correct for 2-3h club nights)
- `throws` table is the **source of truth** — server reconstructs in-memory state on restart by calling `initState(players)` then replaying all throws via `applyThrow` in `throw_index` order
- Client-computed scores are **not trusted** — server recomputes
- DB write happens **synchronously before HTTP response** (better-sqlite3 is sync; crash recovery — CONTEXT.md C2)

### Module Interface (LOCKED — D4)
Every game-type module in `server/game-types/` exports:
```javascript
{
  id: string,            // matches type_key in games table
  name: string,          // human-readable display name
  initState(players),    // → initial state object
  applyThrow(state, playerId, value, meta?),  // → NEW state (pure, never mutates)
  isFinished(state),     // → boolean
  getFinalResults(state) // → [{ playerId, score, winner, ...gameSpecific }]
}
```

### Test Framework
- **Node.js built-in `node:test`** (Node 22+ stable) — no external test framework
- Test files co-located: `*.test.js` next to the module under test
- Run: `node --test server/game-types/*.test.js` (~5s feedback latency)
- Full suite: `node --test`

### Dev Loop
- `npm run dev` → nodemon watches `server/` and `.env`, restarts on change
- `npm start` → production-style `node server/server.js` (no nodemon)
- `npm test` → `node --test`

---

## Deferred (NOT in skeleton)

| Concern | Phase |
|---------|-------|
| Socket.io real-time sync | Phase 2 |
| TV display dynamic content (game state) | Phase 2 |
| Undo last throw | Phase 2 |
| Kegelabend session grouping | Phase 4 |
| Custom game types (user-created) | Phase 4 |
| Statistics views | Phase 4 |
| PM2 + Nginx + HTTPS | Phase 5 |
| Versioned migrations (knex/db-migrate) | Phase 5 (M5 pitfall) |

---

## Threat Model — Walking Skeleton (ASVS L1)

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Express | Untrusted HTTP requests from tablet/phone/TV |
| Express → SQLite | App writes; must use prepared statements only |
| `.env` → process | Secrets loaded once at boot; never logged |

### STRIDE Register (Walking Skeleton scope)

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| T-01-01 | Information Disclosure | `.env` file containing PIN_HASH | mitigate | `.env` in `.gitignore`; `.env.example` committed with placeholder only |
| T-01-02 | Tampering | SQLite queries | mitigate | Only `db.prepare(...).run/get/all(...)` with bound parameters — no string-interpolated SQL |
| T-01-03 | Denial of Service | Concurrent SQLite writes | mitigate | WAL mode + `busy_timeout = 5000` set as first DB pragmas |
| T-01-04 | Tampering | HTTP response headers | mitigate | `helmet()` mounted before route handlers |
| T-01-SC | Tampering | npm package installs | mitigate | All Phase 1 packages [VERIFIED] in RESEARCH.md Package Legitimacy Audit (10+ year history, official GitHub sources, no postinstall scripts) — no [ASSUMED] or [SUS] packages present |

No `[ASSUMED]` or `[SUS]` packages — no blocking-human checkpoint required for installs in this phase.
