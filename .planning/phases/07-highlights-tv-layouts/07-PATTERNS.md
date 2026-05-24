# Phase 7: Highlights & TV-Layouts — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 6
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `Claude/server/routes/highlights.js` | route/service | request-response (read-only REST) | `Claude/server/routes/stats.js` | exact |
| `Claude/server/app.js` | config | — | `Claude/server/app.js` (self, line 66-67) | exact (single line change) |
| `Claude/server/routes/games.js` | route/service | event-driven (Socket.io) | `Claude/server/routes/games.js` (self, line 195) | exact (single line change) |
| `Claude/public/tv.js` | frontend/renderer | event-driven + request-response | `Claude/public/tv.js` (self) | exact |
| `Claude/public/index.html` | frontend/component | request-response + event-driven | `Claude/public/index.html` (self) | exact |
| `Claude/server/routes/highlights.test.js` | test | — | `Claude/server/routes/stats.test.js` | exact |

---

## Pattern Assignments

### `Claude/server/routes/highlights.js` (route, request-response)

**Analog:** `Claude/server/routes/stats.js`

**Imports pattern** (stats.js lines 1-8):
```js
'use strict';

const { Router } = require('express');
const db = require('../db');
const gameTypes = require('../game-types');
const { reconstructState } = require('./games');

const router = Router();
```

**No auth guard** — highlights endpoint is read-only/public, same as stats. Compare stats.js line 15 `router.get('/', (req, res) => {` with no `requireSession` arg. Do NOT add `requireSession`.

**Core query pattern** (stats.js lines 36-53):
```js
// Pattern: query finished games by type_key, call reconstructState, derive data
const finishedGames = db.prepare(
  "SELECT id, type_key FROM games WHERE status = 'finished'"
).all();

for (const game of finishedGames) {
  const gameModule = gameTypes[game.type_key];
  if (!gameModule) continue;  // skip unknown type_key — ST20 pattern

  let state;
  try {
    state = reconstructState(game);
    results = gameModule.getFinalResults(state);
  } catch (e) {
    continue;  // skip games that fail to reconstruct — non-fatal
  }
  // ... use state fields
}
```

**For highlights.js** — same structure but use LIMIT 1 + ORDER BY finished_at DESC per type:
```js
// Query last finished KDA game
const kdaGame = db.prepare(
  "SELECT id, type_key FROM games WHERE type_key = 'kda' AND status = 'finished' ORDER BY finished_at DESC LIMIT 1"
).get();
// kdaGame may be null (no finished KDA games yet) — always null-check

// Query last finished Bilderkegeln game
const bkGame = db.prepare(
  "SELECT id, type_key FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' ORDER BY finished_at DESC LIMIT 1"
).get();
```

**KDA winner extraction** — from `kegler-des-abends.js` verified: `state.gewinner = { id, name, emoji }` after tournament completes (lines 383, 441). Access as `state.gewinner.id`.

**BK loser extraction** — BK state has NO `gewinner` field (bilderkegel.js confirmed). Derive from `state.players` using `bkTotal`:
```js
// bkTotal: same logic as index.html line 815
function getBKLoserId(state) {
  if (!state || !state.players) return null;
  var tots = state.players.map(function(p) {
    return { id: p.id, total: (p.bildPts || []).reduce(function(a, b) { return a + (b !== null ? b : 0); }, 0) };
  });
  tots.sort(function(a, b) { return a.total - b.total; });
  return tots[0] ? tots[0].id : null;
}
```

**Player lookup pattern** (stats.js uses db.prepare inline):
```js
const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(loserId);
if (p) result.bk_loser = p;
```

**Response pattern** (stats.js line 141):
```js
res.json(response);
// For highlights: res.json({ kda_champion: null|{ id, name, emoji }, bk_loser: null|{ id, name, emoji } })
```

**Error handling** — try/catch per game reconstruction, non-fatal skip (stats.js pattern). Outer route has no try/catch — Express error middleware at app.js line 71 catches thrown errors.

**Module export** (stats.js line 144):
```js
module.exports = router;
```

---

### `Claude/server/app.js` (config, route registration)

**Analog:** `Claude/server/app.js` lines 62-67 (self — single line addition)

**Registration pattern** (app.js lines 62-67):
```js
// API routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/players',    require('./routes/players'));
app.use('/api/games',      require('./routes/games'));
app.use('/api/abende',     require('./routes/abende'));
app.use('/api/stats',      require('./routes/stats'));
app.use('/api/game-types', require('./routes/game-types'));
// ADD after stats:
app.use('/api/highlights', require('./routes/highlights'));
```

No other changes needed. The new route is public (no auth wrapper), consistent with `/api/stats`.

---

### `Claude/server/routes/games.js` (route, Socket.io event enrichment)

**Analog:** `Claude/server/routes/games.js` lines 88-92 and 183-195 (self — two single-line changes)

**Existing `game:started` emission** (games.js line 90) — already includes `type_key`:
```js
if (io) io.emit('game:started', { gameId, state, type_key });
```
This is the model. The `game:finished` emission on line 195 is missing `type_key`.

**Current `game:finished` emission** (games.js line 195 — EXACT CODE):
```js
io.to(`game:${gameId}`).emit('game:finished', { state: newState, lastWinner });
```

**Required change** — add `typeKey: game.type_key`:
```js
io.to(`game:${gameId}`).emit('game:finished', { state: newState, lastWinner, typeKey: game.type_key });
```

`game.type_key` is in scope at line 195 — `game` was queried on line 133:
```js
const game = db.prepare("SELECT * FROM games WHERE id = ? AND status = 'active'").get(gameId);
```

**Also needed — `game:state` emission in `server.js`:** Research confirms `game:state` (emitted from server.js line 44) does not currently include `type_key`. The TV's `currentTypeKey` module-level variable is set from `game:started`, but `game:state` is sent when a TV connects to an already-running game. Add `type_key: game.type_key` to the `game:state` emission in server.js as well.

---

### `Claude/public/tv.js` (frontend renderer, event-driven)

**Analog:** `Claude/public/tv.js` (self — all patterns are internal)

**Module-level DOM refs pattern** (tv.js lines 3-7 — copy this structure):
```js
const connDot      = document.getElementById('connDot');
const idleEl       = document.getElementById('idle');
const gameEl       = document.getElementById('game');
const playerListEl = document.getElementById('playerList');
const lastWinnerEl = document.getElementById('lastWinnerText');
```
Add new module-level variable after these:
```js
var currentTypeKey = null;  // set on game:started and game:state — used by renderGame dispatcher
```

**Socket event handler pattern** (tv.js lines 16-26):
```js
socket.on('game:state',    ({ idle, state, gameId, lastWinner }) => {
  if (idle) renderIdle(lastWinner);
  else { socket.emit('join', gameId); renderGame(state); }
});
socket.on('game:started',  ({ state, gameId }) => { socket.emit('join', gameId); renderGame(state); });
socket.on('game:finished', function({ state, lastWinner }) {
  renderGame(state);
  setTimeout(function() { renderIdle(lastWinner || null); }, 3000);
});
```
Replace `game:started` and `game:finished` handlers; extend `game:state` handler to cache `type_key`:
```js
// Replace game:started to cache typeKey
socket.on('game:started', ({ state, gameId, type_key }) => {
  currentTypeKey = type_key;
  socket.emit('join', gameId);
  renderGame(state);
});
// Replace game:state to cache typeKey when available
socket.on('game:state', ({ idle, state, gameId, lastWinner, type_key }) => {
  if (type_key) currentTypeKey = type_key;
  if (idle) renderIdle(lastWinner);
  else { socket.emit('join', gameId); renderGame(state); }
});
// Replace game:finished with overlay dispatch
socket.on('game:finished', function({ state, lastWinner, typeKey }) {
  renderEndOverlay(typeKey, state, lastWinner);
});
```

**renderGame dispatcher pattern** (tv.js lines 37-39 — existing KDA branch):
```js
function renderGame(state) {
  if (state && state.bracket) { renderKDABracket(state); return; }  // KDA: before state.players guard
  if (!state || !state.players) return;
  // ... generic player list
}
```
Extend BEFORE the `!state.players` guard:
```js
function renderGame(state) {
  if (state && state.bracket) { renderKDABracket(state); return; }    // KDA (existing)
  if (currentTypeKey === 'bilderkegel') { renderBilderkegelTV(state); return; }  // NEW — must precede !players guard
  if (currentTypeKey === 'fuchsjagd')   { renderFuchsjagdTV(state); return; }    // NEW
  if (currentTypeKey === 'viergewinnt') { renderViergewinntTV(state); return; }  // NEW
  if (!state || !state.players) return;
  // ... existing generic player list (unchanged)
}
```
CRITICAL: BK has `state.players` and would fall through to the generic renderer if `currentTypeKey` check isn't before the `!state.players` guard.

**renderKDABracket full-screen takeover pattern** (tv.js lines 103-210) — ALL new TV renderers follow this exact pattern:
```js
function renderKDABracket(state) {
  idleEl.style.display = 'none';     // 1. hide idle
  gameEl.classList.add('active');     // 2. activate game area (needed for display:block CSS)

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);padding:20px 24px;box-sizing:border-box;...';

  // ... build DOM using textContent only — NO innerHTML with DB strings
  // ... var el = document.createElement(...)
  // ... el.textContent = someDbValue;  // always textContent, never innerHTML

  gameEl.replaceChildren(container);  // 3. replace ALL gameEl children
}
```
New renderers (`renderBilderkegelTV`, `renderFuchsjagdTV`, `renderViergewinntTV`, `renderEndOverlay`) must follow steps 1-2-3 exactly. Do NOT use `playerListEl.replaceChildren()` — that is the generic path only.

**textContent-only XSS guard** — from tv.js throughout (e.g., line 53, 235, 255):
```js
nameEl.textContent = (player.emoji != null ? player.emoji : '') + ' ' + player.name;  // textContent — safe
// NOT: nameEl.innerHTML = player.emoji + ' ' + player.name;  // PROHIBITED
```

**CSS variables** (used throughout tv.js — available in all new code):
- `var(--bg)` — page background (dark)
- `var(--card)` — card/slot background
- `var(--ac)` — amber accent (KDA winner color)
- `var(--red)` — red accent (BK loser color)
- `var(--grn)` — green (winner indication)
- `var(--txt)` — primary text
- `var(--mut)` — muted/secondary text
- `var(--brd)` — border color
- `var(--fh)` — heading font ("Bebas Neue")
- `var(--fb)` — body font ("DM Sans")

**buildTVSlotEl scoring pattern** (tv.js lines 266-288) — reference for score display with color logic:
```js
if (!slot.done) {
  scoreSpan.textContent = String(sum) + ' ⚫';
  scoreSpan.style.color = 'var(--ac)';
} else if (slot.winner && slot.winner.id === p.id) {
  scoreSpan.textContent = String(sum);
  scoreSpan.style.color = 'var(--grn)';
} else {
  scoreSpan.textContent = String(sum);
  scoreSpan.style.color = 'var(--red)';
  scoreSpan.style.opacity = '0.6';
}
```

**renderIdle call pattern** (tv.js lines 28-35 — called after overlays):
```js
function renderIdle(lastWinner) {
  gameEl.classList.remove('active');
  idleEl.style.display = 'flex';
  lastWinnerEl.textContent = lastWinner
    ? 'Letzter Sieger: ' + lastWinner
    : 'Noch kein Spiel gespielt';
}
```
Always call as `renderIdle(lastWinner || null)`.

---

### `Claude/public/index.html` (frontend, event-driven + request-response)

**Analog:** `Claude/public/index.html` (self — all patterns are internal)

**Module-level state pattern** (index.html — `S` object):
The app uses a single `S` state object. Add new fields to it:
```js
// Locate the S = { ... } declaration (near top of script) and add:
// S.kdaChampionId = null;   // player.id of current KDA champion
// S.bkLoserId     = null;   // player.id of current BK loser
```

**fetch-on-load pattern** (index.html lines 456-466, startAbend async function — same async/fetch structure):
```js
// On page init (in the existing DOMContentLoaded or init() block):
fetch('/api/highlights/current')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    S.kdaChampionId = data.kda_champion ? data.kda_champion.id : null;
    S.bkLoserId     = data.bk_loser    ? data.bk_loser.id    : null;
    renderSpielenTab();
  })
  .catch(function() {});  // non-fatal — symbols simply won't show
```

**socket.on('game:finished') patch pattern** (index.html lines 421-424 — EXACT CURRENT CODE):
```js
socket.on('game:finished', function(data) {
  if (S.aktSpiel && S.aktSpiel._finishing) return;
  showWinnerBanner(data.state);
});
```
Add highlights refresh after `showWinnerBanner`:
```js
socket.on('game:finished', function(data) {
  if (S.aktSpiel && S.aktSpiel._finishing) return;
  showWinnerBanner(data.state);
  // Refresh champion IDs without page reload
  fetch('/api/highlights/current')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      S.kdaChampionId = d.kda_champion ? d.kda_champion.id : null;
      S.bkLoserId     = d.bk_loser    ? d.bk_loser.id    : null;
    }).catch(function() {});
});
```

**showWinnerBanner XSS fix** (index.html lines 507-523 — EXACT CURRENT CODE with innerHTML bug):
```js
// CURRENT (XSS risk — winnerName from DB concatenated into innerHTML):
banner.innerHTML = '<div style="background:var(--card);border:2px solid var(--ac);border-radius:16px;padding:32px;text-align:center">' +
  '<div style="font-size:48px;margin-bottom:8px">🏆</div>' +
  '<div style="font-family:var(--fh);font-size:32px;color:var(--ac)">' + winnerName + ' hat gewonnen!</div>' +
  '</div>';

// FIX — replace with DOM construction (textContent for winnerName):
var card = document.createElement('div');
card.style.cssText = 'background:var(--card);border:2px solid var(--ac);border-radius:16px;padding:32px;text-align:center';

var emojiEl = document.createElement('div');
emojiEl.style.cssText = 'font-size:48px;margin-bottom:8px';
emojiEl.textContent = '🏆';

var nameEl = document.createElement('div');
nameEl.style.cssText = 'font-family:var(--fh);font-size:32px;color:var(--ac)';
nameEl.textContent = winnerName + ' hat gewonnen!';  // textContent — XSS safe

card.appendChild(emojiEl);
card.appendChild(nameEl);
banner.appendChild(card);
```

**renderSpielenTab dispatcher** (index.html lines 777-791 — EXACT CURRENT CODE):
```js
function renderSpielenTab() {
  var el = document.getElementById('r-spielen');
  if (!S.aktSpiel) {
    el.innerHTML = '<div class="empty" ...>...';
    return;
  }
  switch (S.aktSpiel.type_key) {
    case 'viergewinnt':  renderVGSpiel(el, S.aktSpiel.state); break;
    case 'fuchsjagd':   renderFJSpiel(el, S.aktSpiel.state); break;
    case 'anker':       renderAnkerSpiel(el, S.aktSpiel.state); break;
    case 'kda':         renderKDASpiel(el, S.aktSpiel.state); break;
    case 'bilderkegel': renderBKSpiel(el, S.aktSpiel.state); break;
    default:            renderNSpiel(el, S.aktSpiel.state); break;
  }
}
```
The symbol injection happens inside each individual renderer (`renderBKSpiel`, `renderNSpiel`, `renderFJSpiel`, `renderVGSpiel`, `renderKDASpiel`) — not in the dispatcher.

**renderBKSpiel innerHTML pattern** (index.html line 818 — one long line):
The renderer uses `innerHTML` with player names concatenated. Symbol injection requires surgical refactoring for just the player name cell. Pattern for the name `<td>` inside each row:
```js
// CURRENT (inside renderBKSpiel rows map):
'<td>' + p.emoji + ' ' + p.name + (isZ ? ' <span ...>💩...</span>' : ...) + '</td>'

// NEW — build name cell via DOM, append symbol span:
var nameTd = document.createElement('td');
var nameText = document.createTextNode(p.emoji + ' ' + p.name);  // textContent equivalent
nameTd.appendChild(nameText);
if (S.kdaChampionId && p.id === S.kdaChampionId) {
  var sym = document.createElement('span');
  sym.className = 'player-symbol';
  sym.setAttribute('aria-label', 'Kegler des Abends');
  sym.textContent = ' 🏆';
  nameTd.appendChild(sym);
} else if (S.bkLoserId && p.id === S.bkLoserId) {
  var sym = document.createElement('span');
  sym.className = 'player-symbol';
  sym.setAttribute('aria-label', 'Bilderkegeln-Verlierer');
  sym.textContent = ' 💩';
  nameTd.appendChild(sym);
}
```
The same `appendSymbol(nameTd, p.id)` helper can be extracted and reused across all renderers.

**All player renderers use innerHTML** (index.html lines 818, 857, 887, 914):
- `renderBKSpiel` — line 818 — one-liner innerHTML
- `renderNSpiel` — line 857 — one-liner innerHTML
- `renderVGSpiel` — line 887 — one-liner innerHTML, uses `sp.tX.map(p => p.name).join(', ')` (already not in a DB-sourced innerHTML position for the team name list)
- `renderFJSpiel` — line 914 — one-liner innerHTML, uses `sp.fuchs.name`, `sp.jaeger.map(j => j.name)`

For symbol injection: only the individual player name `<td>` or equivalent cell in each renderer needs refactoring. The rest of each renderer's innerHTML can remain as-is. Targeted surgical approach per renderer.

---

### `Claude/server/routes/highlights.test.js` (test)

**Analog:** `Claude/server/routes/stats.test.js`

**Test framework pattern** (stats.test.js lines 1-9):
```js
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const bcrypt = require('bcryptjs');
```

**PIN setup — MUST come before app require** (stats.test.js lines 13-16):
```js
const PIN = '1234';
const PIN_HASH = bcrypt.hashSync(PIN, 10);
process.env.PIN_HASH = PIN_HASH;
```

**before() block — isolated DB pattern** (stats.test.js lines 27-72):
```js
before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-highlights-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.SESSION_SECRET = 'test-secret-do-not-use-in-prod';
  process.env.NODE_ENV = 'test';
  process.env.SESSION_DIR = tmpDir;
  process.env.PIN_HASH = PIN_HASH;
  fs.mkdirSync(tmpDir, { recursive: true });

  // Clear module cache — this is REQUIRED to avoid DB path leaking between test files
  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  clearCache('../db/index');
  clearCache('../db/seed');
  clearCache('../app');
  clearCache('./highlights');
  clearCache('./games');
  clearCache('./players');
  clearCache('./auth');
  clearCache('../middleware/auth');
  clearCache('../game-types/index');

  db = require('../db/index');
  // Do NOT seed — tests control exactly which players exist (same as stats.test.js line 51)

  const app = require('../app');

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
  // No login needed — highlights endpoint is public (no requireSession)
});
```

**after() block** (stats.test.js lines 74-91):
```js
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Clear module cache (same clearCache list as before())
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});
```

**insertPlayer helper** (stats.test.js lines 97-102 — copy verbatim):
```js
function insertPlayer(name, emoji = '🎳', archived = 0) {
  const result = db.prepare(
    'INSERT INTO players (name, emoji, archived) VALUES (?, ?, ?)'
  ).run(name, emoji, archived);
  return result.lastInsertRowid;
}
```

**insertFinishedGame helper** (stats.test.js lines 109-132 — copy and adapt):
For highlights tests, also need to insert a game with `finished_at` to distinguish ordering:
```js
function insertFinishedGame(type_key, playerRows) {
  const gameResult = db.prepare("INSERT INTO games (type_key, status, finished_at) VALUES (?, 'finished', datetime('now'))").run(type_key);
  const gameId = gameResult.lastInsertRowid;
  playerRows.forEach((p, seat) => {
    db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(gameId, p.id, seat);
  });
  let throwIdx = 0;
  for (const p of playerRows) {
    for (let i = 0; i < (p.throws || []).length; i++) {
      const meta = p.meta ? (p.meta[i] || null) : null;
      db.prepare(
        'INSERT INTO throws (game_id, player_id, throw_index, value, meta) VALUES (?, ?, ?, ?, ?)'
      ).run(gameId, p.id, throwIdx++, p.throws[i], meta ? JSON.stringify(meta) : null);
    }
  }
  return gameId;
}
```

**Test naming convention** (stats.test.js — test IDs):
Stats tests use ST10-ST20. Highlights tests should use HL10-HL20:
```js
test('HL10: GET /api/highlights/current returns { kda_champion: null, bk_loser: null } when no finished games', async () => { ... });
test('HL11: GET /api/highlights/current returns kda_champion after finished KDA game', async () => { ... });
test('HL12: GET /api/highlights/current returns bk_loser after finished Bilderkegeln game', async () => { ... });
test('HL13: GET /api/highlights/current returns most recent result when multiple games exist', async () => { ... });
test('HL14: GET /api/highlights/current returns 200 with nulls when no relevant games exist', async () => { ... });
```

**Assert pattern** (stats.test.js lines 143-154):
```js
const res = await fetch(`${baseUrl}/api/highlights/current`);
assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
const body = await res.json();
assert.ok(body.kda_champion === null || typeof body.kda_champion === 'object', 'kda_champion should be null or object');
assert.ok(body.bk_loser === null || typeof body.bk_loser === 'object', 'bk_loser should be null or object');
```

---

## Shared Patterns

### textContent-only XSS Guard
**Source:** `Claude/public/tv.js` throughout (lines 53, 126, 200, 235, 255, etc.) + CLAUDE.md mandate
**Apply to:** ALL new code in tv.js and index.html that renders DB-sourced strings
```js
// ALWAYS:
el.textContent = playerName;          // safe
// NEVER:
el.innerHTML = playerName;            // PROHIBITED by CLAUDE.md for DB-sourced strings
el.innerHTML = '...' + playerName + '...';  // PROHIBITED
```

### Full-screen TV Takeover Pattern
**Source:** `Claude/public/tv.js` `renderKDABracket` lines 103-210
**Apply to:** `renderEndOverlay`, `renderBilderkegelTV`, `renderFuchsjagdTV`, `renderViergewinntTV`
```js
idleEl.style.display = 'none';           // step 1
gameEl.classList.add('active');           // step 2 — required for display:block CSS
var container = document.createElement('div');
container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);...';
// ... build DOM with textContent only
gameEl.replaceChildren(container);        // step 3 — replace ALL gameEl children
```

### Express Route Registration
**Source:** `Claude/server/app.js` lines 62-67
**Apply to:** `Claude/server/app.js` (adding highlights route)
```js
app.use('/api/highlights', require('./routes/highlights'));
```
Always add after existing routes, before the error middleware.

### Non-fatal DB Query Error Handling
**Source:** `Claude/server/routes/stats.js` lines 46-53 (try/catch per game)
**Apply to:** `Claude/server/routes/highlights.js`
```js
try {
  state = reconstructState(game);
  // ... derive champion data
} catch (e) { /* non-fatal — skip this game */ }
```

### Module Cache Clearing in Tests
**Source:** `Claude/server/routes/stats.test.js` lines 36-48
**Apply to:** `Claude/server/routes/highlights.test.js`
Must clear `'../db/index'`, `'../app'`, `'./highlights'`, `'./games'`, `'./players'`, `'./auth'`, `'../middleware/auth'`, `'../game-types/index'` in both `before()` and `after()` blocks.

---

## No Analog Found

All files have close analogs. No entries needed here.

---

## Metadata

**Analog search scope:** `Claude/server/routes/`, `Claude/public/`, `Claude/server/app.js`
**Files scanned:** tv.js (312 lines), games.js (220+ lines), stats.js (144 lines), stats.test.js (433 lines), games.test.js (80+ lines), app.js (77 lines), index.html (lines 410-968)
**Pattern extraction date:** 2026-05-24
