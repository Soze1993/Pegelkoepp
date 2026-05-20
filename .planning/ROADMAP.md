# Roadmap: Pegelköpp Kegelclub App

## Overview

The existing `kegelclub_12.html` single-file app already has working game logic, player management, and UI. This roadmap wires that frontend to a persistent backend: Phase 1 lays the server foundation (DB, API, auth), Phase 2 delivers the real-time core value (tablet input → TV display in under 2 seconds), Phase 3 connects the existing HTML frontend to the backend API, Phase 4 adds club-night session grouping and statistics, and Phase 5 ships everything to the VPS with HTTPS and crash recovery.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Backend Foundation** - Scaffold, SQLite schema, game-type modules extracted from HTML, REST API, PIN auth (completed 2026-05-20)
- [x] **Phase 2: Real-Time & TV** - Socket.io throw sync, TV display page, undo, reconnect, connection indicator (completed 2026-05-20)
- [ ] **Phase 3: Frontend Wiring** - Connect existing HTML app to backend API; replace in-memory state with API/socket calls
- [ ] **Phase 4: Club Features** - Kegelabend sessions, statistics (wins/losses, personal records, Pudel%), custom game types
- [ ] **Phase 5: Production Deployment** - PM2, Nginx + WebSocket headers, Certbot HTTPS, crash recovery

## Phase Details

### Phase 1: Backend Foundation

**Goal**: A running Node.js/Express server with a seeded SQLite database, all 9 game-type scoring modules extracted as pure functions, a REST API for players and games, and PIN authentication protecting all write routes
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, BACK-01, BACK-02, BACK-03, PERS-01, PERS-02
**Success Criteria** (what must be TRUE):

  1. Server starts with `npm start`; `GET /api/players` returns an empty JSON array (or seeded players)
  2. A player can be created, renamed, and archived via API calls; archived players no longer appear in active lists
  3. Sending `POST /api/auth/login` with the correct PIN returns a session cookie; subsequent write requests without the cookie are rejected with 401; `GET /tv` is accessible without a cookie
  4. All 9 game-type scoring rules execute as imported pure-function modules with a known test input and produce the expected score
  5. Every throw written via API is immediately visible in the `throws` table; restarting the server does not lose any submitted throw

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: project scaffold, SQLite + WAL, idempotent seed, GET /api/players, GET /tv placeholder

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — PIN authentication + player CRUD (requireSession middleware, login/logout/status, POST/PUT/archive)
- [x] 01-03-PLAN.md — All 9 game-type pure-function modules extracted from kegelclub_12.html with node:test coverage

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Games REST API: start/get/submit-throw with synchronous persistence + rebuildActiveGames crash recovery

### Phase 2: Real-Time & TV

**Goal**: A throw entered on the tablet appears on the TV screen in under 2 seconds via Socket.io, the TV display is a full-screen autonomous page readable at 5m distance, and connection health is visible on the input device
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RT-01, RT-02, RT-03, TV-01, TV-02, TV-03, TV-04, PLAY-01
**Success Criteria** (what must be TRUE):

  1. Entering a throw on the tablet causes the TV display to update within 2 seconds with no manual page reload
  2. After the TV browser tab loses and regains network, it automatically restores the full current game state without any user action
  3. The input device shows a visible connection indicator (green/red dot or equivalent) that changes state when the WebSocket drops
  4. `/tv` loads and displays a full-screen layout with player names (min 36px) and scores (min 72px) and requires no login
  5. The user can undo the last entered throw and the correction is reflected on both the tablet and the TV immediately
  6. When no game is running, the TV shows an idle screen with the club name and last game winner

**Plans:** 4/4 plans complete
Plans:
**Wave 0**

- [x] 02-01-PLAN.md — Test scaffolding (Nyquist gate): socket.io-client devDep + server/routes/socket.test.js RED stubs (ST01–ST05) + db.test.js (DB05/DB06) + games.test.js (GT19)

**Wave 1** *(blocked on Wave 0 completion)*

- [x] 02-02-PLAN.md — Foundation slice: install socket.io + ALTER TABLE migrations (throws.meta, game_players.role) + Socket.io init on http.Server with app.locals.io + Helmet CSP allows ws:/wss:

**Wave 2** *(blocked on Wave 1 completion; 02-03 and 02-04 run in parallel — different parts of the stack)*

- [x] 02-03-PLAN.md — Throw sync + undo vertical slice: meta persistence on INSERT, reconstructState id-ASC + meta + role parsing, POST /:id/undo (requireSession, DB-first DELETE), throw:applied / undo:applied / game:started / game:finished emits — covers RT-01, PLAY-01
- [x] 02-04-PLAN.md — TV display vertical slice: public/tv.html + public/tv.js (full-screen, gold active-row overlay, permanent Letzter Wurf column, 72px scores / 36px names, idle screen, top-right connection dot, textContent-only XSS guard) + lastWinner JOIN in server connection handler + human verification checkpoint — covers RT-02, RT-03, TV-01, TV-02, TV-03, TV-04
**UI hint**: yes

### Phase 3: Frontend Wiring

**Goal**: The existing `kegelclub_12.html` interface is connected to the backend so that all 9 game types run with server-persisted state — no data lives only in browser memory
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PLAY-02
**Success Criteria** (what must be TRUE):

  1. A full game of each of the 9 built-in game types can be played end-to-end through the existing UI with all throws persisted to the database
  2. Refreshing the browser mid-game does not lose the current game state — the UI reloads the in-progress game from the server
  3. Completing a game through the UI writes the final result to the database and the result is visible via the stats/history view

**Plans**: TBD
**UI hint**: yes

### Phase 4: Club Features

**Goal**: Club members can group games into a named Kegelabend session, view per-player win/loss records and personal best scores, see Pudel statistics, and create custom game types that survive server restarts
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PERS-03, PERS-04, STAT-01, STAT-02, STAT-03
**Success Criteria** (what must be TRUE):

  1. A user can tap "Start Abend" to begin a session; all games played until "End Abend" are grouped under that session and listed together in history
  2. The player statistics view shows correct total wins and losses for each player across all recorded evenings
  3. The player statistics view shows the personal best score per game type for each player
  4. The player statistics view shows each player's total Pudel count and Pudel percentage (Pudel ÷ total throws × 100)
  5. A user can create a custom game type with a name and description; the custom type persists after a server restart and can be selected when starting a new game

**Plans**: TBD
**UI hint**: yes

### Phase 5: Production Deployment

**Goal**: The app is live on the VPS at an HTTPS URL, managed by PM2, proxied through Nginx with correct WebSocket upgrade headers, and recovers active games after any restart
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):

  1. The app is reachable in a browser via `https://` at the club's domain; HTTP redirects to HTTPS
  2. WebSocket connections work over `wss://` through Nginx — throws submitted on the tablet appear on the TV with no proxy errors
  3. After `sudo reboot` on the VPS, the app starts automatically within 60 seconds and any game that was active before the reboot is recoverable from the database

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation | 4/4 | Complete   | 2026-05-20 |
| 2. Real-Time & TV | 4/4 | Complete   | 2026-05-20 |
| 3. Frontend Wiring | 0/? | Not started | - |
| 4. Club Features | 0/? | Not started | - |
| 5. Production Deployment | 0/? | Not started | - |
