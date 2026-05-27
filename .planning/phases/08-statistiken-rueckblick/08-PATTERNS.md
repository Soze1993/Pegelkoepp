# Phase 8: Statistiken & Rückblick — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 6
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/routes/stats.js` | route/service | CRUD (read-only analytics) | `server/routes/stats.js` itself | exact — extend existing file |
| `server/routes/stats.test.js` | test | batch | `server/routes/highlights.test.js` | exact — same test harness, same helpers |
| `server/routes/abende.js` | route | request-response | `server/routes/abende.js` itself + `server/routes/highlights.js` | exact — extend existing; borrow reconstructState+getBKLoserId pattern |
| `server/routes/abende.test.js` | test | batch | `server/routes/highlights.test.js` | exact — same isolated DB + ephemeral server pattern |
| `server/routes/highlights.js` | route/utility | request-response | N/A (this IS the source) | source — export `getBKLoserId` |
| `public/index.html` | component/UI | request-response | `public/index.html` itself | exact — extend `renderStats()`, `renderSpiele()`, `showSpDetail()` |

---

## Pattern Assignments

### `server/routes/stats.js` — extend with 5 new GET sub-routes

**Analog:** `server/routes/stats.js` (the file itself, lines 1–164)

**Imports pattern** (lines 1–8 — DO NOT change; these already provide everything needed):
```javascript
'use strict';

const { Router } = require('express');
const db = require('../db');
const gameTypes = require('../game-types');
const { reconstructState } = require('./games');

const router = Router();
```

For the new BK-counts sub-route, also add after line 6:
```javascript
const { getBKLoserId } = require('./highlights');
```

**Core loop pattern** (lines 40–58 — copy exactly for each new sub-route):
```javascript
for (const game of finishedGames) {
  const gameModule = gameTypes[game.type_key];
  if (!gameModule) continue;

  let state;
  let results;
  try {
    state = reconstructState(game);
    results = gameModule.getFinalResults(state);
  } catch (e) {
    continue;
  }

  const winners = results.filter(r => r.winner);
  const isDraw = winners.length !== 1;
  // ... attribution logic per sub-route
}
```

**isDraw check** (line 57–58 — use verbatim):
```javascript
const winners = results.filter(r => r.winner);
const isDraw = winners.length !== 1;
```

**Sub-route placement rule:** All new `router.get('/year', ...)`, `router.get('/streaks', ...)`, `router.get('/h2h', ...)`, `router.get('/kda-counts', ...)`, `router.get('/bk-counts', ...)` handlers MUST be added BEFORE `module.exports = router` (line 164) and AFTER the existing `router.get('/', ...)` block. Add a comment: `// Sub-routes must precede any future router.get('/:id') to avoid param capture`.

**Year sub-route — query filter pattern** (from RESEARCH.md Finding 3):
```javascript
// GET /api/stats/year — query params validated before DB touch
router.get('/year', (req, res) => {
  const year = String(req.query.year || new Date().getFullYear());
  if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: 'Invalid year' });
  const games = db.prepare(
    "SELECT * FROM games WHERE status = 'finished' AND strftime('%Y', finished_at) = ?"
  ).all(year);
  // ... existing loop pattern (copy from lines 40-94) ...
  const availableYears = db.prepare(
    "SELECT DISTINCT strftime('%Y', finished_at) AS y FROM games WHERE status = 'finished' AND finished_at IS NOT NULL ORDER BY y DESC"
  ).all().map(r => r.y);
  res.json({ year, leaderboard, available_years: availableYears });
});
```

**Streaks sub-route — ORDER BY id ASC is required** (avoids tie-breaking ambiguity per RESEARCH.md Pitfall 3):
```javascript
router.get('/streaks', (req, res) => {
  const allGames = db.prepare(
    "SELECT * FROM games WHERE status = 'finished' ORDER BY id ASC"
  ).all();
  const streaks = {};  // player_id → { current, longest }
  for (const game of allGames) {
    // ... copy core loop pattern ...
    for (const r of results) {
      if (!streaks[r.playerId]) streaks[r.playerId] = { current: 0, longest: 0 };
      const s = streaks[r.playerId];
      if (!isDraw && r.winner) {
        s.current++;
        if (s.current > s.longest) s.longest = s.current;
      } else {
        s.current = 0;
      }
    }
  }
  res.json(streaks);
});
```

**H2H sub-route — self-join pattern** (from RESEARCH.md Finding 5):
```javascript
router.get('/h2h', (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (!Number.isInteger(a) || a <= 0 || !Number.isInteger(b) || b <= 0) {
    return res.status(400).json({ error: 'a and b must be positive integers' });
  }
  const sharedGames = db.prepare(`
    SELECT g.* FROM games g
    JOIN game_players gpa ON gpa.game_id = g.id AND gpa.player_id = ?
    JOIN game_players gpb ON gpb.game_id = g.id AND gpb.player_id = ?
    WHERE g.status = 'finished'
    ORDER BY g.finished_at ASC
  `).all(a, b);
  // ... core loop, count winsA / winsB / draws ...
  res.json({ player_a: a, player_b: b, wins_a: winsA, wins_b: winsB, draws, total: sharedGames.length });
});
```

**KDA-counts sub-route** (from RESEARCH.md Finding 1):
```javascript
router.get('/kda-counts', (req, res) => {
  const kdaGames = db.prepare(
    "SELECT * FROM games WHERE type_key = 'kda' AND status = 'finished' ORDER BY id ASC"
  ).all();
  const kdaCounts = {};
  for (const game of kdaGames) {
    try {
      const state = reconstructState(game);
      if (state && state.gewinner && state.gewinner.id != null) {
        kdaCounts[state.gewinner.id] = (kdaCounts[state.gewinner.id] || 0) + 1;
      }
    } catch (e) { continue; }
  }
  res.json(kdaCounts);
});
```

**BK-counts sub-route** — uses imported `getBKLoserId` (from RESEARCH.md Finding 2):
```javascript
router.get('/bk-counts', (req, res) => {
  const bkGames = db.prepare(
    "SELECT * FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' ORDER BY id ASC"
  ).all();
  const bkCounts = {};
  for (const game of bkGames) {
    try {
      const state = reconstructState(game);
      const loserId = getBKLoserId(state);
      if (loserId != null) {
        bkCounts[loserId] = (bkCounts[loserId] || 0) + 1;
      }
    } catch (e) { continue; }
  }
  res.json(bkCounts);
});
```

---

### `server/routes/stats.test.js` — extend with Wave 0 RED stubs

**Analog:** `server/routes/highlights.test.js` (lines 1–371) — same harness, same `before`/`after` structure

**Test harness pattern** (lines 1–91 of highlights.test.js — DO NOT re-implement; copy from stats.test.js which already has the same structure at lines 1–91):

The existing `stats.test.js` already has the full harness (before/after, tmpDir, clearCache, db, server, baseUrl, cookie). The new tests attach to the same harness.

**Existing helper to reuse** (stats.test.js lines 97–132):
```javascript
function insertPlayer(name, emoji = '🎳', archived = 0) {
  const result = db.prepare(
    'INSERT INTO players (name, emoji, archived) VALUES (?, ?, ?)'
  ).run(name, emoji, archived);
  return result.lastInsertRowid;
}

function insertFinishedGame(type_key, players) {
  const gameResult = db.prepare("INSERT INTO games (type_key, status) VALUES (?, 'finished')").run(type_key);
  const gameId = gameResult.lastInsertRowid;
  players.forEach((p, seat) => {
    db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)').run(gameId, p.id, seat);
  });
  let throwIdx = 0;
  for (const p of players) {
    const metas = p.meta || [];
    for (let i = 0; i < (p.throws || []).length; i++) {
      const metaObj = metas[i] || null;
      db.prepare(
        'INSERT INTO throws (game_id, player_id, throw_index, value, meta) VALUES (?, ?, ?, ?, ?)'
      ).run(gameId, p.id, throwIdx++, p.throws[i], metaObj ? JSON.stringify(metaObj) : null);
    }
  }
  return gameId;
}
```

**New helpers to add** (copy verbatim from highlights.test.js lines 144–263):
- `insertFinishedKDAGame(p1Id, p2Id, p3Id, p4Id, finishedAt)` — returns `{ gameId, winnerId }`
- `insertFinishedBKGame(p1Id, p2Id, finishedAt)` — returns `{ gameId, loserId }`

Note: `insertFinishedGame` in stats.test.js does NOT accept a `finishedAt` param (compare to highlights.test.js which does). The year sub-route tests need to control `finished_at`. Add an overloaded version or update the helper to accept `finishedAt`.

**RED test stub shape** (copy pattern from highlights.test.js lines 270–283):
```javascript
test('ST30: GET /api/stats/year returns 400 for invalid year param', async () => {
  const res = await fetch(`${baseUrl}/api/stats/year?year=abc`);
  assert.equal(res.status, 400);
});

test('ST31: GET /api/stats/year returns leaderboard with wins for given year', async () => {
  // insert player + finished game with explicit finished_at in target year
  // fetch /api/stats/year?year=YYYY
  // assert leaderboard contains player with wins > 0
  assert.fail('RED — not implemented yet');
});
```

**Test ID convention:** Existing tests are ST10–ST22. New tests start at ST30 (stats sub-routes), AB30 (abende recap).

---

### `server/routes/abende.js` — add GET /api/abende/last-summary handler

**Analog:** `server/routes/abende.js` + `server/routes/highlights.js`

**Imports to add** (after line 5 of abende.js — currently only imports `Router`, `db`, `requireSession`):
```javascript
const gameTypes = require('../game-types');
const { reconstructState } = require('./games');
const { getBKLoserId } = require('./highlights');
```

**Route placement rule** (mirrors the `/active` comment at line 19–21 of abende.js):
```javascript
// Must be defined BEFORE GET /:id to avoid 'last-summary' being treated as an id param.
router.get('/last-summary', (req, res) => {
```

Place this handler AFTER `router.get('/active', ...)` (line 22) and BEFORE `router.get('/', ...)` (line 33).

**Handler core pattern** (from RESEARCH.md Finding 6 + highlights.js lines 36–83):
```javascript
router.get('/last-summary', (req, res) => {
  const lastAbend = db.prepare(
    'SELECT * FROM abende WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1'
  ).get();
  if (!lastAbend) return res.json(null);

  const abendGames = db.prepare(
    "SELECT * FROM games WHERE abend_id = ? AND status = 'finished' ORDER BY id ASC"
  ).all(lastAbend.id);
  // ORDER BY id ASC — not finished_at — to match BK exemption chain order (Pitfall 3)

  let kda_champion = null;
  let bk_loser = null;
  const gamesSummary = [];

  for (const game of abendGames) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) continue;
    let state, results;
    try {
      state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) { continue; }

    if (game.type_key === 'kda' && state.gewinner && state.gewinner.id != null) {
      const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(state.gewinner.id);
      if (p) kda_champion = { id: p.id, name: p.name, emoji: p.emoji };
    }

    if (game.type_key === 'bilderkegel') {
      const loserId = getBKLoserId(state);
      if (loserId != null) {
        const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(loserId);
        if (p) bk_loser = { id: p.id, name: p.name, emoji: p.emoji };
      }
    }

    const winners = results.filter(r => r.winner);
    const winnerEntry = winners.length === 1 ? winners[0] : null;
    let winner_name = null;
    if (winnerEntry) {
      const wp = db.prepare('SELECT name FROM players WHERE id = ?').get(winnerEntry.playerId);
      if (wp) winner_name = wp.name;
    }
    gamesSummary.push({
      id: game.id,
      type_key: game.type_key,
      finished_at: game.finished_at,
      winner_name,
      player_count: results.length
    });
  }

  res.json({
    abend: { id: lastAbend.id, name: lastAbend.name, started_at: lastAbend.started_at, ended_at: lastAbend.ended_at },
    kda_champion,
    bk_loser,
    games: gamesSummary
  });
});
```

**Error handling:** No try/catch wrapping the outer handler — inner per-game try/catch is sufficient (same pattern as highlights.js lines 54–57 and 76–79).

---

### `server/routes/abende.test.js` — new test file for recap endpoint

**Analog:** `server/routes/highlights.test.js` (lines 1–371) — this is the canonical test for a public, read-only endpoint that uses reconstructState

**Harness pattern** (copy from highlights.test.js lines 1–81, replacing module cache paths):
```javascript
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const bcrypt = require('bcryptjs');

const PIN = '1234';
const PIN_HASH = bcrypt.hashSync(PIN, 10);
process.env.PIN_HASH = PIN_HASH;

let tmpDir, server, baseUrl, db;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-abende-test-'));
  process.env.DB_PATH = path.join(tmpDir, 'test.db');
  process.env.SESSION_SECRET = 'test-secret-do-not-use-in-prod';
  process.env.NODE_ENV = 'test';
  process.env.SESSION_DIR = tmpDir;
  process.env.PIN_HASH = PIN_HASH;
  fs.mkdirSync(tmpDir, { recursive: true });

  const clearCache = (mod) => {
    try { delete require.cache[require.resolve(mod)]; } catch (_) {}
  };
  // Clear all relevant modules — include './abende' and './highlights' (getBKLoserId dep)
  ['../db/index','../db/seed','../app','./abende','./highlights','./games',
   './players','./auth','../middleware/auth','../game-types/index']
    .forEach(clearCache);

  db = require('../db/index');
  const app = require('../app');
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  // No login — last-summary is public
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // ... clearCache same list ...
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});
```

**Helpers to copy from highlights.test.js** (lines 87–263):
- `insertPlayer(name, emoji, archived)` — lines 87–92
- `insertFinishedGame(type_key, playerRows, finishedAt)` — lines 100–124 (use the version WITH finishedAt param)
- `insertFinishedKDAGame(p1Id, p2Id, p3Id, p4Id, finishedAt)` — lines 144–207
- `insertFinishedBKGame(p1Id, p2Id, finishedAt)` — lines 215–263

**Additional helper needed** (not in highlights.test.js — insert a closed abend):
```javascript
function insertClosedAbend(name, endedAt) {
  const result = db.prepare(
    "INSERT INTO abende (name, ended_at) VALUES (?, ?)"
  ).run(name || 'Test Abend', endedAt || '2026-01-01 22:00:00');
  return result.lastInsertRowid;
}
```

**Test shape** (RED stub, mirrors highlights.test.js lines 270–283):
```javascript
test('AB30: GET /api/abende/last-summary returns null when no closed abend exists', async () => {
  const res = await fetch(`${baseUrl}/api/abende/last-summary`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body, null);
});

test('AB31: GET /api/abende/last-summary returns abend + kda_champion + bk_loser + games[]', async () => {
  assert.fail('RED — not implemented yet');
});
```

---

### `server/routes/highlights.js` — export getBKLoserId

**Current state** (lines 15–26): `getBKLoserId` is a private function (no `module.exports` exposure).

**Change needed** — replace line 85:
```javascript
// Before:
module.exports = router;

// After:
module.exports = router;
module.exports.getBKLoserId = getBKLoserId;
```

No other changes to highlights.js. The function body (lines 15–26) is unchanged.

**Verification:** After the export change, `require('./highlights').getBKLoserId` must be importable in both `stats.js` and `abende.js`. The existing highlights.test.js tests must continue to pass — they import `./highlights` for the route handler only, not the function directly, so no breaking change.

---

### `public/index.html` — extend renderStats(), renderSpiele(), showSpDetail()

**Analog:** `public/index.html` (the file itself)

**State object pattern** (lines 348–355 — how `S` is populated at init):
```javascript
var [playersRes, statsRes] = await Promise.all([fetch('/api/players'), fetch('/api/stats')]);
S.spieler = await playersRes.json();
var statsArr = []; try { var _sd = await statsRes.json(); statsArr = _sd.players || _sd; } catch(e) {}
```

New state slots to add (store alongside existing `S.spieler`, `S.typen`, `S.aktAbend`):
```javascript
S.streaks = {};      // player_id → { current, longest }
S.kdaCounts = {};    // player_id → count
S.bkCounts = {};     // player_id → count
```

**Parallel fetch pattern** (lines 348–350 — `Promise.all` idiom to copy for stats tab init):
```javascript
var [playersRes, statsRes] = await Promise.all([fetch('/api/players'), fetch('/api/stats')]);
```

Extended version for `renderStats()`:
```javascript
var [statsRes, yearRes, streaksRes, kdaRes, bkRes] = await Promise.all([
  fetch('/api/stats'),
  fetch('/api/stats/year?year=' + new Date().getFullYear()),
  fetch('/api/stats/streaks'),
  fetch('/api/stats/kda-counts'),
  fetch('/api/stats/bk-counts')
]);
```

**mkChip factory pattern** (lines 1641–1653 — already defined inside `renderStats()`; reuse for new chips):
```javascript
function mkChip(val, label, extraCls) {
  var c = document.createElement('div');
  c.className = 'chip' + (extraCls ? ' ' + extraCls : '');
  var v = document.createElement('div');
  v.className = 'v';
  v.textContent = val;
  var l = document.createElement('div');
  l.className = 'l';
  l.textContent = label;
  c.appendChild(v);
  c.appendChild(l);
  return c;
}
```

Use for streak chips. Set `v.style.color = 'var(--grn)'` for current streak (if > 0), default for longest.

**Table/tbody pattern** (lines 1669–1685 — `.stbl` + thead + tbody construction):
```javascript
var tbl = document.createElement('table');
tbl.className = 'stbl';
tbl.innerHTML = '<thead><tr><th>#</th><th>Spieler</th><th style="text-align:right">Siege</th></tr></thead>';
var tbody = document.createElement('tbody');
// ... rows ...
tbl.appendChild(tbody);
```

Use verbatim for year leaderboard and recap game list.

**Toggle/details pattern** (lines 1661–1698 — toggle open/closed with ▼/▶ prefix):
```javascript
var toggle = document.createElement('div');
toggle.style.cssText = 'font-size:13px;color:var(--mut);cursor:pointer;margin-top:10px;width:100%';
toggle.textContent = '▼ Bestleistungen';
var panel = document.createElement('div');
panel.style.display = 'none';
toggle.addEventListener('click', function() {
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  toggle.textContent = (open ? '▼' : '▶') + ' Bestleistungen';
});
```

Apply same pattern for "▼ Spiele des Abends" in the recap card.

**renderSpiele() insertion point** (lines 790–796 — after the `else` block that renders the "▶ Abend starten" button, before the abende fetch at line 800):
```javascript
// After frag.appendChild(startBtn) or frag.appendChild(banner):
// → Insert recap card fetch and render here
var recapData = null;
try {
  var recapRes = await fetch('/api/abende/last-summary');
  recapData = await recapRes.json();
} catch(e) {}
if (recapData) {
  var recapCard = buildRecapCard(recapData);
  frag.appendChild(recapCard);
}
```

**showSpDetail() insertion point** (line 652 — the innerHTML string ends with the third `.chip` grid; append a new 2-col chip row after it):

The current last line of the innerHTML template ends:
```javascript
'...<div class="chip pc"><div class="v">'+(s.pudel||0)+'</div><div class="l">Pudel '+rate+'%</div></div></div>'
```

Append after `</div>` at the very end, before the closing quote:
```javascript
+ '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">'
+ '<div class="chip"><div class="v" style="color:var(--ac)">' + (S.kdaCounts && S.kdaCounts[id] || 0) + '</div><div class="l">KdA-Titel</div></div>'
+ '<div class="chip"><div class="v" style="color:var(--red)">' + (S.bkCounts && S.bkCounts[id] || 0) + '</div><div class="l">BK Verlierer</div></div>'
+ '</div>'
```

**Error/loading state pattern** (lines 1613–1617 — used in existing `renderStats()`):
```javascript
el.innerHTML = '<div class="empty"><p>Laden…</p></div>';
// ... on catch:
el.innerHTML = '<div class="empty"><div class="icon">📊</div><p>Laden fehlgeschlagen.</p></div>';
```

For per-section failures in the extended renderStats, use inline loading/error text inside the section's card div rather than replacing the whole `r-stats` div.

**Empty state pattern** (lines 821–828):
```javascript
var emptyDiv = document.createElement('div');
emptyDiv.className = 'empty';
emptyDiv.innerHTML = '<div class="icon">🎳</div><p>Noch keine Spiele.<br>...</p>';
frag.appendChild(emptyDiv);
```

For year leaderboard empty year: inline `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--mut);font-size:13px">Keine Spiele in {year} abgeschlossen.</td></tr>` in tbody — consistent with existing stbl empty patterns.

**`renderAll()` pattern** (line 1728 — calls all render functions):
```javascript
function renderAll(){
  renderSpiele().catch(function(){});
  renderSpielerListe();
  renderSpielenTab();
  renderBib().catch(function(){});
  renderStats().catch(function(){});
}
```

`renderStats()` is already in `renderAll()`. No change to `renderAll()` needed — the new sub-fetches happen inside `renderStats()`.

---

## Shared Patterns

### reconstructState + getFinalResults pipeline
**Source:** `server/routes/stats.js` lines 46–53
**Apply to:** All new stats sub-routes and the abende last-summary handler
```javascript
let state;
let results;
try {
  state = reconstructState(game);
  results = gameModule.getFinalResults(state);
} catch (e) {
  continue;
}
```

### getBKLoserId
**Source:** `server/routes/highlights.js` lines 15–26 (to be exported)
**Apply to:** `server/routes/stats.js` (bk-counts route) + `server/routes/abende.js` (last-summary handler)
```javascript
function getBKLoserId(state) {
  if (!state || !state.players || state.players.length === 0) return null;
  const tots = state.players.map(p => ({
    id: p.id,
    total: (p.bildPts || []).reduce((a, b) => a + (b !== null ? b : 0), 0)
  }));
  const eligible = tots.filter(x => x.id !== (state.exemptPlayerId || null));
  const effTots = eligible.length > 0 ? eligible : tots;
  const minTot = Math.min(...effTots.map(t => t.total));
  const loser = effTots.find(t => t.total === minTot);
  return loser ? loser.id : null;
}
```

### Player lookup pattern
**Source:** `server/routes/highlights.js` lines 48–52 and 67–72
**Apply to:** Any handler that resolves a player_id to `{ id, name, emoji }`
```javascript
const player = db.prepare(
  'SELECT id, name, emoji FROM players WHERE id = ?'
).get(playerId);
if (player) {
  result.kda_champion = { id: player.id, name: player.name, emoji: player.emoji };
}
```

### Order-by-id for BK game iteration
**Source:** RESEARCH.md Pitfall 3 (verified from games.js BK exemption chain logic)
**Apply to:** Any handler that iterates multiple BK games for stats
```javascript
// Always ORDER BY id ASC (not finished_at) when iterating BK games for reconstruction
db.prepare("SELECT * FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' ORDER BY id ASC").all()
```

### Test helper: clearCache list
**Source:** `server/routes/highlights.test.js` lines 35–47 and 66–79
**Apply to:** `server/routes/abende.test.js`
```javascript
const clearCache = (mod) => {
  try { delete require.cache[require.resolve(mod)]; } catch (_) {}
};
clearCache('../db/index');
clearCache('../db/seed');
clearCache('../app');
clearCache('./abende');
clearCache('./highlights');   // required: abende.js now imports highlights.js for getBKLoserId
clearCache('./games');
clearCache('./players');
clearCache('./auth');
clearCache('../middleware/auth');
clearCache('../game-types/index');
```

### Document fragment + innerHTML reset pattern
**Source:** `public/index.html` lines 744–746 and 1612–1614
**Apply to:** All new render blocks inside `renderSpiele()` and `renderStats()`
```javascript
// Build into fragment, then swap at the end
var frag = document.createDocumentFragment();
// ... build nodes ...
el.innerHTML = '';
el.appendChild(frag);
```

---

## No Analog Found

None. All files being created or modified have direct analogs in the codebase.

---

## Metadata

**Analog search scope:** `server/routes/`, `public/`
**Files read:** `server/routes/stats.js`, `server/routes/highlights.js`, `server/routes/abende.js`, `server/routes/highlights.test.js`, `server/routes/stats.test.js`, `public/index.html` (targeted sections)
**Pattern extraction date:** 2026-05-27
