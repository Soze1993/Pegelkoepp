# Phase 2: Real-Time & TV - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the core value of the app: a throw entered on the tablet appears on the TV display in under 2 seconds via Socket.io — plus the `/tv` full-screen page itself, a WebSocket connection indicator on the input device, single-step undo, and the schema fixes required for full game-type support (meta column + fuchsjagd role).

</domain>

<decisions>
## Implementation Decisions

### TV Display Layout

- **D-01:** Player arrangement — **Vollbreite Zeilen** (full-width rows). Each player gets one row: name on the left, score on the right. Works for any player count.
- **D-02:** Current player highlight — **Heller Zeilenhintergrund** (light background overlay on the active player's row). The rest of the rows stay dark. Use the gold accent color (`#e8b84b`) at low opacity for the overlay.
- **D-03:** Last throw — **Dauerhaft in jeder Spielerzeile** als separate Spalte ("Letzter Wurf"). Always visible, not a temporary toast. Shows the most recent throw value for each player.
- **D-04:** Idle screen (no active game) — **"Pegelköpp" + letzter Sieger**. Large club name, below it "Letzter Sieger: [Name]". Fallback: "Noch kein Spiel gespielt" if no games are in the DB yet. No date or extra info needed.

### Undo UX & API

- **D-05:** Button placement — **Always visible in the game input area** once at least 1 throw has been entered in the current game. Not a toast/snackbar — a persistent button (e.g., arrow-left icon or "Rückgängig" label).
- **D-06:** Confirmation — **1-Tap confirm**. First tap shows "Wirklich rückgängig?" inline. Second tap executes. Protects against accidental touch on a tablet during an active Kegelabend.
- **D-07:** TV reaction to undo — **Silent update**. TV just shows the corrected state without any visual flash or special indicator. The state update arrives via Socket.io and the UI re-renders normally.
- **D-08 (API — Claude's discretion):** `POST /api/games/:id/undo` — requires session. DB-first: delete the last throw row for the current active game, recompute state via `reconstructState`, update `activeGames` Map, emit Socket.io event with the corrected state. Returns `{ state, finished }`.

### Socket.io Subscription Model

- **D-09:** TV auto-subscribes to the active game — no URL parameter or manual navigation. On WebSocket `connection`, the server immediately emits the current game state (or idle state if no game is running). TV always shows whatever is active.
- **D-10:** Multiple active games (edge case) — **TV shows the most recently started game** (highest `id` in the `games` table with `status = 'active'`). No split-screen.
- **D-11 (Claude's discretion):** Socket.io event names — `game:state` (initial state push on connect + re-sync), `throw:applied` (new throw), `undo:applied` (undo), `game:started` (new game begins — TV switches automatically), `game:finished` (game ends, TV shows result briefly then idle).

### Schema Migration (Phase 1 Carryover)

- **D-12:** Migration approach — **ALTER TABLE on server startup** in `db/index.js`. Use `ALTER TABLE ... ADD COLUMN` guarded by a try/catch (SQLite returns an error if column already exists — swallow it). Idempotent. No DROP/CREATE, no data loss.
- **D-13:** Columns to add:
  - `throws.meta TEXT NULL` — stores `JSON.stringify(meta)` for game types that require throw metadata (grosseHaus/kleineHaus: `{ slot: 'h'|'z'|'e' }`, viergewinnt: `{ pudel: true|false }`). Parse on `reconstructState`.
  - `game_players.role TEXT NULL` — stores fuchsjagd player role (`'fuchs'` or `null`). Read by `fuchsjagd.initState(players)` during reconstruction. Must be passed when creating a fuchsjagd game via `POST /api/games`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — RT-01, RT-02, RT-03, TV-01, TV-02, TV-03, TV-04, PLAY-01 (all Phase 2 requirements with acceptance criteria)
- `.planning/ROADMAP.md` — Phase 2 success criteria (6 items); also contains the `UI hint: yes` marker for this phase

### Phase 1 Handoff
- `.planning/phases/01-backend-foundation/01-CONTEXT.md` — Locked decisions from Phase 1 (D1–D5, auth boundary, game state strategy, SQLite schema)
- `.planning/phases/01-backend-foundation/01-04-SUMMARY.md` — Known limitations: `throws.meta` absence, fuchsjagd role absence, Socket.io integration sketch (section "Known Limitations"), exported symbols (`activeGames`, `reconstructState`, `rebuildActiveGames`)

### Key Source Files
- `server/server.js` — HTTP server entry point; Socket.io `io` instance to be added here
- `server/routes/games.js` — REST handlers; `activeGames` Map exported; `POST /throws` handler to emit Socket.io events after D-08 undo endpoint added
- `server/db/index.js` — SQLite setup + WAL; ALTER TABLE migration code goes here (D-12)
- `server/middleware/auth.js` — `requireSession` middleware (for undo endpoint)
- `server/game-types/index.js` — exports all 9 game modules; `applyThrow(state, playerId, value, meta)` signature already accepts meta

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `activeGames` Map (`server/routes/games.js`): exported singleton — Socket.io emits after throw/undo use this directly
- `reconstructState(game)` (`server/routes/games.js`): rebuilds state from DB; used by TV reconnect flow (`GET /api/games/:id` is already unauthenticated)
- `requireSession` (`server/middleware/auth.js`): applied to all write routes; extend to undo endpoint
- `GET /api/games/:id`: already unauthenticated — TV can poll full state on reconnect/recovery without session cookie
- `server/app.js`: mounts routes; Socket.io `io` to be attached as `app.locals.io` or shared module so `routes/games.js` can emit without circular imports

### Established Patterns
- **DB-first write ordering**: INSERT/DELETE to DB before mutating `activeGames` — non-negotiable; extends to undo DELETE
- **idempotent schema init**: `CREATE TABLE IF NOT EXISTS` in `schema.sql`; ALTER TABLE migration uses same spirit (try/catch on duplicate column)
- **`game:${gameId}` room naming**: sketched in Phase 1 SUMMARY — use this convention for Socket.io rooms
- **Dark Gold theme**: gold accent `#e8b84b`, dark background, Bebas Neue (display) + DM Sans (body) — TV page must match

### Integration Points
- **Socket.io init**: `server.js` creates `http.Server`; `socket.io` attaches to it; `io` passed to `routes/games.js` via `app.locals.io` or direct require
- **TV page `/tv`**: currently a placeholder (200 HTML, no auth); Phase 2 replaces it with the full TV display page (served from `public/tv.html` or an inline route)
- **Undo route**: new `DELETE /api/games/:id/throws/last` or `POST /api/games/:id/undo` in `routes/games.js` — reuses existing `reconstructState` after deletion

</code_context>

<specifics>
## Specific Ideas

- TV player rows: name left, "Letzter Wurf" center/right as small label, score on far right — all in one `<li>` or `<div>` row
- Active player row background: `background: rgba(232, 184, 75, 0.15)` (gold accent at 15% opacity) to stay legible on dark background
- TV font sizes (REQUIREMENTS TV-03): scores **min 72px**, player names **min 36px** — these are hard requirements, not guidelines
- TV idle screen: large centered "Pegelköpp" in Bebas Neue, smaller subtitle "Letzter Sieger: [Name]"
- Connection indicator (RT-03): green dot = WebSocket connected, red dot = disconnected; placed in a fixed corner of the input UI (e.g., top-right status bar)
- Socket.io auto-reconnect: Socket.io's built-in reconnect + on `connect` event, client requests `game:state` to restore current state — satisfies RT-02 without custom logic

</specifics>

<deferred>
## Deferred Ideas

- **TV layout per game type** — custom full-screen layouts tailored to each of the 9 game types (e.g., Vier Gewinnt showing a grid). Deferred to v2 backlog (listed in REQUIREMENTS.md v2 section). Phase 2 delivers one universal layout that works for all types.
- **Multi-step undo (undo history)** — PLAY-01 specifies single-step undo only. A full undo stack is v2.

</deferred>

---

*Phase: 02-real-time-tv*
*Context gathered: 2026-05-20*
