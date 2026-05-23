# Phase 6: Turnierbaum - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 4 (2 new/replaced, 2 modified)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `Claude/server/game-types/kegler-des-abends.js` | game-engine module | event-driven (throw-by-throw accumulation) | `Claude/server/game-types/vier-gewinnt.js` | role-match (same interface, accumulates per-throw state) |
| `Claude/server/game-types/kegler-des-abends.test.js` | test | batch (replay sequences) | `Claude/server/game-types/vier-gewinnt.test.js` | exact |
| `Claude/public/index.html` (renderKDASpiel + startKDA + modal) | component | request-response + event-driven | `Claude/public/index.html` existing KDA block (lines 903–931) | self-analog (same file, replace functions) |
| `Claude/public/tv.js` (renderGame + new renderKDABracket) | component | event-driven (socket) | `Claude/public/tv.js` existing renderGame (lines 37–82) | self-analog (same file, add branch before guard) |

---

## Pattern Assignments

---

### `Claude/server/game-types/kegler-des-abends.js` (game-engine module, event-driven)

**Analog:** `Claude/server/game-types/vier-gewinnt.js` — same `{ id, name, initState, applyThrow, isFinished, getFinalResults }` interface contract; `applyThrow` accumulates per-throw state before resolving an outcome; `JSON.parse(JSON.stringify(state))` deep-clone guard at top of `applyThrow`.

**Module declaration pattern** (`vier-gewinnt.js` lines 23–39):
```javascript
'use strict';

module.exports = {
  id: 'viergewinnt',
  name: 'Vier Gewinnt',

  initState(players) {
    return {
      // ... shape fields ...
      done: false,
      winner: null
    };
  },
  // ...
};
```
Copy: open with `'use strict';`, export a plain object literal (not a class), include `id`, `name`, and the four contract functions. Keep `seededShuffle` and `shuffle` as private module-scope functions above `module.exports`.

**applyThrow immutability + early-exit guard** (`vier-gewinnt.js` lines 42–45):
```javascript
applyThrow(state, playerId, value, meta = {}) {
  const s = JSON.parse(JSON.stringify(state));
  if (s.done) return s;
  // ...
  return s;
},
```
Copy verbatim. The new engine's `applyThrow(state, player_id, value)` must deep-clone first and guard on `s.done`. **Never mutate the input `state` object.**

**isFinished pattern** (`vier-gewinnt.js` lines 79–81):
```javascript
isFinished(state) {
  return state.done;
},
```
Copy verbatim. The new engine sets `s.done = true` inside `applyThrow` when the Grand Final is resolved.

**getFinalResults pattern** (`vier-gewinnt.js` lines 83–93):
```javascript
getFinalResults(state) {
  const w = state.winner;
  const allPlayers = [...state.tX, ...state.tO];
  return allPlayers.map(p => ({
    playerId: p.id,
    team: p.team,
    score: 0,
    winner: w !== 'draw' && w !== null && p.team === w
  }));
}
```
Adapt for KDA: iterate over all seeded players from `state.bracket` (unique by id), compute placement from final bracket state, set `winner: true` only for `state.gewinner.id`. Score field: use finish position (1 = champion, 2 = GF loser, etc.) — or `-(losses)` as old engine did.

**seededShuffle utility** (`kegler-des-abends.js` lines 3–25 — the file being replaced):
```javascript
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = 0;
  for (let i = 0; i < String(seed).length; i++) {
    s = (s * 31 + String(seed).charCodeAt(i)) >>> 0;
  }
  if (s === 0) s = 1;
  function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
```
**Preserve this function exactly.** It is the deterministic LCG-based shuffle used for crash-recovery replay. `initState` receives `config.seed` (set by the frontend as `Date.now()`) and passes it here. Without the same seed, `reconstructState` would produce a different player order after a server crash.

**initState seed pattern** (`kegler-des-abends.js` lines 41–46 — old file):
```javascript
initState(players, config = {}) {
  const seed = (config && config.seed != null) ? String(config.seed) : null;
  const sl = seed !== null
    ? seededShuffle(players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji })), seed)
    : shuffle(players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji })));
  // ...
  return { /* ... */ _seed: seed };
},
```
Copy the seed-or-null pattern and the `_seed` preservation. For Phase 6, `initState` uses the shuffled player list to assign seeds for bracket slot generation (D-02).

**Bracket slot structure to generate in initState** (from RESEARCH.md Pattern 1):
```javascript
// Each slot in the flat bracket[] array:
{
  id: 'W-R1-1',           // string — unique slot identifier
  round: 1,               // integer — round number within bracket
  bracket: 'W',           // 'W' | 'L' | 'GF'
  p1: { id, name, emoji } | null,
  p2: { id, name, emoji } | null,
  throws: [],             // [{ playerId, throwIndex, value }, ...]
  winner: null,           // player object when resolved
  loser: null,            // player object when resolved
  done: false,
  isBye: false,
  tiebreak: false,
  advancesWinnerTo: 'W-R2-1',  // slot id, or null for GF winner
  advancesLoserTo:  'L-R1-1',  // slot id, or null for GF loser
  throwsRequired: 2,           // 2 for standard rounds (1/player), 4 for GF (2/player)
}
```

**applyThrow pin-count accumulation** (from RESEARCH.md Pattern 2 — no existing analog, use this skeleton):
```javascript
applyThrow(state, player_id, value) {
  const s = JSON.parse(JSON.stringify(state));
  if (s.done) return s;

  // Find active match for this player
  const match = s.bracket.find(m =>
    !m.done && !m.isBye && m.p1 && m.p2 &&
    (m.p1.id === player_id || m.p2.id === player_id)
  );
  if (!match) return s;

  // Record throw (throwIndex = sequential position within this match)
  const throwIndex = match.throws.length;
  match.throws.push({ playerId: player_id, throwIndex, value });

  // Determine required throw count (default 2 for standard, 4 for GF)
  const throwsRequired = match.throwsRequired || (match.bracket === 'GF' ? 4 : 2);

  if (match.throws.length >= throwsRequired) {
    const p1Total = match.throws.filter(t => t.playerId === match.p1.id)
                                .reduce((sum, t) => sum + t.value, 0);
    const p2Total = match.throws.filter(t => t.playerId === match.p2.id)
                                .reduce((sum, t) => sum + t.value, 0);
    if (p1Total === p2Total) {
      match.tiebreak = true;
      match.throwsRequired = throwsRequired + 2; // add one more round of throws
    } else {
      match.winner = p1Total > p2Total ? match.p1 : match.p2;
      match.loser  = p1Total > p2Total ? match.p2 : match.p1;
      match.done   = true;
      // advance routing: populate p1 or p2 in downstream slots
      advancePlayer(s.bracket, match.advancesWinnerTo, match.winner);
      if (match.advancesLoserTo) advancePlayer(s.bracket, match.advancesLoserTo, match.loser);
      // check tournament completion
      const gf = s.bracket.find(m => m.bracket === 'GF');
      if (gf && gf.done) { s.done = true; s.gewinner = gf.winner; }
    }
  }
  return s;
},
```

**Player count validation** — add in `initState` before bracket generation:
```javascript
if (players.length < 4 || players.length > 12) {
  throw new Error('KDA requires 4–12 players');
}
```
The backend enforces this; the frontend guard in `startKDA` is the UX layer (D-12).

---

### `Claude/server/game-types/kegler-des-abends.test.js` (test, batch replay)

**Analog:** `Claude/server/game-types/vier-gewinnt.test.js` — exact structure match. Both use `node:test` + `node:assert/strict`, the same C1–C5 contract test block, then game-specific tests.

**File header and import pattern** (`vier-gewinnt.test.js` lines 1–9):
```javascript
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const kda = require('./kegler-des-abends');

const players4 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' },
  { id: 3, name: 'C', emoji: 'C' },
  { id: 4, name: 'D', emoji: 'D' }
];
```
Also define `players8` (8 players, ids 1–8) and `players6` (6 players, for bye-slot testing).

**C1 contract shape test** (`vier-gewinnt.test.js` lines 12–19):
```javascript
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof kda.id, 'string');
  assert.equal(typeof kda.name, 'string');
  assert.equal(typeof kda.initState, 'function');
  assert.equal(typeof kda.applyThrow, 'function');
  assert.equal(typeof kda.isFinished, 'function');
  assert.equal(typeof kda.getFinalResults, 'function');
});
```
Copy verbatim, substituting `kda` for `vierGewinnt`.

**C3 immutability test** (`vier-gewinnt.test.js` lines 28–33):
```javascript
test('C3: applyThrow does not mutate input state', () => {
  const state = kda.initState(players4, { seed: 'test' });
  const snapshot = JSON.parse(JSON.stringify(state));
  // Apply one throw (p1 of first pending match, value = 7 pins)
  const match = state.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
  kda.applyThrow(state, match.p1.id, 7);
  assert.deepEqual(state, snapshot);
});
```
Adapt: use `state.bracket` to find first active match. Pattern is identical — take snapshot, apply throw, compare.

**C4 determinism test** (`vier-gewinnt.test.js` lines 36–50 — adapt the `playOutTournament` helper):
```javascript
test('C4: two independent replays produce identical final states', () => {
  function playOutTournament(state) {
    let s = state;
    let iterations = 0;
    while (!kda.isFinished(s) && iterations < 100) {
      const match = s.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
      if (!match) break;
      // p1 always wins: submit p1 throw (value 9), then p2 throw (value 0)
      s = kda.applyThrow(s, match.p1.id, 9);
      s = kda.applyThrow(s, match.p2.id, 0);
      iterations++;
    }
    return s;
  }
  const s1 = playOutTournament(kda.initState(players4, { seed: 'det' }));
  const s2 = playOutTournament(kda.initState(players4, { seed: 'det' }));
  assert.deepEqual(s1, s2);
});
```

**KDA-specific test pattern** (existing `kegler-des-abends.test.js` KDA1–KDA6 — adapt, not delete):
The old KDA1 checks `state.spieler`, `state.matches`, `state.mid`, `state.wRound`. Replace with new shape assertions:
```javascript
test('KDA1: initState generates bracket[] with correct slot count for 4 players', () => {
  const state = kda.initState(players4, { seed: 'test' });
  assert.ok(Array.isArray(state.bracket));
  assert.equal(state.done, false);
  assert.equal(state.gewinner, null);
  // 4-player DE: W-R1-1, W-R1-2, W-Final, L-Final, GF = 5 slots minimum
  assert.ok(state.bracket.length >= 5);
  // All slots have required fields
  for (const slot of state.bracket) {
    assert.ok('id' in slot && 'p1' in slot && 'p2' in slot && 'throws' in slot);
    assert.ok('done' in slot && 'isBye' in slot && 'bracket' in slot);
  }
});
```

---

### `Claude/public/index.html` — `renderKDASpiel`, `startKDA`, throw modal (component, request-response)

**Analog:** Same file — the existing KDA block (lines 903–931) plus `submitThrow` (lines 394–406). This is a self-replacement: existing functions are directly substituted.

**submitThrow function** (`index.html` lines 394–406) — **reuse as-is, do not modify**:
```javascript
async function submitThrow(player_id, throw_index, value, meta) {
  var body = { player_id: player_id, throw_index: throw_index, value: value };
  if (meta !== undefined) body.meta = meta;
  var res = await fetch('/api/games/' + S.aktSpiel.gameId + '/throws', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    if (res.status === 409) { notify('Doppelter Wurf', 'var(--red)'); }
    else { notify('Fehler beim Wurf', 'var(--red)'); }
    return null;
  }
  return await res.json();
}
```
The new throw flow in the modal calls this function. For a standard match: `submitThrow(p1.id, 0, val1)` then `submitThrow(p2.id, 1, val2)` — throw_index is the sequential count within the match that the frontend must track.

**submitThrow + state update pattern** (used at `index.html` lines 797–800, `index.html` lines 842–845):
```javascript
var data = await submitThrow(akt.id, throwIndex, value, undefined);
if (!data) return;
S.aktSpiel.state = data.state;
if (data.finished) { handleGameFinished(data.state); } else { renderSpielenTab(); }
```
Copy this four-line sequence for each throw submission in the KDA modal. After each `submitThrow` call: update `S.aktSpiel.state`, check `data.finished`, re-render or finish.

**startKDA pattern** (`index.html` lines 907–921 — existing function to modify):
```javascript
async function startKDA() {
  if (kdaSel.length < 2) { notify('Mind. 2 Spieler', 'var(--red)'); return; }
  // CHANGE: min 4 (D-12)
  var res = await fetch('/api/games', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type_key: 'kda', player_ids: kdaSel, config: { seed: Date.now() } })
  });
  if (!res.ok) { notify('Fehler beim Starten', 'var(--red)'); return; }
  var data = await res.json();
  var detail = await fetch('/api/games/' + data.id).then(function(r){return r.json();});
  S.aktSpiel = { gameId: data.id, state: detail.state, type_key: 'kda' };
  joinGameRoom(data.id);
  closeM('m-kda');
  notify('Kegler des Abends gestartet!');
  showTab('spielen');
}
```
Change `< 2` to `< 4` and `> 12` guard. Change the label in the HTML modal (`line 223`) from `"Spieler (min. 2)"` to `"Spieler (min. 4, max. 12)"`.

**Modal HTML structure** (`index.html` lines 220–228 — KDA start modal):
```html
<div class="mo" id="m-kda"><div class="md">
  <h2>🏆 Kegler des Abends</h2>
  <div class="fg"><label>Datum</label><input type="date" id="m-kda-datum"></div>
  <div class="fg"><label>Spieler (min. 2)</label><div id="m-kda-wahl" ...></div></div>
  <div style="display:flex;gap:10px;margin-top:18px">
    <button class="btn bp" style="flex:1" onclick="startKDA()">Starten</button>
    <button class="btn bg" onclick="closeM('m-kda')">Abbrechen</button>
  </div>
</div></div>
```
Copy `.mo` + `.md` wrapper pattern for any new throw-entry modal. Use `closeM('m-kda-throw')` / `openM('m-kda-throw')` pattern.

**Format detection branch** (from RESEARCH.md Pattern 3) — the new `renderKDASpiel` entry point:
```javascript
function renderKDASpiel(el, state) {
  if (!state) { el.innerHTML = ''; return; }
  // New format: has state.bracket[] flat slot array
  if (state.bracket) {
    renderKDABracket(el, state);
  } else {
    renderKDALegacy(el, state); // old match-list renderer — preserved as-is
  }
}
```
The existing `renderKDASpiel` body (line 931) becomes `renderKDALegacy`.

**DOM construction pattern for bracket slots** — use `createElement` + `textContent`, NOT `innerHTML` with player data. Analog: `tv.js` lines 45–80:
```javascript
// Player name — safe (XSS guard)
nameEl.textContent = player.emoji + ' ' + player.name;  // NOT innerHTML

// Score — safe
throwValue.textContent = lastThrow;

// Clear and re-render
playerListEl.replaceChildren();  // preferred over innerHTML = ''
```
Apply to every bracket slot label, player name, and score display in `renderKDABracket`.

**Badge CSS classes** — use existing classes from `index.html` for match status:
- Active match: `.bamb` (amber)
- Winner bracket: `.bgrn` (green)
- Loser bracket: `.bamb` (amber)
- Eliminated: `.bred` (red)
- Not yet played: `.bgry` (grey — if present) or unstyled

---

### `Claude/public/tv.js` — `renderGame` + new `renderKDABracket` (component, event-driven)

**Analog:** `Claude/public/tv.js` itself — self-analog. New code adds a branch to the existing `renderGame` function and a new `renderKDABracket` helper.

**renderGame guard modification** (`tv.js` lines 37–39 — existing):
```javascript
function renderGame(state) {
  if (!state || !state.players) return;   // CURRENT — blocks KDA new format
```
Replace with (RESEARCH.md Pitfall 5):
```javascript
function renderGame(state) {
  // KDA new format: bracket tree display (must come BEFORE the state.players guard)
  if (state && state.bracket) { renderKDABracket(state); return; }
  if (!state || !state.players) return;
  // ... all existing code unchanged below ...
```

**renderGame DOM construction pattern** (`tv.js` lines 43–81):
```javascript
// Clear container
playerListEl.replaceChildren();

// Build each row
const li = document.createElement('li');
li.className = 'player-row' + (isActive ? ' active-player' : '');

const nameEl = document.createElement('span');
nameEl.className = 'player-name';
nameEl.textContent = player.emoji + ' ' + player.name;  // textContent — XSS safe

li.appendChild(nameEl);
playerListEl.appendChild(li);
```
Copy: all KDA TV bracket slot elements must be built with `createElement` + `textContent`. **No `innerHTML` with DB-sourced strings.**

**Socket event integration** (`tv.js` lines 20–22 — existing, no change needed):
```javascript
socket.on('throw:applied', ({ state }) => renderGame(state));
socket.on('undo:applied',  ({ state }) => renderGame(state));
socket.on('game:started',  ({ state, gameId }) => { socket.emit('join', gameId); renderGame(state); });
```
These already call `renderGame(state)` on every throw. The new `state.bracket` branch inside `renderGame` handles the rest. No new socket events needed (D-15).

**gameEl.replaceChildren pattern** (`tv.js` line 43):
```javascript
playerListEl.replaceChildren();  // safe clear — no innerHTML
```
In `renderKDABracket`, use `gameEl.replaceChildren(container)` to swap in the bracket tree DOM node. `gameEl` is already declared at line 5: `const gameEl = document.getElementById('game');`.

**renderKDABracket skeleton** (from RESEARCH.md Pattern 4):
```javascript
function renderKDABracket(state) {
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  const container = document.createElement('div');
  container.className = 'kda-tv-bracket';

  // Build W bracket columns, L bracket columns, GF column
  // For each slot: createElement('div') + className='tv-bracket-slot' + textContent for all labels
  // Active slots: add class 'active' for amber glow
  // In-progress score: slotEl.textContent = throw.value + (allThrowsDone ? '' : ' ⚫');

  gameEl.replaceChildren(container);
}
```

---

## Shared Patterns

### Immutability (applyThrow deep-clone)
**Source:** `Claude/server/game-types/vier-gewinnt.js` line 43 and `Claude/server/game-types/kegler-des-abends.js` (old) line 78
**Apply to:** `kegler-des-abends.js` `applyThrow` — first line of function body
```javascript
const s = JSON.parse(JSON.stringify(state));
if (s.done) return s;
```

### DB-first throw persistence
**Source:** `Claude/server/routes/games.js` lines 141–157
**Apply to:** No change needed — `games.js` handles this for all game types. The new KDA engine just receives `(state, player_id, value)` after the DB insert.
```javascript
// INSERT before applyThrow — crash-safe
db.prepare('INSERT INTO throws ...').run(...);
// Only then:
const newState = gameModule.applyThrow(state, player_id, value, meta);
```

### XSS guard — textContent only
**Source:** `Claude/public/tv.js` line 52, `index.html` throughout
**Apply to:** Every player name, score, and label rendered in `renderKDABracket` (both `index.html` and `tv.js`)
```javascript
// CORRECT
el.textContent = player.emoji + ' ' + player.name;

// FORBIDDEN — never use with DB data
el.innerHTML = player.emoji + ' ' + player.name;
```

### Socket.io throw:applied event
**Source:** `Claude/server/routes/games.js` lines 168–171
**Apply to:** No change needed — already emits full state after every throw
```javascript
io.to(`game:${gameId}`).emit('throw:applied', { state: newState, finished });
```
TV re-renders via the existing `socket.on('throw:applied', ({ state }) => renderGame(state))` at `tv.js` line 20.

### reconstructState replay
**Source:** `Claude/server/routes/games.js` lines 232–251
**Apply to:** `kegler-des-abends.js` — `applyThrow` must be deterministic; `initState` must preserve `_seed`
```javascript
// reconstructState replays throws in ORDER BY id ASC
let state = gameModule.initState(players);  // no config.seed — uses stored _seed? 
// PITFALL: reconstructState calls initState with no config arg (line 245)
// The _seed is stored in state itself; initState without seed falls back to random shuffle
// FIX: reconstructState must pass the seed from the stored state — this is a known gap
// NEW KDA ENGINE: must tolerate initState called without seed (use null/random) and
// still reconstruct correctly because seed is embedded in state._seed for reference,
// but the actual bracket structure is deterministic from initState(players, {seed})
```
**Important note:** `reconstructState` at line 245 calls `gameModule.initState(players)` with **no config**. This means crash recovery relies on `initState` producing the same bracket from the same `players` array order (which comes from `ORDER BY gp.seat`). The `seat` column captures original insertion order. For deterministic replay, the bracket structure must be regenerated from `(players_in_seat_order, seed=null)` — this means for crash recovery without seed, the bracket will differ from the original seeded one. The safest fix: store `_seed` in state and have `reconstructState` pass it back, OR accept that `reconstructState` without config only works if the bracket is purely positional (p1=players[0], p2=players[1], etc. by seat). Verify this gap before shipping.

### Sequential throw submission (Grand Final)
**Source:** `Claude/public/index.html` lines 797–800 pattern — `await submitThrow`, then process response before next call
**Apply to:** GF modal throw submission (4 API calls: p1-throw1, p1-throw2, p2-throw1, p2-throw2)
```javascript
// Sequential — each awaited before next (RESEARCH.md Pitfall 2)
var d1 = await submitThrow(p1.id, 0, val_p1_1);
if (!d1) return;
S.aktSpiel.state = d1.state; renderSpielenTab();

var d2 = await submitThrow(p1.id, 1, val_p1_2);
if (!d2) return;
S.aktSpiel.state = d2.state; renderSpielenTab();
// ... etc for p2
```

---

## No Analog Found

All four files have suitable analogs. No files lack a codebase pattern to copy from.

| File | Role | Data Flow | Notes |
|---|---|---|---|
| (none) | — | — | All files have close analogs in the codebase |

The DE bracket slot generation algorithm itself (the `buildBracket8`/`buildBracket16` routing tables) has no direct analog — the old KDA engine used dynamic round-by-round pairing. Use RESEARCH.md Code Examples section (8-player canonical routing) and the standard DE tournament structure for the routing tables.

---

## Metadata

**Analog search scope:** `Claude/server/game-types/`, `Claude/server/routes/`, `Claude/public/`
**Files scanned:** 12 (all game-type modules, test files, routes/games.js, tv.js, index.html)
**Pattern extraction date:** 2026-05-23
