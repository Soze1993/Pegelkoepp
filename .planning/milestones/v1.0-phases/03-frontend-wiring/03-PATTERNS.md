# Phase 3: Frontend Wiring - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `Claude/public/index.html` | component (SPA entry) | request-response + event-driven | `Claude/kegelclub_12.html` (source) + `Claude/public/tv.js` (socket pattern) | exact — copy + wire |
| `Claude/public/tv.js` | client utility | event-driven | `Claude/public/tv.js` itself (one-line addition) | exact |
| `Claude/server/routes/games.js` | route | CRUD | `Claude/server/routes/players.js` (GET / pattern) | exact — same router file, add before `/:id` |
| `Claude/server/game-types/vier-gewinnt.js` | game module | transform | `Claude/server/game-types/fuchsjagd.js` (uses `p.role` correctly) | role-match — fixes `p.team` → `p.role` |

---

## Pattern Assignments

---

### `Claude/public/index.html` (SPA component, request-response + event-driven)

**Source to copy from:** `Claude/kegelclub_12.html` (entire file — HTML structure, CSS, render helpers stay verbatim)
**Socket pattern analog:** `Claude/public/tv.js` (connection dot + socket event handlers)
**Auth pattern analog:** `Claude/server/routes/auth.js` (shows what the API returns)

**What to keep unchanged from kegelclub_12.html:**
- All CSS (lines 8–106): CSS variables (`--bg`, `--ac`, `--fh`, `--fb`, etc.), every class definition
- All HTML structure (lines 108–235): topbar, tabs, page sections, modal markup
- All render functions: `renderSpiele`, `renderSpielerListe`, `renderSpielenTab`, `renderBib`, `renderStats`, `renderNSpiel`, `renderVGSpiel`, `renderFJSpiel`, `renderAnkerSpiel`, `renderKDASpiel`, `renderBKSpiel`
- UI helpers: `notify`, `showTab`, `openM`, `closeM`, `today`, `EMOJIS`
- `S.typen` array (static built-in game type list — unchanged)

---

#### 1. S object initialization (lines 242–257 of kegelclub_12.html — REPLACE)

**Old (in-memory, remove these fields):**
```javascript
// kegelclub_12.html lines 242-257
var S={
  spieler:[mkSp(1,'Anna','🌟'),mkSp(2,'Ben','🔥'),mkSp(3,'Clara','🎯')],
  typen:[...],
  spiele:[],vgSpiele:[],fjSpiele:[],ankerSpiele:[],kdaSpiele:[],bkSpiele:[],
  aktSpiel:null,aktVG:null,aktFJ:null,aktAnker:null,aktKDA:null,aktBK:null,nid:20
};
```

**New (server-backed — fields to keep/add/remove):**
```javascript
var S = {
  spieler: [],                // populated via GET /api/players on init
  typen: [...],               // KEEP — static list unchanged
  aktSpiel: null              // now { gameId, state, type_key } or null
  // REMOVED: spiele, vgSpiele, fjSpiele, ankerSpiele, kdaSpiele, bkSpiele
  // REMOVED: aktVG, aktFJ, aktAnker, aktKDA, aktBK, nid
};
```

---

#### 2. DOMContentLoaded + init sequence (line 264 of kegelclub_12.html — REPLACE)

**Old (line 264):**
```javascript
// kegelclub_12.html line 264
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.mo').forEach(function(m){
    m.addEventListener('click',function(e){if(e.target===m)m.classList.remove('open');});
  });
});
```

**New pattern (copy structure from tv.js lines 9–23 for socket setup; auth gate from auth.js response shape):**
```javascript
document.addEventListener('DOMContentLoaded', async function() {
  // Keep modal backdrop close — unchanged from original
  document.querySelectorAll('.mo').forEach(function(m) {
    m.addEventListener('click', function(e) { if (e.target === m) m.classList.remove('open'); });
  });

  // D-05: Auth gate before any data load
  var authRes = await fetch('/api/auth/status');
  var authData = await authRes.json();
  if (!authData.authenticated) {
    showPINOverlay();  // overlay calls init() on success
    return;
  }
  await init();
});

async function init() {
  // D-02: Load players
  S.spieler = await fetch('/api/players').then(function(r) { return r.json(); });

  // D-08: Recover active game
  var games = await fetch('/api/games?status=active').then(function(r) { return r.json(); });
  if (games.length) {
    var g = games[0];
    var detail = await fetch('/api/games/' + g.id).then(function(r) { return r.json(); });
    S.aktSpiel = { gameId: g.id, state: detail.state, type_key: g.type_key };
    showTab('spielen');
  }

  initSocket();  // D-07, D-10, D-11, D-12
  renderAll();
}
```

**Auth API response shape** (from `Claude/server/routes/auth.js` lines 32–34):
```javascript
// GET /api/auth/status returns:
{ authenticated: true | false }

// POST /api/auth/login returns:
{ ok: true }  // on success (200)
// or { error: 'Falscher PIN' } on failure (401)
```

---

#### 3. PIN overlay (new function — no analog in codebase, use RESEARCH.md pattern)

```javascript
// Pattern from 03-RESEARCH.md "Code Examples" section
function showPINOverlay() {
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

---

#### 4. Connection dot in topbar (D-07 — copy from tv.js lines 3–13)

**HTML addition to topbar** (replace `<span id="tsub">` at kegelclub_12.html line 115):
```html
<!-- kegelclub_12.html line 115 — replace: -->
<span id="tsub" style="font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.1em">Bereit</span>

<!-- With: -->
<div style="display:flex;align-items:center;gap:8px">
  <span id="tsub" style="font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.1em">Bereit</span>
  <div class="conn-dot" id="connDot"></div>
</div>
```

**CSS to add** (copy verbatim from tv.html lines 112–123):
```css
.conn-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #888;
  flex-shrink: 0;
}
.conn-dot.green { background: #4caf7d; }
.conn-dot.red   { background: #e05252; }
```

**JS socket connection pattern** (copy verbatim from tv.js lines 12–13):
```javascript
// tv.js lines 12-13 — copy exactly
socket.on('connect',    function() { document.getElementById('connDot').className = 'conn-dot green'; });
socket.on('disconnect', function() { document.getElementById('connDot').className = 'conn-dot red'; });
```

---

#### 5. Socket.io initialization and event handlers (D-10, D-11, D-12)

**Analog:** `Claude/public/tv.js` lines 9–23 for the `io()` call and event handler structure.

```javascript
// Socket.io connect — same-origin, same pattern as tv.js line 9
var socket;

function initSocket() {
  socket = io();  // same-origin; auto-served at /socket.io/socket.io.js — tv.js line 9

  // Connection dot — tv.js lines 12-13
  socket.on('connect',    function() { document.getElementById('connDot').className = 'conn-dot green';
    if (S.aktSpiel) socket.emit('join', S.aktSpiel.gameId);  // D-10: rejoin on reconnect
  });
  socket.on('disconnect', function() { document.getElementById('connDot').className = 'conn-dot red'; });

  // D-10: real-time state sync
  socket.on('throw:applied', function(data) {
    if (S.aktSpiel) S.aktSpiel.state = data.state;
    renderSpielenTab();
  });
  socket.on('undo:applied', function(data) {
    if (S.aktSpiel) S.aktSpiel.state = data.state;
    renderSpielenTab();
  });

  // D-11: game started from another device
  socket.on('game:started', function(data) {
    S.aktSpiel = { gameId: data.gameId, state: data.state, type_key: data.type_key };
    socket.emit('join', data.gameId);
    showTab('spielen');
  });

  // D-12: game finished
  socket.on('game:finished', function(data) {
    if (S.aktSpiel && S.aktSpiel._finishing) return;  // Pitfall 8: deduplicate
    showWinnerBanner(data.state);
  });
}
```

---

#### 6. Fetch-then-update pattern for write operations

**Analog for fetch pattern:** `Claude/server/routes/games.js` lines 150–158 shows what the server returns. **Pattern for the fetch call itself:** described in RESEARCH.md Pattern 1.

**Template for all `doXxxWurf` replacements:**
```javascript
// Replace every function that mutates S directly (startVG, doNWurf, doVGWurf, etc.)
// Pattern: validate locally → fetch → on success update S → re-render
async function doNWurf() {
  var player = S.aktSpiel.state.players[S.aktSpiel.state.aktSpIdx];
  var throwIndex = player.wuerfe ? player.wuerfe.length : 0;  // Pitfall 2: always fresh
  var res = await fetch('/api/games/' + S.aktSpiel.gameId + '/throws', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ player_id: player.id, throw_index: throwIndex, value: selK })
  });
  if (!res.ok) { notify('Fehler beim Wurf', 'var(--red)'); return; }
  var data = await res.json();
  S.aktSpiel.state = data.state;  // D-02: only update S after server confirms
  selK = null;
  if (data.finished) {
    S.aktSpiel._finishing = true;  // Pitfall 8 flag
    showWinnerBanner(data.state);
  } else {
    renderSpielenTab();
  }
}
```

**Server response shape** (from `Claude/server/routes/games.js` lines 156–158):
```javascript
// POST /api/games/:id/throws response:
{ state: { ...gameState }, finished: true | false }
// POST /api/games/:id/undo response:
{ state: { ...gameState }, finished: false }
// POST /api/games response (game start):
{ id: gameId, type_key: 'dreiVollen', status: 'active' }
// GET /api/games/:id response:
{ game: {...}, state: {...}, finished: bool, results: null | [...] }
```

---

#### 7. renderSpielenTab replacement (Pitfall 4)

**Old dispatch** (kegelclub_12.html line 300 — 6-way S.aktXxx check — REMOVE):
```javascript
// Old: checked S.aktBK, S.aktKDA, S.aktAnker, S.aktFJ, S.aktVG, S.aktSpiel separately
function renderSpielenTab() { ... }  // entire old body removed
```

**New dispatch** (type_key switch — from RESEARCH.md Pattern 4):
```javascript
function renderSpielenTab() {
  var el = document.getElementById('r-spielen');
  if (!S.aktSpiel) { /* show empty state */ return; }
  switch (S.aktSpiel.type_key) {
    case 'viergewinnt':  renderVGSpiel(el, S.aktSpiel.state);    break;
    case 'fuchsjagd':    renderFJSpiel(el, S.aktSpiel.state);    break;
    case 'anker':        renderAnkerSpiel(el, S.aktSpiel.state); break;
    case 'kda':          renderKDASpiel(el, S.aktSpiel.state);   break;
    case 'bilderkegel':  renderBKSpiel(el, S.aktSpiel.state);    break;
    default:             renderNSpiel(el, S.aktSpiel.state);     break;
  }
}
```

---

#### 8. renderSpiele replacement (D-04 — Spiele tab from API)

**Old** (kegelclub_12.html line 297 — reads S.spiele, S.vgSpiele, etc. — REMOVE body):
```javascript
// Old: reads in-memory arrays S.spiele, S.vgSpiele, etc.
function renderSpiele() { ... }
```

**New** (async, reads from GET /api/games?status=finished):
```javascript
async function renderSpiele() {
  var el = document.getElementById('r-spiele');
  var games = await fetch('/api/games?status=finished').then(function(r) { return r.json(); });
  if (!games.length) {
    el.innerHTML = '<div class="empty"><div class="icon">🎳</div><p>Noch keine Spiele.</p></div>';
    return;
  }
  el.innerHTML = games.map(function(g) {
    return '<div class="stc">' +
      '<div style="font-family:var(--fh);font-size:18px">' + g.type_key + '</div>' +
      '<div style="font-size:12px;color:var(--mut)">' + (g.finished_at || g.started_at) + '</div>' +
      '</div>';
  }).join('');
}
```

---

#### 9. Winner banner (D-12 — no analog, new function)

```javascript
// Pattern from 03-RESEARCH.md "Code Examples"
function showWinnerBanner(state) {
  var banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;';
  banner.innerHTML = '<div style="background:var(--card);border:2px solid var(--ac);border-radius:16px;padding:32px;text-align:center">' +
    '<div style="font-size:48px;margin-bottom:8px">&#127942;</div>' +
    '<div style="font-family:var(--fh);font-size:32px;color:var(--ac)">Spiel beendet!</div>' +
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

#### 10. Script tags to add at bottom of index.html

**Analog:** `Claude/public/tv.html` lines 137–138:
```html
<!-- tv.html lines 137-138 — same pattern for index.html -->
<script src="/socket.io/socket.io.js"></script>
<script src="/tv.js"></script>

<!-- For index.html, the script is inline (same as kegelclub_12.html); add before closing body: -->
<script src="/socket.io/socket.io.js"></script>
<!-- then the inline <script> block follows, same as kegelclub_12.html structure -->
```

---

### `Claude/public/tv.js` (client utility, event-driven — one-line change)

**Analog:** `Claude/public/tv.js` itself (current file, lines 23–24)

**Current code** (tv.js line 23 — the line to modify):
```javascript
// tv.js line 23 — CURRENT (stub from Phase 2)
socket.on('game:finished', ({ state }) => renderGame(state));
```

**Fix — add setTimeout for idle transition** (one line addition):
```javascript
// tv.js line 23 — REPLACE WITH:
socket.on('game:finished', function({ state }) {
  renderGame(state);
  setTimeout(function() { renderIdle(null); }, 3000);
});
```

**renderIdle function signature** (tv.js lines 25–32 — verifies `null` is a valid argument):
```javascript
// tv.js lines 25-32 — renderIdle accepts null
function renderIdle(lastWinner) {
  gameEl.classList.remove('active');
  idleEl.style.display = 'flex';
  lastWinnerEl.textContent = lastWinner
    ? 'Letzter Sieger: ' + lastWinner
    : 'Noch kein Spiel gespielt';  // null → shows this fallback
}
```

---

### `Claude/server/routes/games.js` (route, CRUD — add GET / before GET /:id)

**Analog:** `Claude/server/routes/players.js` lines 8–13 (unauthenticated GET / route pattern)

**Players GET / pattern to copy** (players.js lines 8–13):
```javascript
// players.js lines 8-13 — copy this unauthenticated GET / pattern
router.get('/', (req, res) => {
  const players = db.prepare(
    'SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id ASC'
  ).all();
  res.json(players);
});
```

**New route for games.js** (must be inserted BEFORE `router.get('/:id', ...)` at line 75 — Express ordering):
```javascript
// INSERT at games.js line 74 (before the existing GET /:id route)
// ---------------------------------------------------------------------------
// GET /api/games — list games, optional ?status=active|finished filter (D-09)
// No auth — consistent with GET /api/games/:id (unauthenticated, line 75)
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const { status } = req.query;
  const games = status
    ? db.prepare(
        'SELECT id, type_key, status, started_at, finished_at FROM games WHERE status = ? ORDER BY id DESC'
      ).all(status)
    : db.prepare(
        'SELECT id, type_key, status, started_at, finished_at FROM games ORDER BY id DESC'
      ).all();
  res.json(games);
});
```

**Existing route ordering context** (games.js lines 15–17 and 75 — ordering reference):
```javascript
// games.js line 17: POST / (first route)
router.post('/', requireSession, (req, res) => { ... });

// games.js line 75: GET /:id (currently second route — new GET / must go BEFORE this)
router.get('/:id', (req, res) => { ... });
```

---

### `Claude/server/game-types/vier-gewinnt.js` (game module, transform — one-line fix)

**Analog (correct pattern):** `Claude/server/game-types/fuchsjagd.js` lines 8–9 (uses `p.role` correctly)

**Correct role access pattern** (fuchsjagd.js lines 8–9):
```javascript
// fuchsjagd.js lines 8-9 — uses p.role (correct)
const fuchsPlayer = players.find(p => p.role === 'fuchs');
const jaegerPlayers = players.filter(p => p.role === 'jaeger');
```

**How games.js passes role** (games.js lines 58–62 — source of truth):
```javascript
// games.js lines 58-62: players passed to initState have .role (not .team)
const playersWithRole = players.map(p => ({
  ...p,
  role: (roles && roles[String(p.id)]) || null
}));
const state = gameModule.initState(playersWithRole, config);
```

**Broken code** (vier-gewinnt.js lines 31–32 — current, uses `p.team`):
```javascript
// vier-gewinnt.js lines 31-32 — BROKEN: reads p.team, but games.js passes p.role
tX: players.filter(p => p.team === 'X').map(p => ({ id: p.id, name: p.name, emoji: p.emoji, team: 'X' })),
tO: players.filter(p => p.team === 'O').map(p => ({ id: p.id, name: p.name, emoji: p.emoji, team: 'O' })),
```

**Fixed code** (change `p.team` to `p.role` in filter — two occurrences on lines 31–32):
```javascript
// vier-gewinnt.js lines 31-32 — FIXED: read p.role to match games.js
tX: players.filter(p => p.role === 'X').map(p => ({ id: p.id, name: p.name, emoji: p.emoji, team: 'X' })),
tO: players.filter(p => p.role === 'O').map(p => ({ id: p.id, name: p.name, emoji: p.emoji, team: 'O' })),
```

Note: The `.map()` output still uses `team: 'X'` / `team: 'O'` — this is intentional since the rest of `applyThrow` (lines 42–76) reads `s.aktT` (a string 'X'/'O') and `p.team` within the already-constructed `tX`/`tO` arrays. Only the `filter` discriminant needs to change.

---

## Shared Patterns

### Fetch + JSON response pattern (applies to all write operations in index.html)

**Source:** `Claude/server/routes/games.js` lines 104–158 (shows server contract)
**Apply to:** All `doXxxWurf`, `startXxx`, undo handlers in index.html

```javascript
// Standard fetch template — same-origin, session cookie auto-sent
var res = await fetch('/api/games/' + gameId + '/throws', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ player_id: pid, throw_index: idx, value: val })
});
if (!res.ok) { notify('Fehler', 'var(--red)'); return; }
var data = await res.json();
```

### `if (io)` emit guard (applies to any new server-side socket emit)

**Source:** `Claude/server/routes/games.js` lines 150–155
**Apply to:** Any future io.emit calls in routes

```javascript
// games.js lines 150-155 — guard pattern
const io = req.app.locals.io;
if (io) {
  io.to(`game:${gameId}`).emit('throw:applied', { state: newState, finished });
  if (finished) io.to(`game:${gameId}`).emit('game:finished', { state: newState });
}
```

### requireSession guard (applies to all write routes)

**Source:** `Claude/server/routes/games.js` line 17, `Claude/server/routes/players.js` line 17
**Apply to:** Any new write route added in Phase 3 (GET /api/games is unauthenticated — read-only)

```javascript
// Pattern: unauthenticated for reads, requireSession for writes
const requireSession = require('../middleware/auth');
router.post('/', requireSession, (req, res) => { ... });  // requires session
router.get('/', (req, res) => { ... });                   // no session — read-only
```

### Dark Gold CSS theme (applies to all new DOM injected by index.html)

**Source:** `Claude/kegelclub_12.html` lines 10–15 (CSS variables)
**Apply to:** PIN overlay, winner banner, connection dot — all injected DOM

```css
/* Always use these CSS variables for any injected HTML — never hardcode colors */
--bg:#0f0f14; --card:#22222e; --ac:#e8b84b; --ac2:#f5d37a;
--red:#e05252; --grn:#4caf7d; --txt:#f0ede6; --mut:#8884a0; --brd:#2e2e3e;
--fh:'Bebas Neue',sans-serif; --fb:'DM Sans',sans-serif;
```

### Notify pattern (applies to error feedback in all write operations)

**Source:** `Claude/kegelclub_12.html` line 260 (keep unchanged)

```javascript
// kegelclub_12.html line 260 — reuse as-is
function notify(msg, col) {
  var n = document.getElementById('notif');
  n.textContent = msg;
  n.style.background = col || 'var(--grn)';
  n.classList.add('show');
  setTimeout(function() { n.classList.remove('show'); }, 2400);
}
// Error call: notify('Fehler beim Wurf', 'var(--red)')
// Success call: notify('Spiel gestartet!')
```

---

## No Analog Found

None. All 4 files have direct analogs in the codebase. New functions within index.html (PIN overlay, winner banner, `initSocket`) have no direct codebase analog but are covered by RESEARCH.md code examples, which are themselves derived from the existing tv.js and auth.js patterns.

---

## Key Pitfalls (for planner to include in task checklists)

| Pitfall | File | Guard |
|---------|------|-------|
| GET `/` must be before GET `/:id` in games.js | games.js | Insert at line 74, before line 75 |
| `p.team` → `p.role` in vier-gewinnt.js | vier-gewinnt.js | Lines 31–32 only; map output keeps `team: 'X'` |
| `throw_index` must be derived from `S.aktSpiel.state` at submit time, not cached | index.html | `player.wuerfe ? player.wuerfe.length : 0` |
| `game:finished` fires via both HTTP response and socket — deduplicate with `_finishing` flag | index.html | Set `S.aktSpiel._finishing = true` before API call |
| `renderAll()` in socket handlers is expensive — call `renderSpielenTab()` only | index.html | Socket handlers: `renderSpielenTab()`, not `renderAll()` |
| Old 6-way `S.aktVG`/`S.aktFJ`/etc. dispatch in `renderSpielenTab` must be fully replaced | index.html | Replace entire function body with `type_key` switch |

---

## Metadata

**Analog search scope:** `Claude/public/`, `Claude/server/routes/`, `Claude/server/game-types/`, `Claude/kegelclub_12.html`
**Files scanned:** 8 (tv.js, tv.html, games.js, players.js, auth.js, fuchsjagd.js, vier-gewinnt.js, kegelclub_12.html)
**Pattern extraction date:** 2026-05-21
