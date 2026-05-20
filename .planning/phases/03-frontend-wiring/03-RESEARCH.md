# Phase 3: Frontend Wiring - Research

**Researched:** 2026-05-20
**Domain:** Vanilla JS SPA migration — in-memory state to REST/Socket.io backend
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**File & Integration Strategy**
- D-01: `kegelclub_12.html` is copied to `public/index.html` and wired in-place. HTML structure, CSS, and render helpers stay identical. Only JS data operations are replaced (no rewrite, no wrapper, no iframe).
- D-02: The global `S` object is kept as a runtime UI cache. `S.spieler` is populated via `GET /api/players` on page load. `S.aktSpiel` holds `{ gameId, state, type_key }` from the server. Every write (start game, submit throw, undo) goes through `fetch()` — never mutates `S` directly without first confirming the server response.
- D-03: Custom game type creator (`m-st` modal, `startGenSpiel`) is **disabled/hidden** in Phase 3. PERS-03 (custom types) is Phase 4 scope.
- D-04: The **Spiele tab** pulls game history from `GET /api/games?status=finished` (new endpoint). Shows completed games most-recent-first.

**Login / Auth UX**
- D-05: On `DOMContentLoaded`, before loading any data, call `GET /api/auth/status`. If not authenticated, show a **full-screen PIN overlay** (modal with PIN input + submit button) that blocks the entire app. Dismissed only on successful `POST /api/auth/login`.
- D-06: No logout button.
- D-07: A small connection dot (green/red) added to topbar, reusing the tv.js pattern. Tracks Socket.io connection state of the input device.

**Active Game Recovery on Refresh**
- D-08: On page init (after auth check + player load), call `GET /api/games?status=active`. If an active game is returned, auto-populate `S.aktSpiel` from server state and automatically switch to the Spielen tab. No user confirmation prompt.
- D-09: New `GET /api/games` route added to backend. Accepts optional `?status=active|finished` query parameter. Returns games sorted most-recent-first. Must be added BEFORE `/:id` route in Express (ordering matters).

**Socket.io Client in Input UI**
- D-10: After starting or resuming a game, the input device joins the game's Socket.io room (`socket.emit('join', gameId)`). Subscribes to `throw:applied` and `undo:applied`. On each event, `S.aktSpiel.state` is updated from server-returned state and Spielen tab is re-rendered.
- D-11: Input UI listens to `game:started` — if started from another device/tab, auto-switches to Spielen tab and populates `S.aktSpiel`.
- D-12: On `game:finished`, show results/winner banner (2-3 seconds), then navigate to Spiele tab. Also implements Phase 2 deferred: TV auto-transition to idle screen on `game:finished`.

### Claude's Discretion

None specified beyond the above.

### Deferred Ideas (OUT OF SCOPE)

- Custom game types (PERS-03) — `m-st` creator modal and `startGenSpiel` disabled in Phase 3. Phase 4 scope.
- Full statistics page (STAT-01/02/03) — Statistik tab can remain placeholder or "Coming soon". Phase 4.
- Player management write operations (PERS-01, BACK-01) — stretch goal only; not in Phase 3 success criteria.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-02 | All 9 built-in game types work with backend-connected state | All 9 game-type modules exist server-side and are verified. The HTML already has per-game-type render logic and start modals. Research maps each game type's start flow, throw submission, and state-read patterns — including the viergewinnt team/role field gap that must be fixed in Phase 3. |

</phase_requirements>

---

## Summary

Phase 3 migrates `kegelclub_12.html` — a 378-line single-file app with all state in a global `S` object — into `public/index.html` where every data read and write routes through the backend API and Socket.io. The HTML, CSS, and render functions are untouched; only the ~15 JS functions that create, mutate, or query in-memory game state are replaced.

The codebase is in excellent shape for this migration. The backend has all 9 game modules, `reconstructState` handles crash recovery correctly for all types including meta (grosseHaus/kleineHaus slots, viergewinnt pudel flag), and the Socket.io event names and room pattern are established. The only backend addition needed is `GET /api/games` with `?status` filtering — a 15-line route addition — plus a one-line fix in `vier-gewinnt.js` where `initState` reads `p.team` but `games.js` passes `p.role`.

The primary complexity is the **9 different start-modal and game-render flows** that each have different payload shapes (some use `roles`, some use `meta`, KDA is match-based not throw-based, Fuchsjagd has a non-standard state shape). Each must be wired individually; there is no single unified start-game function in the original HTML.

**Primary recommendation:** Wire game types in complexity order — dreiVollen first (simplest, no meta), then plusMinus/anker (no meta, simple state), then grosseHaus/kleineHaus (meta.slot required), then fuchsjagd (role-based, non-standard state), then viergewinnt (after fixing team/role gap), then KDA and bilderkegel (complex state shapes). TV idle transition is a single-line change in `tv.js`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PIN auth overlay | Browser (index.html) | API (auth.js) | UI gate; server already has GET /api/auth/status + POST /api/auth/login |
| Player list display | Browser (S.spieler cache) | API (GET /api/players) | Read-only in Phase 3; loaded once on init |
| Game start (all 9 types) | API (POST /api/games) | Browser (closes modal, sets S.aktSpiel) | Server initiates; client reads response |
| Throw submission | API (POST /api/games/:id/throws) | Socket.io (throw:applied broadcast) | DB-first ordering is a locked constraint |
| Undo | API (POST /api/games/:id/undo) | Socket.io (undo:applied broadcast) | Same DB-first ordering |
| Active game recovery | Browser (GET /api/games?status=active on init) | — | Client-driven on page load |
| Game history (Spiele tab) | API (GET /api/games?status=finished — NEW) | Browser (renders list) | New endpoint, server-authoritative |
| Real-time sync (tablet) | Socket.io client in index.html | — | join room after game start, listen for throw:applied + undo:applied |
| Winner banner | Browser (timed DOM injection) | — | 2-3 second banner, no server involvement |
| TV idle transition | Browser (tv.js — add game:finished handler) | — | Phase 2 deferred stub — single-line fix |
| Connection dot | Browser (socket connect/disconnect events) | — | Copy pattern from tv.js verbatim |

---

## Standard Stack

No new packages needed. All dependencies are already installed.

| Library | Installed Version | Purpose in Phase 3 |
|---------|-------------------|---------------------|
| Socket.io client | served via `/socket.io/socket.io.js` (auto-served) | WebSocket for tablet real-time sync (same as TV) |
| `fetch` (native browser) | browser-native | REST API calls from index.html |
| `express-session` | 1.19.0 (installed) | Session cookie sent automatically with same-origin fetch |
| `better-sqlite3` | 12.10.0 (installed) | Backend DB — no change needed |

[VERIFIED: package.json — no new npm installs required for Phase 3]

---

## Package Legitimacy Audit

No new packages installed in this phase. Section not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (index.html)
        |
        | DOMContentLoaded
        v
[Auth gate] -----> GET /api/auth/status
        |                   |
        |        not authed |           authed
        |                   v              v
        |          show PIN overlay     init()
        |          POST /api/auth/login ---> on success, call init()
        |
        v (init sequence)
  GET /api/players       --> S.spieler = response
  GET /api/games?status=active
        |
        +-- found:  S.aktSpiel = {gameId, state, type_key}; showTab('spielen')
        +-- none:   S.aktSpiel = null
        |
        v
  io() -- Socket.io connect (same-origin)
        |
        socket.on('connect')      --> connDot green; if S.aktSpiel: emit('join', gameId)
        socket.on('disconnect')   --> connDot red
        socket.on('game:started') --> S.aktSpiel = {gameId, state, type_key}; emit('join'); showTab('spielen')
        socket.on('throw:applied')--> S.aktSpiel.state = event.state; renderSpielenTab()
        socket.on('undo:applied') --> S.aktSpiel.state = event.state; renderSpielenTab()
        socket.on('game:finished')--> showWinnerBanner(state); setTimeout(-->showTab('spiele'), 2500)
        |
        renderAll()
        |
        v (Spielen tab — user submits throw)
  User clicks "Wurf bestaetigen"
        |
        v
  POST /api/games/:id/throws  {player_id, throw_index, value, [meta]}
        |
        +-- response {state, finished:false} --> S.aktSpiel.state = state; renderSpielenTab()
        +-- response {state, finished:true}  --> showWinnerBanner(state); navigate to Spiele tab
        |
        (server also emits throw:applied / game:finished to room for TV and other tabs)
        |
        v (TV display — public/tv.js)
  socket.on('game:finished') --> renderGame(state); setTimeout(renderIdle, 3000)  [ADD THIS]
```

### Recommended Project Structure

No new folders needed. All changes are within existing files:

```
public/
  index.html      NEW — copy of kegelclub_12.html with JS data layer replaced
  tv.html         UNCHANGED
  tv.js           MODIFIED — add game:finished idle transition (1 line)
server/
  routes/
    games.js      MODIFIED — add GET / with ?status filter (before /:id route)
  game-types/
    vier-gewinnt.js   MODIFIED — fix p.team -> p.role in initState
```

### Pattern 1: Fetch-then-update (all write operations)

**What:** Always call the API first; update `S` and re-render only from the confirmed server response. Never mutate `S` before the server confirms.

**When to use:** Every function that currently mutates `S` directly: startVG, doVGWurf, doNWurf, doFJWurf, doAnkerWurf, doBKWurf, kdaSetWinner.

**Example:**
```javascript
// Based on D-02 from 03-CONTEXT.md
async function doNWurf() {
  // ... validate local selection (selK, hausSlot, etc.) ...
  const player = S.aktSpiel.state.players[S.aktSpiel.state.aktSpIdx];
  const throwIndex = player.wuerfe ? player.wuerfe.length : 0;

  const res = await fetch('/api/games/' + S.aktSpiel.gameId + '/throws', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ player_id: player.id, throw_index: throwIndex, value: selK, meta: meta || undefined })
  });
  if (!res.ok) { notify('Fehler beim Wurf', 'var(--red)'); return; }
  const data = await res.json();
  S.aktSpiel.state = data.state;
  selK = null;
  if (data.finished) {
    handleGameFinished(data.state);
  } else {
    renderSpielenTab();
  }
}
```

### Pattern 2: Init Sequence (DOMContentLoaded)

**What:** Sequential async init — auth gate first, then player load, then active game recovery, then Socket.io connect and initial render.

**Example:**
```javascript
// Based on D-05, D-02, D-08, D-07 from 03-CONTEXT.md
document.addEventListener('DOMContentLoaded', async function() {
  const authRes = await fetch('/api/auth/status');
  const { authenticated } = await authRes.json();
  if (!authenticated) {
    showPINOverlay(); // overlay submit calls init() after successful login
    return;
  }
  await init();
});

async function init() {
  const players = await fetch('/api/players').then(r => r.json());
  S.spieler = players;

  const games = await fetch('/api/games?status=active').then(r => r.json());
  if (games.length) {
    const g = games[0];
    const detail = await fetch('/api/games/' + g.id).then(r => r.json());
    S.aktSpiel = { gameId: g.id, state: detail.state, type_key: g.type_key };
    showTab('spielen');
  }

  initSocket(); // connect Socket.io, set up handlers
  renderAll();
}
```

### Pattern 3: Socket.io Room Join (D-10)

**What:** After setting `S.aktSpiel`, emit `join` to subscribe to game-scoped throw/undo events.

**Example:**
```javascript
// Based on D-10, D-11 from 03-CONTEXT.md; server already handles 'join' event
function joinGameRoom(gameId) {
  socket.emit('join', gameId);
}

socket.on('throw:applied', function({ state }) {
  if (S.aktSpiel) S.aktSpiel.state = state;
  renderSpielenTab();
});

socket.on('undo:applied', function({ state }) {
  if (S.aktSpiel) S.aktSpiel.state = state;
  renderSpielenTab();
});

socket.on('game:started', function({ gameId, state, type_key }) {
  S.aktSpiel = { gameId, state, type_key };
  joinGameRoom(gameId);
  showTab('spielen');
});
```

### Pattern 4: Render from S.aktSpiel.state (server state as sole display source)

**What:** All render functions for the Spielen tab read from `S.aktSpiel.state` (server-authoritative). The old in-memory arrays (`S.spiele`, `S.vgSpiele`, etc.) are not used.

**When to use:** Every renderXxxSpiel function.

**Old dispatch (remove):**
```javascript
// OLD: checks S.aktBK, S.aktKDA, S.aktAnker, S.aktFJ, S.aktVG, S.aktSpiel
function renderSpielenTab() {
  if (S.aktBK) { renderBKSpiel(el); return; }
  // ...etc.
}
```

**New dispatch (use):**
```javascript
// NEW: single S.aktSpiel with type_key discriminant
function renderSpielenTab() {
  var el = document.getElementById('r-spielen');
  if (!S.aktSpiel) { /* show empty state */ return; }
  switch (S.aktSpiel.type_key) {
    case 'viergewinnt':  renderVGSpiel(el, S.aktSpiel.state); break;
    case 'fuchsjagd':    renderFJSpiel(el, S.aktSpiel.state); break;
    case 'anker':        renderAnkerSpiel(el, S.aktSpiel.state); break;
    case 'kda':          renderKDASpiel(el, S.aktSpiel.state); break;
    case 'bilderkegel':  renderBKSpiel(el, S.aktSpiel.state); break;
    default:             renderNSpiel(el, S.aktSpiel.state); break; // dreiVollen, plusMinus, grosseHaus, kleineHaus
  }
}
```

### Anti-Patterns to Avoid

- **Direct S mutation before fetch:** Setting `S.aktSpiel = { gameId: newId }` before calling the API. If the API call fails, local state is permanently corrupted.
- **Using S.spiele / S.vgSpiele as authoritative stores:** These in-memory arrays are removed in Phase 3. The Spiele tab reads from the API.
- **Frontend throw_index from stale cached counts:** Always derive `throw_index` from `S.aktSpiel.state.players`, not from a frontend variable that may predate an undo.
- **Calling updSp() after game ends:** This function mutates in-memory player stats. It is removed entirely. Stats are a Phase 4 concern.
- **Calling renderAll() in Socket.io event handlers:** Renders all tabs including the expensive Spiele tab. Only call `renderSpielenTab()` from socket event handlers.

---

## Detailed Game-Type Wiring Analysis

This is the most critical section. Each of the 9 game types has a distinct start flow, throw payload shape, and state structure.

### Group A: Standard players-array state (dreiVollen, plusMinus, anker)

These types produce `state.players[].wuerfe[]` structure. Simplest to wire.

| Game Type | type_key | Start Modal | Config Needed | Meta? | State Key Fields |
|-----------|----------|-------------|--------------|-------|-----------------|
| Drei in die Vollen | `dreiVollen` | `m-spiel-gen` | none | No | `state.players[].wuerfe[]`, `state.aktSpIdx` |
| Plus/Minus/Mal | `plusMinus` | `m-spiel-gen` | none | No | `state.players[].wuerfe[]`, `state.aktSpIdx`, `state.pmRunde` |
| Anker | `anker` | `m-anker` | `{ maxRunden: N }` | No | `state.players[].runden[][]`, `state.aktSpIdx`, `state.aktRunde`, `state.wurfNr` |

**Anker note:** Input is `ankerPts` (0/1/2/3/4/5/10 Punkte), not 0-9 kegelboard. Value sent to API is the points directly. No meta needed.

### Group B: Meta-required state (grosseHaus, kleineHaus, viergewinnt)

| Game Type | type_key | Start Modal | Roles Needed | Meta Shape | State Key Fields |
|-----------|----------|-------------|-------------|-----------|-----------------|
| Grosse Hausnummer | `grosseHaus` | `m-spiel-gen` | No | `{ slot: 'h'|'z'|'e' }` | `state.players[].slots{h,z,e}`, `state.aktSpIdx` |
| Kleine Hausnummer | `kleineHaus` | `m-spiel-gen` | No | `{ slot: 'h'|'z'|'e' }` | `state.players[].slots{h,z,e}`, `state.aktSpIdx` |
| Vier Gewinnt | `viergewinnt` | `m-vg` | Yes — 'X'/'O' per player | `{ pudel: true }` for Pudel only | `state.grid[][]`, `state.tX[]`, `state.tO[]`, `state.aktT`, `state.iX`, `state.iO`, `state.done` |

**Viergewinnt start payload:**
```javascript
POST /api/games {
  type_key: 'viergewinnt',
  player_ids: [...vgX, ...vgO],
  roles: Object.fromEntries([...vgX.map(id => [id, 'X']), ...vgO.map(id => [id, 'O'])])
}
```

**Viergewinnt throw payload:** For a column selection: `{ player_id: currentPlayerId, throw_index: throwCount, value: colIndex }`. For a pudel: `{ player_id: currentPlayerId, throw_index: throwCount, value: 0, meta: { pudel: true } }`.

### Group C: Role-based non-standard state (fuchsjagd)

| Game Type | type_key | Start Modal | Roles Needed | Meta? | State Key Fields |
|-----------|----------|-------------|-------------|-------|-----------------|
| Fuchsjagd | `fuchsjagd` | `m-fj` | Yes — 'fuchs'/'jaeger' | No | `state.fuchs{id,name,w[],pudel}`, `state.jaeger[]`, `state.fp`, `state.phase`, `state.jIdx`, `state.jPhase`, `state.done`, `state.winner` |

**Fuchsjagd start payload:**
```javascript
POST /api/games {
  type_key: 'fuchsjagd',
  player_ids: [fjFuchs, ...fjJaeger],
  roles: { [fjFuchs]: 'fuchs', ...Object.fromEntries(fjJaeger.map(id => [id, 'jaeger'])) }
}
```

**Active player derivation from state:**
```javascript
function getFJActivePlayerId(state) {
  if (state.phase === 'start') return state.fuchs.id;
  if (state.jPhase === 'jaeger') return state.jaeger[state.jIdx].id;
  return state.fuchs.id; // fuchs replies
}
```

**throw_index for Fuchsjagd:** Total throws across all players in insertion order. Use total `state.fuchs.w.length + state.jaeger.reduce((s,j)=>s+j.w.length,0)` as `throw_index`.

### Group D: Complex match/bild-based state (kda, bilderkegel)

| Game Type | type_key | Start Modal | Config | Meta? | State Key Fields |
|-----------|----------|-------------|--------|-------|-----------------|
| Kegler des Abends | `kda` | `m-kda` | `{ seed: Date.now() }` | No | `state.spieler[]`, `state.matches[]`, `state.mid`, `state.bye`, `state.gewinner`, `state.done` |
| Bilderkegel | `bilderkegel` | `m-bk` | none | No | `state.players[].bildPts[]`, `state.players[].wuerfe[][]`, `state.aktSpIdx`, `state.aktBildIdx`, `state.aktWurfNr` |

**KDA throw encoding:** `applyThrow(state, matchId, winnerId)` — `playerId` param = matchId, `value` param = winnerId. The `throw_index` should be the match's sequential position (use `state.matches.filter(m=>m.done).length` as next throw_index for idempotency).

**KDA config — seed:** Pass `config: { seed: Date.now() }` when starting KDA so `seededShuffle` is used. This makes the initial bracket deterministic for recovery after crash. [ASSUMED — KDA module supports seed config per kegler-des-abends.js line 42]

---

## New Backend Route Required (D-09)

`GET /api/games` with `?status` filter — add to `server/routes/games.js` as the FIRST route (before `/:id`).

```javascript
// Must appear BEFORE router.get('/:id', ...) — Express route ordering
router.get('/', (req, res) => {
  const { status } = req.query;
  const games = status
    ? db.prepare('SELECT id, type_key, status, started_at, finished_at FROM games WHERE status = ? ORDER BY id DESC').all(status)
    : db.prepare('SELECT id, type_key, status, started_at, finished_at FROM games ORDER BY id DESC').all();
  res.json(games);
});
```

**Auth:** Unauthenticated read-only. Consistent with `GET /api/games/:id` which is also unauthenticated.

---

## Viergewinnt Bug Fix Required

`server/game-types/vier-gewinnt.js` `initState` reads `p.team` but the games route stores player role under `p.role`. Both `tX` and `tO` arrays will be empty without this fix.

```javascript
// Current (broken for API use):
tX: players.filter(p => p.team === 'X').map(...)

// Fix:
tX: players.filter(p => p.role === 'X').map(...)
tO: players.filter(p => p.role === 'O').map(...)
```

[VERIFIED: vier-gewinnt.js line 31-32 reads p.team; games.js line 48-50 stores as role]

---

## TV Idle Transition (Phase 2 Deferred Item — D-12)

Current stub in `public/tv.js`:
```javascript
socket.on('game:finished', ({ state }) => renderGame(state));
// Note: auto-idle transition deferred to Phase 3
```

Fix (one line change):
```javascript
socket.on('game:finished', function({ state }) {
  renderGame(state);
  setTimeout(function() { renderIdle(null); }, 3000);
});
```

The `null` means "Noch kein Spiel gespielt" will show briefly. On the next Socket.io connection event (or page refresh), the server pushes the correct `lastWinner`. This is acceptable for Phase 3. [ASSUMED — user may prefer immediate winner name display; flag as open question]

---

## State Translation Map (HTML S object to API)

### S object fields that change

| Old S field | New behavior |
|-------------|-------------|
| `S.spieler` | Loaded from `GET /api/players` on init; re-read after player add |
| `S.aktSpiel` (was int id) | Now `{ gameId: number, state: object, type_key: string }` |
| `S.aktVG`, `S.aktFJ`, `S.aktAnker`, `S.aktKDA`, `S.aktBK` | REMOVED — all game types use `S.aktSpiel` |
| `S.spiele`, `S.vgSpiele`, `S.fjSpiele`, `S.ankerSpiele`, `S.kdaSpiele`, `S.bkSpiele` | REMOVED — Spiele tab reads from API |
| `S.typen` | KEPT for Bibliothek display (static list); custom type section hidden |
| `S.nid` | REMOVED — IDs come from DB autoincrement |

### Key function changes

| Function | Change |
|----------|--------|
| `addSpieler()` | Replace push with `POST /api/players` + re-fetch players |
| `startVG()` | Replace push with `POST /api/games` with roles map |
| `startFJ()` | Replace push with `POST /api/games` with roles map |
| `startAnker()` | Replace push with `POST /api/games` with config `{ maxRunden }` |
| `startKDA()` | Replace push with `POST /api/games` with config `{ seed }` |
| `startBK()` | Replace push with `POST /api/games` |
| `startGenSpiel()` | Replace push with `POST /api/games` (dreiVollen, plusMinus, grosseHaus, kleineHaus) |
| `doNWurf()` | Replace state mutation with `POST /api/games/:id/throws` |
| `doVGWurf()` | Replace with API call; meta `{ pudel: true }` for Pudel |
| `doFJWurf()` | Replace with API call; derive active player from state |
| `doAnkerWurf()` | Replace with API call; value = ankerPts |
| `doBKWurf()` | Replace with API call |
| `kdaSetWinner()` | Replace with `POST throws { player_id: matchId, value: winnerId }` |
| `updSp()` | REMOVE entirely — stats are Phase 4 |
| `renderSpiele()` | Replace in-memory arrays with `GET /api/games?status=finished` |
| `renderSpielenTab()` | Replace 6-way S.aktXxx dispatch with single type_key switch |
| All `renderXxxSpiel()` | Read from `S.aktSpiel.state` instead of in-memory arrays |
| All undo button actions | Replace in-memory pop with `POST /api/games/:id/undo` |
| `saveST()` | HIDE — custom types disabled (D-03) |
| `delST()` | HIDE — not applicable for built-in types |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Crash recovery / state reconstruction | Custom serialization | `reconstructState()` in games.js | Already handles all 9 types + meta correctly |
| Game finish detection | Frontend isFinished logic | `data.finished` field in API response | Server module handles per-type completion |
| Session management | Custom cookie parsing | Same-origin `fetch()` with no credentials option needed | Express-session + httpOnly cookie auto-sent |
| Socket.io room subscription | Custom pub/sub | `socket.emit('join', gameId)` | Server already has the join handler (verified in socket.test.js) |
| Throw ordering uniqueness | Frontend dedup logic | Server's `UNIQUE(game_id, player_id, throw_index)` constraint | Returns 409 on duplicate; frontend handles gracefully |

**Key insight:** The server's `reconstructState` correctly replays all throw history including meta for all 9 game types. The frontend never needs to recompute game state from scratch — every API response includes the complete current state.

---

## Common Pitfalls

### Pitfall 1: Express Route Ordering — GET /api/games vs GET /api/games/:id

**What goes wrong:** If `GET /api/games` is added AFTER `GET /:id` in games.js, requests to `/api/games?status=active` will match the `/:id` handler with `req.params.id = undefined` (query string stripped). No error — just returns 404 for game id "undefined".

**Why it happens:** Express matches routes in registration order. `/:id` matches any path segment.

**How to avoid:** Add `router.get('/', ...)` as the very first route in games.js, before `router.get('/:id', ...)`.

**Warning signs:** `GET /api/games?status=active` returns 404 or `{ error: 'Game not found' }`.

### Pitfall 2: throw_index Calculation After Undo

**What goes wrong:** The original HTML tracks throw index implicitly via `akt.wuerfe.length`. After undo removes the last throw, `player.wuerfe.length` decreases. If the frontend uses a stale cached count (pre-undo value), it submits a duplicate throw_index and gets a 409.

**Why it happens:** After undo, `S.aktSpiel.state` is updated from the undo response — but if any local variable still caches the old count, the next throw_index calculation is wrong.

**How to avoid:** Always derive throw_index fresh from `S.aktSpiel.state` at the moment of submission:
```javascript
const player = S.aktSpiel.state.players.find(p => p.id === playerId);
const throwIndex = player.wuerfe ? player.wuerfe.length : 0;
```

**Warning signs:** 409 Conflict from `POST /api/games/:id/throws` after an undo.

### Pitfall 3: Viergewinnt team vs role field

**What goes wrong:** `vier-gewinnt.js initState` filters by `p.team === 'X'` but the games route passes players with `p.role` (not `p.team`). Both `tX` and `tO` arrays come out empty. Game starts but no teams exist.

**How to avoid:** Fix `vier-gewinnt.js initState` to read `p.role` before this phase begins.

**Warning signs:** Viergewinnt game created successfully but state has `tX: []` and `tO: []`.

### Pitfall 4: S.aktVG / S.aktFJ etc. still referenced in render dispatchers

**What goes wrong:** `renderSpielenTab()` checks the old 6-way dispatch chain. All games now live in `S.aktSpiel`. VG, FJ, Anker, KDA, BK games will never be dispatched to their render function.

**How to avoid:** Replace `renderSpielenTab` entirely with a `type_key` switch on `S.aktSpiel.type_key`.

**Warning signs:** Starting a Fuchsjagd game shows the "Kein aktives Spiel" empty state instead of the game UI.

### Pitfall 5: Bilderkegel nested wuerfe array shape

**What goes wrong:** Bilderkegel stores `wuerfe` as a nested array per bild `wuerfe[bildIdx][wurfNr]`. If the frontend render function assumes `wuerfe[]` is flat (like dreiVollen), the display breaks and last-throw tracking is wrong.

**How to avoid:** Read `bilderkegel.js` applyThrow signature carefully before implementing the render function. Match render to exact server state field names.

**Warning signs:** Bilderkegel shows wrong throw history or wrong active bild.

### Pitfall 6: KDA applyThrow parameter semantics

**What goes wrong:** KDA's `applyThrow(state, matchId, winnerId)` repurposes the `player_id` parameter as `matchId` and `value` as `winnerId`. If the frontend sends `player_id` as the actual player ID doing the "throw", the tournament state will be corrupted.

**How to avoid:** For KDA specifically: `POST /api/games/:id/throws { player_id: match.id, throw_index: matchCount, value: winner.id }`.

**Warning signs:** KDA bracket does not update after setting a match winner.

### Pitfall 7: Fuchsjagd throw_index is total throws (not per-player)

**What goes wrong:** Unlike dreiVollen where each player has their own wuerfe array, fuchsjagd throws are interspersed between fuchs and jaeger. A per-player throw_index from `player.w.length` is not sufficient to prevent duplicates.

**How to avoid:** Use total throw count across all participants:
```javascript
const throwIndex = state.fuchs.w.length + state.jaeger.reduce((s,j) => s + j.w.length, 0);
```

**Warning signs:** 409 on second fuchsjagd throw.

### Pitfall 8: Winner banner must fire only once per game finish

**What goes wrong:** If `game:finished` is received via both the HTTP response AND the socket event (which it will be, since the input device is in the game room), the winner banner fires twice.

**How to avoid:** Use a flag: `S.aktSpiel._finishing = true` before the HTTP call that finishes the game. In the `game:finished` socket handler, check this flag and skip if already finishing.

**Warning signs:** Winner banner appears twice in rapid succession.

---

## Code Examples

### PIN overlay (D-05)

```javascript
function showPINOverlay() {
  // Inject overlay into DOM (or have it pre-built in HTML hidden)
  var overlay = document.createElement('div');
  overlay.id = 'pin-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = '<div style="background:var(--card);border:1px solid var(--brd);border-radius:16px;padding:24px;width:280px;text-align:center">' +
    '<div style="font-family:var(--fh);font-size:28px;color:var(--ac);margin-bottom:16px">Anmelden</div>' +
    '<input id="pin-input" type="password" placeholder="PIN eingeben" style="text-align:center;font-size:20px;letter-spacing:.2em;margin-bottom:14px">' +
    '<button class="btn bp" style="width:100%" onclick="submitPIN()">Anmelden</button>' +
    '<div id="pin-err" style="color:var(--red);font-size:12px;margin-top:8px;display:none">Falscher PIN</div>' +
    '</div>';
  document.body.appendChild(overlay);
  document.getElementById('pin-input').focus();
}

async function submitPIN() {
  var pin = document.getElementById('pin-input').value;
  var res = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: pin })
  });
  if (res.ok) {
    document.getElementById('pin-overlay').remove();
    await init();
  } else {
    document.getElementById('pin-err').style.display = 'block';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
  }
}
```

### Connection dot in topbar (D-07)

The topbar has `<span id="tsub" ...>Bereit</span>`. Add the dot alongside it:

```html
<!-- In the topbar, alongside #tsub -->
<div style="display:flex;align-items:center;gap:8px">
  <span id="tsub" style="font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.1em">Bereit</span>
  <div class="conn-dot" id="connDot"></div>
</div>
```

The `.conn-dot` CSS class is already defined in `tv.html` — copy it to `index.html`. The JS pattern is verbatim from `tv.js`:
```javascript
socket.on('connect',    function() { document.getElementById('connDot').className = 'conn-dot green'; });
socket.on('disconnect', function() { document.getElementById('connDot').className = 'conn-dot red'; });
```

### Winner banner (D-12)

```javascript
function showWinnerBanner(state) {
  var winnerName = getWinnerName(state, S.aktSpiel.type_key);
  var banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;';
  banner.innerHTML = '<div style="background:var(--card);border:2px solid var(--ac);border-radius:16px;padding:32px;text-align:center">' +
    '<div style="font-size:48px;margin-bottom:8px">🏆</div>' +
    '<div style="font-family:var(--fh);font-size:32px;color:var(--ac)">' + winnerName + ' hat gewonnen!</div>' +
    '</div>';
  document.body.appendChild(banner);
  S.aktSpiel = null;
  setTimeout(function() {
    banner.remove();
    showTab('spiele');
    renderAll();
  }, 2500);
}
```

---

## Open Questions

1. **TV idle after game:finished — show winner name or null?**
   - What we know: Current fix passes `null` to `renderIdle`, showing "Noch kein Spiel gespielt" for 3 seconds until next reconnect pushes correct state.
   - What's unclear: Whether the user wants the winner's name displayed immediately during the 3-second window.
   - Recommendation: Use null for simplicity. The server pushes correct lastWinner on next connect. The TV will self-correct within seconds.

2. **Bilderkegel applyThrow field names**
   - What we know: bilderkegel.js exists and is tested; it handles 5-bild structure.
   - What's unclear: Exact server state field names for `aktBildIdx`, `aktWurfNr` — these must match the HTML render exactly.
   - Recommendation: Read bilderkegel.js in full before implementing `renderBKSpiel`.

3. **KDA throw_index for match recording**
   - What we know: `applyThrow(state, matchId, winnerId)` uses match ID as player_id.
   - What's unclear: What `throw_index` to send for each match — match.id or sequential counter.
   - Recommendation: Use `state.matches.filter(m => m.done).length` as the throw_index for idempotency.

4. **Player management (addSpieler) — is this in Phase 3 scope?**
   - What we know: `addSpieler()` is in the Spieler tab. The backend API (`POST /api/players`) already exists. Phase 3 context marks it as "stretch goal."
   - What's unclear: Whether the planner should include it in the plan or explicitly mark it as out-of-scope.
   - Recommendation: Include it as a late-wave optional task; it's a 20-line change once the pattern is established.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.15.0 | — |
| npm | Package management | Yes | 11.12.1 | — |
| Socket.io server | Real-time sync | Yes (installed) | 4.8.3 | — |
| Socket.io client | index.html WS | Yes (auto-served at /socket.io/socket.io.js) | 4.8.3 | — |
| `fetch` (browser) | API calls | Yes (all modern browsers) | native | — |
| Express static serving | Serving index.html | Yes (app.js already serves public/) | — | — |

All dependencies available. No blocking issues.

---

## Validation Architecture

Framework: Node.js built-in `node:test` (already in use across all test files).
Config: No config file — test runner invoked via `node --test`.
Quick run: `node --test server/routes/games.test.js`
Full suite: `node --test`

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-02 | GET /api/games?status=active returns active games | unit | `node --test server/routes/games.test.js` | Yes (games.test.js) — new tests needed |
| PLAY-02 | GET /api/games?status=finished returns finished games | unit | `node --test server/routes/games.test.js` | Yes (games.test.js) — new tests needed |
| PLAY-02 | POST /api/games with viergewinnt roles creates state.tX/tO correctly | unit | `node --test server/routes/games.test.js` | New test needed after vier-gewinnt.js fix |
| PLAY-02 | Active game mid-throw recovered from server state | integration | manual verification | Manual only |
| PLAY-02 | All 9 game types complete end-to-end | integration | manual / human verification | Manual only |
| AUTH-01 (Phase 1) | GET /api/auth/status returns authenticated:true after login | unit | `node --test server/routes/auth.test.js` | Yes (auth.test.js) |
| D-09 | GET /api/games with no status returns all games | unit | `node --test server/routes/games.test.js` | New test needed |

### Sampling Rate

- Per task commit: `node --test server/routes/games.test.js`
- Per wave merge: `node --test` (full suite — must stay 166+ passing)
- Phase gate: Full suite green + human verification of all 9 game types

### Wave 0 Gaps

New test stubs needed in `server/routes/games.test.js`:
- `GET /api/games` returns all games sorted by id DESC
- `GET /api/games?status=active` returns only active games
- `GET /api/games?status=finished` returns only finished games
- `GET /api/games/:id` after viergewinnt fix: `state.tX` and `state.tO` are non-empty

No new test framework installation needed — `node:test` is already in use.

---

## Security Domain

`security_enforcement` is not set to false in config.json — security section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | PIN overlay + POST /api/auth/login (existing bcryptjs) |
| V3 Session Management | Yes | express-session + httpOnly + sameSite:strict (existing) |
| V4 Access Control | Yes | requireSession already applied to all write routes |
| V5 Input Validation | Yes | Server validates player_id, throw_index, value as integers |
| V6 Cryptography | No | No new crypto in Phase 3 |

### Known Threat Patterns for Vanilla JS + REST

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via innerHTML in index.html | Spoofing / Tampering | index.html uses innerHTML for rendering (controlled input — no XSS risk since data comes from own API, not external input). textContent-only rule applies to TV only. |
| CSRF on write routes | Tampering | sameSite:strict cookie prevents cross-origin POST. No additional token needed for single-origin PWA. |
| Session fixation | Elevation of Privilege | auth.js `req.session.regenerate()` already prevents this. |
| Unauthenticated game state read | Information Disclosure | GET /api/games (new) is read-only; game state is not sensitive data in this club app. Consistent with existing unauthenticated GET /api/games/:id. |

---

## Sources

### Primary (HIGH confidence)
- `Claude/kegelclub_12.html` — Read in full; all game-type flows, function names, and state shapes verified [VERIFIED: direct file read]
- `Claude/server/routes/games.js` — All endpoints, reconstructState, activeGames Map [VERIFIED: direct file read]
- `Claude/server/routes/auth.js` — GET /api/auth/status, POST /api/auth/login [VERIFIED: direct file read]
- `Claude/server/routes/players.js` — GET /api/players response shape [VERIFIED: direct file read]
- `Claude/public/tv.js` — Connection dot pattern, Socket.io event handlers to reuse [VERIFIED: direct file read]
- `Claude/server/game-types/index.js` — All 9 type_key mappings [VERIFIED: direct file read]
- `Claude/server/game-types/fuchsjagd.js` — State shape, applyThrow signature [VERIFIED: direct file read]
- `Claude/server/game-types/vier-gewinnt.js` — p.team bug confirmed [VERIFIED: direct file read]
- `Claude/server/game-types/grosse-hausnummer.js` — meta.slot pattern [VERIFIED: direct file read]
- `Claude/server/game-types/kegler-des-abends.js` — seed config, match-based applyThrow [VERIFIED: direct file read]
- `Claude/server/routes/socket.test.js` — join handler existence, event shapes [VERIFIED: direct file read]
- `Claude/.planning/phases/03-frontend-wiring/03-CONTEXT.md` — All D-01 to D-12 decisions [VERIFIED: direct file read]

### Secondary (MEDIUM confidence)
- `Claude/.planning/phases/02-real-time-tv/02-04-SUMMARY.md` — TV display patterns, deferred items, getScore stub [VERIFIED: direct file read]

### Tertiary (LOW confidence — unread files, inferred from patterns)
- `Claude/server/game-types/bilderkegel.js` — State field names inferred from HTML; must be verified before implementing renderBKSpiel [ASSUMED]
- KDA throw_index recommendation (use done.length) — logical inference, not verified against KDA test suite [ASSUMED]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TV idle fix using `renderIdle(null)` is acceptable (winner name shown on next reconnect) | TV Idle Transition | Winner name briefly absent; low visual impact |
| A2 | KDA `throw_index` should use `state.matches.filter(m=>m.done).length` | Group D wiring | 409 duplicate on second match; easily fixed |
| A3 | Bilderkegel server state fields match HTML field names (`aktBildIdx`, `aktWurfNr`, nested `wuerfe[][]`) | Pitfall 5 | Render function shows wrong bild or player |
| A4 | KDA seed passed via `config: { seed: Date.now() }` works with kegler-des-abends.js | Group D wiring | Non-deterministic initial bracket; cosmetic only |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified in package.json
- Architecture: HIGH — all source files read directly; no gaps in understanding
- Game-type wiring analysis: HIGH for 7/9 types (direct code read); MEDIUM for bilderkegel (state shape inferred)
- Pitfalls: HIGH — identified from direct code comparison between HTML and server modules
- Viergewinnt bug: HIGH — confirmed by reading both vier-gewinnt.js and games.js

**Research date:** 2026-05-20
**Valid until:** Stable until game-type modules are modified (unlikely in Phase 3)
