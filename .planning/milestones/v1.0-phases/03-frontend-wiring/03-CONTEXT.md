# Phase 3: Frontend Wiring - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 replaces `kegelclub_12.html`'s all-in-memory global `S` state with API and Socket.io calls. Players are loaded from `GET /api/players`, games are started via `POST /api/games`, throws submitted via `POST /api/games/:id/throws`, and state is synchronized via Socket.io events. The existing HTML structure, CSS, and render functions stay intact — only the data layer changes. Browser refresh mid-game restores state from the server. A PIN login overlay gates all app access. All 9 built-in game types must work end-to-end with persisted state.

</domain>

<decisions>
## Implementation Decisions

### File & Integration Strategy

- **D-01:** `kegelclub_12.html` is copied to `public/index.html` and wired in-place. HTML structure, CSS, and render helpers stay identical. Only JS data operations are replaced (no rewrite, no wrapper, no iframe).
- **D-02:** The global `S` object is kept as a runtime UI cache. `S.spieler` is populated via `GET /api/players` on page load. `S.aktSpiel` holds `{ gameId, state, type_key }` from the server. Every write (start game, submit throw, undo) goes through `fetch()` — never mutates `S` directly without first confirming the server response.
- **D-03:** The custom game type creator (`m-st` modal, `startGenSpiel`) is **disabled/hidden** in Phase 3. PERS-03 (custom types) is Phase 4 scope. The "Neuen Spieltyp erstellen" button in the Bibliothek tab is hidden or shows a "Kommt bald" placeholder.
- **D-04:** The **Spiele tab** pulls game history from `GET /api/games?status=finished` (new endpoint). Shows completed games most-recent-first. This satisfies success criterion 3.

### Login / Auth UX

- **D-05:** On `DOMContentLoaded`, before loading any data, call `GET /api/auth/status`. If not authenticated, show a **full-screen PIN overlay** (modal with PIN input + submit button) that blocks the entire app. The overlay is dismissed only on successful `POST /api/auth/login`. No separate login page.
- **D-06:** **No logout button** in the UI. It is a shared-PIN club app — sessions expire naturally. No per-user account to protect.
- **D-07:** A **small connection dot** (green = WebSocket connected, red = disconnected) is added to the topbar, reusing the same pattern as the TV display (`tv.js` Phase 2). It tracks the Socket.io connection state of the input device.

### Active Game Recovery on Refresh

- **D-08:** On page init (after auth check + player load), call `GET /api/games?status=active`. If an active game is returned, **auto-populate `S.aktSpiel` from server state** and automatically switch to the Spielen tab. No user confirmation prompt — seamless resume.
- **D-09:** A new **`GET /api/games`** route is added to the backend (server side addition required). Accepts optional `?status=active|finished` query parameter. Returns games sorted most-recent-first. Used by both active game recovery (D-08) and the Spiele history tab (D-04).

### Socket.io Client in Input UI

- **D-10:** After starting or resuming a game, the input device **joins the game's Socket.io room** (`socket.emit('join', gameId)`). It subscribes to `throw:applied` and `undo:applied` events. On each event, `S.aktSpiel.state` is updated from the server-returned state and the Spielen tab is re-rendered. This keeps tablet in sync with server truth (important for undo correctness).
- **D-11:** The input UI listens to **`game:started`** — if a game is started from another device/tab, the listener auto-switches to the Spielen tab and populates `S.aktSpiel`. Consistent with TV behaviour.
- **D-12:** On **`game:finished`** (either via HTTP response or socket event), the input UI shows a **results/winner banner**, then navigates to the Spiele tab. This also implements the Phase 2 deferred item: TV auto-transition to idle screen on `game:finished` is implemented in Phase 3 (deferred from Phase 2, decision [02-04]).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` — PLAY-02 (all 9 game types with backend state), AUTH-01 (PIN login + persistent session)
- `.planning/ROADMAP.md` — Phase 3 success criteria (3 items); `UI hint: yes` marker

### Prior Phase Handoff

- `.planning/phases/02-real-time-tv/02-CONTEXT.md` — Locked decisions from Phase 2 (D-09 Socket.io subscription model, D-11 event names, D-12 migration); deferred item: TV auto-transition to idle on `game:finished`
- `.planning/phases/02-real-time-tv/02-04-SUMMARY.md` — TV display implementation details; `textContent`-only rule for TV client; `lastWinner` JOIN pattern

### Key Source Files

- `kegelclub_12.html` — Original in-memory frontend; the file to copy → `public/index.html` and wire
- `server/routes/games.js` — Existing endpoints (`POST /`, `GET /:id`, `POST /:id/throws`, `POST /:id/undo`); **new `GET /` with `?status` filter needed** (D-09)
- `server/routes/auth.js` — `GET /api/auth/status`, `POST /api/auth/login` (for D-05 overlay)
- `server/routes/players.js` — `GET /api/players` (for D-02 player load)
- `public/tv.js` — Phase 2 Socket.io client; connection dot pattern to reuse in index.html (D-07)
- `public/tv.html` — Phase 2 TV display; update to handle `game:finished` → idle transition (D-12)
- `server/app.js` — Route mounting; static file serving from `public/`
- `.planning/phases/01-backend-foundation/01-CONTEXT.md` — Auth boundary (D2), session cookie setup

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `public/tv.js` — Connection dot pattern (green/red, `socket.on('connect')`/`socket.on('disconnect')`) — copy for D-07 topbar dot in index.html
- `server/routes/games.js` — `reconstructState(game)` already handles crash recovery; same data structure returned by `GET /api/games/:id` feeds `S.aktSpiel.state`
- `activeGames` Map + `game:started` / `throw:applied` / `undo:applied` event names — all defined in Phase 2; no changes needed server-side for socket events
- `server/middleware/auth.js` — `requireSession` already applied to all write routes; `GET /api/auth/status` already exists (check auth.js)

### Established Patterns

- **DB-first write ordering** — backend concern; frontend just calls API and reads response
- **`if (io)` guard in emit calls** — keep this pattern; all socket emits already guarded
- **Dark Gold theme** — `--ac: #e8b84b`, dark background, Bebas Neue (display) + DM Sans (body) — must not change in index.html migration
- **`textContent`-only rule** — applies to TV client (`tv.js`); not required in index.html (controlled input)
- **`GET /api/games/:id`** — already unauthenticated; TV can poll without session; same endpoint serves recovery

### Integration Points

- **`public/index.html`** — new home for the wired frontend; served as static file by Express from `public/`
- **`GET /api/games` (new)** — needs to be added in `server/routes/games.js` before the `/:id` route (ordering matters in Express)
- **Socket.io room join** — client emits `join` event with `gameId`; server already handles this (check `socket.test.js` for the `join` handler existence)
- **`game:finished` → TV idle** — `public/tv.js` needs to handle `game:finished` event by transitioning to the idle screen (currently shows last state; add transition logic here)

</code_context>

<specifics>
## Specific Ideas

- Login overlay: single PIN `<input type="password">` field + "Anmelden" button; on success, close overlay and call init sequence. Same dark/gold styling as the rest of the app.
- Winner banner after `game:finished`: brief (2-3 seconds) gold banner with "🏆 [Winner name] hat gewonnen!" before navigating to Spiele tab.
- Spiele tab history: list of finished games, each showing game type icon + name, date, winner name — matches the existing `.stc` card style already in the HTML.
- Active game recovery: no toast or prompt — just silently restore and navigate, same as if the user had just started a game. Avoids interrupting flow.

</specifics>

<deferred>
## Deferred Ideas

- **Custom game types (PERS-03)** — the `m-st` creator modal and `startGenSpiel` function are disabled in Phase 3. Full implementation (backend `game_type_defs` table + frontend persistence) belongs in Phase 4.
- **Full statistics page (STAT-01/02/03)** — `S.spieler` in-memory stats (wins, losses, Pudel%) are not connected to the DB in Phase 3. The Statistik tab can remain as a placeholder or show a "Coming soon" message. Full stats are Phase 4.
- **Player management write operations (PERS-01, BACK-01)** — adding/renaming/archiving players via the UI. The backend API already exists. Phase 3 may include this as a stretch goal if it fits, but it is not in the Phase 3 success criteria.

</deferred>

---

*Phase: 03-frontend-wiring*
*Context gathered: 2026-05-20*
