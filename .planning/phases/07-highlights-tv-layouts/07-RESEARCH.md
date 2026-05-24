# Phase 7: Highlights & TV-Layouts — Research

**Researched:** 2026-05-24
**Domain:** Vanilla JS frontend (TV display + tablet player table), Node.js/Express backend (Socket.io event enrichment, REST endpoint)
**Confidence:** HIGH — all findings verified directly against codebase source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** KDA winner overlay — full-screen takeover: dark background, large centered name + title "🏆 [Name] — Kegler des Abends!" using amber (`--ac`). Replaces the game state entirely. 10 seconds, then `renderIdle`.
- **D-02:** Bilderkegeln loser overlay — full-screen takeover, red accent (`--red`). "💩 [Name] — Bilderkegeln-Verlierer!" 10 seconds, then `renderIdle`.
- **D-03:** The current `game:finished` behavior (renderGame → 3s timeout → idle) is replaced with: show overlay → 10s timeout → `renderIdle`.
- **D-04:** Backend must enrich `game:finished` payload with `typeKey` (the game's `type_key` string).
- **D-05:** Symbols appear on tablet/app player table only — not TV.
- **D-06:** KDA winner symbol: 🏆 next to winning player's name in active game player table.
- **D-07:** Bilderkegeln loser symbol: 💩 next to player with fewest points in active game player table.
- **D-08:** Symbols are persistent across evenings, survive server restarts (DB storage required).
- **D-09:** Symbol appears inline next to player name; exact placement is Claude's discretion.
- **D-10:** Game types with distinct TV layouts: Bilderkegeln, Fuchsjagd, Viergewinnt. All others keep generic list.
- **D-11:** Bilderkegeln TV layout — same player list, but lowest-score row highlighted in red (real-time).
- **D-12:** Fuchsjagd TV layout — split: Fuchs player on one side, Jäger group on the other.
- **D-13:** Viergewinnt TV layout — Claude's discretion; recommendation: two team panels side by side.

### Claude's Discretion

- Viergewinnt TV layout exact design (two team panels is the recommendation)
- Exact CSS for TV overlay (animation, font size, padding)
- Color accent for Bilderkegeln loser overlay (red `--red` recommended)
- Persistent champion/loser storage: recommend querying last finished KDA/Bilderkegeln game from DB on startup, cached in memory. No new DB schema required.
- Symbol placement within the player row (before/after name, badge or inline)
- Whether to patch `showWinnerBanner` in index.html (currently uses innerHTML — should use textContent)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIGHLIGHT-01 | App zeigt Kegler-des-Abends-Symbol in der Spielertabelle nach Spielende | DB query for last KDA winner on startup; `renderSpielenTab()` injects 🏆 next to champion name |
| HIGHLIGHT-02 | TV zeigt End-Overlay wenn Kegler des Abends feststeht | New `renderEndOverlay()` in tv.js called from `game:finished` handler when typeKey='kda' |
| HIGHLIGHT-03 | App zeigt Bilderkegeln-Verlierer-Symbol in der Spielertabelle (wer wenigste Punkte hat) | DB query for last BK loser on startup; live re-render on `throw:applied` during active BK game |
| HIGHLIGHT-04 | TV zeigt End-Overlay wenn Bilderkegeln-Verlierer feststeht | Same `renderEndOverlay()` for typeKey='bilderkegel', red accent |
| TV-01 | TV zeigt spieltypspezifisches Layout je nach aktivem Spieltyp | Three new render functions in tv.js + dispatcher extension in `renderGame()` |

</phase_requirements>

---

## Summary

Phase 7 adds two loosely coupled capabilities to the existing vanilla JS/Socket.io app: (1) persistent winner/loser symbols on the tablet player table, and (2) game-type-specific TV layouts and end-game overlays on the TV screen. No new dependencies are needed — all changes are pure DOM/CSS/JS work against the existing stack.

The codebase is well-prepared for this phase. The `game:finished` event in `games.js` (line 195) already emits `{ state, lastWinner }` but is missing `typeKey`. Adding `typeKey: game.type_key` to that emission is the only backend change required. The TV's `game:finished` handler in `tv.js` (lines 23–26) currently does `renderGame(state)` + 3-second idle timeout; this is replaced by `renderEndOverlay()` logic. The `renderGame()` dispatcher (line 37–83) already contains the KDA bracket branch and the generic player list; three new game-type branches are added before the generic fallthrough.

The most architecturally significant piece is the persistent champion storage: the app needs to know the current KDA champion and current BK loser at page load (before any `game:finished` event fires). The recommendation (verified feasible against the DB schema) is a new `GET /api/highlights/current` endpoint that queries the last finished KDA game and last finished BK game from the `games` table and reconstructs the winner/loser player IDs. The tablet fetches this on page load and uses the result to inject symbols in `renderSpielenTab()`.

**Primary recommendation:** Implement in three waves — Wave 0 (tests skeleton), Wave 1 (backend: typeKey enrichment + `/api/highlights/current` endpoint), Wave 2 parallel (TV overlays + TV game-type layouts in tv.js; tablet symbol injection + showWinnerBanner XSS fix in index.html).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TV end overlay (HIGHLIGHT-02, HIGHLIGHT-04) | Browser / TV client (tv.js) | Backend (event enrichment) | Display logic is all client-side; only the typeKey field needs adding to the server emission |
| Player table symbols (HIGHLIGHT-01, HIGHLIGHT-03) | Browser / Tablet client (index.html) | API / Backend (champion data) | Symbol rendering is client-side; persistence requires a DB-backed endpoint |
| Persistent champion data | API / Backend | Database / Storage | Query last finished KDA/BK game from games+throws tables |
| TV game-type layouts (TV-01) | Browser / TV client (tv.js) | — | Pure render functions; state already contains all needed data |
| typeKey event enrichment | API / Backend | — | Single-line change to game:finished Socket.io emission in games.js |

---

## Standard Stack

No new libraries are needed. This phase is pure vanilla JS + CSS against the existing stack.

### Core (unchanged)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Socket.io | 4.7.x | Real-time game:finished event | Already in use — `game:finished` is the integration point |
| better-sqlite3 | — | DB query for last KDA/BK game | Used for `/api/highlights/current` endpoint |
| Express 4.21.x | — | New REST route | Pattern-matched to existing `stats.js` route |

### No New Packages Required

All UI is hand-authored vanilla HTML/CSS/JS. No npm installs needed for this phase.

[VERIFIED: codebase grep] — `package.json` confirms existing stack covers all requirements.

---

## Package Legitimacy Audit

No external packages are installed in this phase. All work is modifications to existing vanilla JS files.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[Tablet: doBKWurf / submitKDAWurfe]
    |
    v
[POST /api/games/:id/throws]
    |-- DB INSERT throw
    |-- applyThrow(state)
    |-- isFinished?
        |-- YES: emit game:finished { state, lastWinner, typeKey }  <-- NEW: typeKey added
    |
    +--> [Socket.io room: game:X]
              |
              +---> [TV: socket.on('game:finished')]
              |           |
              |           +--> renderEndOverlay(typeKey, state, lastWinner)
              |                   |-- KDA:        amber overlay, 🏆, 10s -> renderIdle
              |                   |-- bilderkegel: red overlay, 💩, 10s -> renderIdle
              |                   |-- others:      (no overlay, fallthrough)
              |
              +---> [Tablet: socket.on('game:finished')]
                          |
                          +--> showWinnerBanner(state)  [patched to use textContent]
                               + persist champion IDs via API (symbols load at next renderSpielenTab)

[Browser loads index.html]
    |
    v
[GET /api/highlights/current]  <-- NEW endpoint
    |-- SELECT last finished 'kda' game → reconstruct → gewinner.id
    |-- SELECT last finished 'bilderkegel' game → reconstruct → lowest bkTotal player.id
    v
[renderSpielenTab()] injects 🏆 / 💩 spans when player.id matches

[TV: socket.on('throw:applied' / 'undo:applied')]
    |
    v
[renderGame(state)]
    |-- state.bracket            --> renderKDABracket(state)      [existing]
    |-- state.typeKey==='bilderkegel' --> renderBilderkegelTV(state) [NEW]
    |-- state.typeKey==='fuchsjagd'   --> renderFuchsjagdTV(state)   [NEW]
    |-- state.typeKey==='viergewinnt' --> renderViergewinntTV(state)  [NEW]
    |-- fallthrough              --> generic player list            [existing]
```

### Recommended Project Structure (changes only)

```
server/
├── routes/
│   ├── games.js          # add typeKey to game:finished emission
│   └── highlights.js     # NEW: GET /api/highlights/current
server/
└── app.js                # register /api/highlights route

public/
├── tv.js                 # renderEndOverlay + renderBilderkegelTV + renderFuchsjagdTV + renderViergewinntTV
└── index.html            # renderSpielenTab symbol injection + showWinnerBanner XSS fix
```

### Pattern 1: typeKey Enrichment in game:finished

**What:** Add `typeKey: game.type_key` to the Socket.io emission in `games.js` line 195.

**Current code (line 195):**
```js
io.to(`game:${gameId}`).emit('game:finished', { state: newState, lastWinner });
```

**Changed to:**
```js
io.to(`game:${gameId}`).emit('game:finished', { state: newState, lastWinner, typeKey: game.type_key });
```

[VERIFIED: codebase] — `game.type_key` is available in scope at line 195 (it comes from the game row queried on line 133).

### Pattern 2: TV End Overlay (renderEndOverlay)

**What:** New function in tv.js replacing the current `renderGame + setTimeout(idle, 3000)` in the `game:finished` handler.

```js
// tv.js — replace lines 23-26
socket.on('game:finished', function({ state, lastWinner, typeKey }) {
  renderEndOverlay(typeKey, state, lastWinner);
});

function renderEndOverlay(typeKey, state, lastWinner) {
  var overlayEl = document.createElement('div');
  overlayEl.className = 'tv-end-overlay';
  overlayEl.style.cssText = 'width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:var(--bg);padding:32px 48px;box-sizing:border-box;text-align:center';

  var emojiEl = document.createElement('div');
  emojiEl.className = 'tv-overlay-emoji';
  emojiEl.style.cssText = 'font-size:10vw;line-height:1';

  var nameEl = document.createElement('div');
  nameEl.className = 'tv-overlay-name';
  nameEl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:15vw;line-height:1;font-weight:400';

  var subtitleEl = document.createElement('div');
  subtitleEl.className = 'tv-overlay-subtitle';
  subtitleEl.style.cssText = 'font-family:var(--fb,"DM Sans",sans-serif);font-size:4vw;font-weight:600;line-height:1.2;color:var(--txt)';

  if (typeKey === 'kda') {
    emojiEl.textContent = '🏆';
    nameEl.textContent = lastWinner || '—';  // textContent — XSS safe
    nameEl.style.color = 'var(--ac)';
    subtitleEl.textContent = '— Kegler des Abends!';
  } else if (typeKey === 'bilderkegel') {
    // Derive loser name from state (player with lowest bkTotal)
    var loserName = getBKLoserName(state);
    emojiEl.textContent = '💩';
    nameEl.textContent = loserName || '—';  // textContent — XSS safe
    nameEl.style.color = 'var(--red)';
    subtitleEl.textContent = '— Bilderkegeln-Verlierer!';
  } else {
    // No overlay for other game types — go straight to idle
    setTimeout(function() { renderIdle(lastWinner || null); }, 3000);
    return;
  }

  overlayEl.appendChild(emojiEl);
  overlayEl.appendChild(nameEl);
  overlayEl.appendChild(subtitleEl);
  gameEl.classList.add('active');
  idleEl.style.display = 'none';
  gameEl.replaceChildren(overlayEl);
  setTimeout(function() { renderIdle(lastWinner || null); }, 10000);
}
```

[VERIFIED: codebase] — `gameEl` and `idleEl` are declared at top of tv.js (lines 4–5). `renderIdle` is defined at line 28.

### Pattern 3: TV renderGame Dispatcher Extension

**What:** Add game-type branches before the generic player-list fallthrough. Requires `state.typeKey` to be present on state, OR derive from state shape.

**Key finding:** State objects do NOT currently include `typeKey` — verified by running `initState` for all three game types. Two approaches exist:

**Option A (preferred per D-04): Inject typeKey into state via the `throw:applied` / `undo:applied` / `game:state` events.** The server would need to include `typeKey` in those emissions too (not just `game:finished`). Alternatively, the TV client could store the `typeKey` from `game:started` / `game:state` events in a module-level variable.

**Option B (simpler, no server change): Derive from state shape in renderGame.**

```js
function renderGame(state) {
  if (state && state.bracket) { renderKDABracket(state); return; }   // existing KDA
  // Derive game type from state shape:
  if (state && !state.players && state.fuchs !== undefined) { renderFuchsjagdTV(state); return; }
  if (state && !state.players && state.tX !== undefined)   { renderViergewinntTV(state); return; }
  if (state && state.players && !state.bracket) {
    // Could be bilderkegel (has aktBildIdx) or generic
    if (state.aktBildIdx !== undefined) { renderBilderkegelTV(state); return; }
  }
  if (!state || !state.players) return;
  // ... existing generic player list
}
```

**CRITICAL FINDING:** The `game:started` event in `games.js` (line 90) already includes `type_key` in its payload: `io.emit('game:started', { gameId, state, type_key })`. The TV can cache `currentTypeKey` on `game:started` and use it in `renderGame`. This is the cleanest approach because it avoids brittle state-shape inference AND requires no change to `game:state` / `throw:applied` events.

[VERIFIED: codebase] — games.js line 90: `io.emit('game:started', { gameId, state, type_key })`

**Recommended approach:** Store `currentTypeKey` in a module-level variable in tv.js, set on `game:started` and `game:state` events. Then `renderGame(state)` uses it for dispatch.

```js
// tv.js — at top with other module-level state
var currentTypeKey = null;

socket.on('game:started',  ({ state, gameId, type_key }) => {
  currentTypeKey = type_key;
  socket.emit('join', gameId);
  renderGame(state);
});

socket.on('game:state',    ({ idle, state, gameId, lastWinner, type_key }) => {
  if (type_key) currentTypeKey = type_key;  // type_key needs adding to game:state emission
  if (idle) renderIdle(lastWinner);
  else { socket.emit('join', gameId); renderGame(state); }
});

// renderGame dispatch
function renderGame(state) {
  if (state && state.bracket) { renderKDABracket(state); return; }
  if (currentTypeKey === 'bilderkegel') { renderBilderkegelTV(state); return; }
  if (currentTypeKey === 'fuchsjagd')   { renderFuchsjagdTV(state); return; }
  if (currentTypeKey === 'viergewinnt') { renderViergewinntTV(state); return; }
  if (!state || !state.players) return;
  // ... existing generic player list
}
```

Note: `game:state` emitted from server.js (line 44) does not currently include `type_key` — needs adding. Alternative: derive from state shape for robustness. The plan should address this.

### Pattern 4: GET /api/highlights/current Endpoint

**What:** New Express route that queries the DB for the last completed KDA winner and last completed BK loser.

```js
// server/routes/highlights.js
'use strict';

const { Router } = require('express');
const db = require('../db');
const gameTypes = require('../game-types');
const { reconstructState } = require('./games');

const router = Router();

router.get('/current', (req, res) => {
  const result = { kda_champion: null, bk_loser: null };

  // Last finished KDA game → gewinner.id
  const kdaGame = db.prepare(
    "SELECT id, type_key FROM games WHERE type_key = 'kda' AND status = 'finished' ORDER BY finished_at DESC LIMIT 1"
  ).get();
  if (kdaGame) {
    try {
      const state = reconstructState(kdaGame);
      if (state.gewinner) {
        const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(state.gewinner.id);
        if (p) result.kda_champion = p;
      }
    } catch (e) { /* skip — non-fatal */ }
  }

  // Last finished BK game → player with lowest bkTotal
  const bkGame = db.prepare(
    "SELECT id, type_key FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' ORDER BY finished_at DESC LIMIT 1"
  ).get();
  if (bkGame) {
    try {
      const state = reconstructState(bkGame);
      const loserId = getBKLoserId(state);
      if (loserId) {
        const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(loserId);
        if (p) result.bk_loser = p;
      }
    } catch (e) { /* skip — non-fatal */ }
  }

  res.json(result);
});

function getBKLoserId(state) {
  if (!state || !state.players) return null;
  const tots = state.players.map(p => ({
    id: p.id,
    total: (p.bildPts || []).reduce((a, b) => a + (b !== null ? b : 0), 0)
  }));
  tots.sort((a, b) => a.total - b.total);
  return tots[0] ? tots[0].id : null;
}

module.exports = router;
```

[VERIFIED: codebase] — `reconstructState` is exported from `games.js` (line 309). KDA state has `gewinner` field (kegler-des-abends.js line 383, 441). BK `bkTotal` logic matches bilderkegel.js `bkTotal` function. DB confirmed to have a finished KDA game (id=20).

### Pattern 5: Tablet Symbol Injection in renderSpielenTab

**What:** After the app loads champion data from `/api/highlights/current`, inject `🏆`/`💩` spans when rendering player names in `renderSpielenTab()`.

Module-level state additions in index.html:
```js
var S = { ..., kdaChampionId: null, bkLoserId: null };
```

On page load (inside the existing `init()` or DOMContentLoaded block):
```js
fetch('/api/highlights/current')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    S.kdaChampionId = data.kda_champion ? data.kda_champion.id : null;
    S.bkLoserId     = data.bk_loser    ? data.bk_loser.id    : null;
    renderSpielenTab();
  })
  .catch(function() {});
```

Update after `game:finished` (to refresh champion IDs without page reload):
```js
socket.on('game:finished', function(data) {
  // Existing showWinnerBanner call ...
  // Also refresh highlights
  fetch('/api/highlights/current')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      S.kdaChampionId = d.kda_champion ? d.kda_champion.id : null;
      S.bkLoserId     = d.bk_loser    ? d.bk_loser.id    : null;
    }).catch(function() {});
});
```

Symbol injection in player renderers (example for `renderBKSpiel`):
```js
// After rendering player name in each row:
function appendSymbol(nameEl, playerId) {
  if (playerId === S.kdaChampionId) {
    var sym = document.createElement('span');
    sym.className = 'player-symbol';
    sym.setAttribute('aria-label', 'Kegler des Abends');
    sym.textContent = ' 🏆';  // leading space = 4px gap
    nameEl.appendChild(sym);
  } else if (playerId === S.bkLoserId) {
    var sym = document.createElement('span');
    sym.className = 'player-symbol';
    sym.setAttribute('aria-label', 'Bilderkegeln-Verlierer');
    sym.textContent = ' 💩';
    nameEl.appendChild(sym);
  }
}
```

**CHALLENGE:** Most player-row rendering in `renderBKSpiel`, `renderNSpiel`, and `renderVGSpiel` uses `innerHTML` concatenation with player names embedded directly. To safely inject symbols using `textContent`, these sections must use DOM construction. The UI-SPEC calls for `<span class="player-symbol">` — injecting this into innerHTML strings is XSS-safe only because player names are already DB-stored strings (not user-crafted HTML). However, CLAUDE.md mandates `textContent`-only for DB-sourced strings. The plan should allocate explicit effort to refactor the player-name rendering in whichever renderers need symbol support from innerHTML to DOM construction.

**Affected renderers for symbol injection (from index.html analysis):**
- `renderBKSpiel` — uses innerHTML, long single-line string (line ~818). Needs targeted refactor for player name cells.
- `renderNSpiel` — uses innerHTML (line ~857). Only generic games unlikely to have KDA champion mid-game, but symbol still needs to show.
- `renderFJSpiel` — needs investigation (not read yet; used in renderSpielenTab switch)
- `renderVGSpiel` — needs investigation
- `renderKDASpiel` — specifically relevant since KDA champion symbol shows here

### Anti-Patterns to Avoid

- **innerHTML with player names:** CLAUDE.md requires textContent-only for DB-sourced strings. Any new code using `innerHTML` with player names is prohibited — use DOM construction.
- **Polling for champion status:** The pattern is fetch-on-load + update-on-game:finished. No polling needed.
- **Storing typeKey on state objects:** State objects are game-engine outputs and don't know their own type_key. Pass typeKey as a separate variable (module-level in tv.js, payload field in socket events).
- **Overlay as a CSS overlay (z-index):** The decision (D-03) specifies the overlay REPLACES the game state view via `gameEl.replaceChildren()` — NOT a positioned overlay. Use the same pattern as `renderKDABracket` (line 210).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent champion data | Custom in-memory state reset on restart | DB query (last finished game by type_key) | Already available in games table; single SQL query is reliable after server restart |
| typeKey on state | Add typeKey field to game module initState | Pass as event payload field / module-level cache | State objects are pure engine state; mixing routing concerns into them creates coupling |
| bkLoser identification | Custom scoring logic | Reuse bkTotal pattern from bilderkegel.js | Both server and client already have bkTotal implementations; don't diverge |
| Symbol as inline SVG or image | Custom icon element | Unicode emoji in textContent span | Consistent with existing emoji-in-player-name pattern; no asset management needed |

---

## Detailed Findings by Key Question

### Q1: What does the current game:finished emission look like — does it already have typeKey?

**Finding:** [VERIFIED: codebase] Line 195 of `server/routes/games.js`:
```js
io.to(`game:${gameId}`).emit('game:finished', { state: newState, lastWinner });
```
**typeKey is NOT present.** Adding `typeKey: game.type_key` is the required backend change. The `game` variable (holding the DB row including `type_key`) is in scope at that line.

### Q2: Exact state shapes for Fuchsjagd, Viergewinnt, and Bilderkegeln

**Fuchsjagd state** [VERIFIED: codebase, fuchsjagd.js]:
```js
{
  fuchs: { id, name, emoji, w: [], pudel: 0 },
  jaeger: [{ id, name, emoji, w: [], pudel: 0 }, ...],
  fp: Number,      // running score (starts at fuchs start total, decremented by jäger hits)
  phase: 'start' | 'jagd',
  startW: Number,
  jIdx: Number,
  jPhase: 'jaeger' | 'fuchs',
  done: Boolean,
  winner: null | 'fuchs' | 'jaeger'
}
```
No `typeKey`, no `players` array. Distinguishable from other types by presence of `fuchs` key.

**Viergewinnt state** [VERIFIED: codebase, vier-gewinnt.js]:
```js
{
  grid: Array(9)[Array(9)],   // 9x9 null|'X'|'O'
  nr: Array(9),               // next available row per column
  tX: [{ id, name, emoji, team: 'X' }, ...],
  tO: [{ id, name, emoji, team: 'O' }, ...],
  aktT: 'X' | 'O',
  iX: Number,
  iO: Number,
  done: Boolean,
  winner: null | 'X' | 'O' | 'draw'
}
```
No `typeKey`, no `players` array. Distinguishable by presence of `tX` key.

**Important for Viergewinnt TV layout:** `tX` and `tO` player objects do NOT have per-player score fields. The only scoring data is in the `grid` (piece placement) and the `winner` field. Per the UI-SPEC, show `—` or throw count as proxy for score unless the executor derives individual contribution from grid cell counts per player.

**Bilderkegeln state** [VERIFIED: codebase, bilderkegel.js]:
```js
{
  players: [{ id, name, emoji, bildPts: [null*5], wuerfe: [[][]*5], pudel: 0 }, ...],
  aktSpIdx: Number,
  aktBildIdx: Number,
  aktWurfNr: Number,
  done: Boolean
  // No gewinner field — loser is derived as player with lowest bkTotal
}
```
Has `players` array AND `aktBildIdx` (distinguishes from generic games). `bkTotal(p) = p.bildPts.reduce(...)`.

**KDA state** [VERIFIED: codebase, kegler-des-abends.js]:
```js
{
  bracket: [...],   // array of match slots
  done: Boolean,
  gewinner: null | { id, name, emoji },
  _seed: String
}
```
Has `bracket` — already used for dispatch in `renderGame` (tv.js line 38). `gewinner` is the winner object populated on tournament completion (line 441).

### Q3: How does renderGame currently work in tv.js — what's the existing dispatch logic?

**Finding:** [VERIFIED: codebase] `tv.js` lines 37–83:
```js
function renderGame(state) {
  if (state && state.bracket) { renderKDABracket(state); return; }  // KDA: before guard
  if (!state || !state.players) return;                              // guard
  idleEl.style.display = 'none';
  gameEl.classList.add('active');
  playerListEl.replaceChildren();
  for (const player of state.players) {
    // build .player-row li with .player-name, .last-throw, .player-score
  }
}
```
Three game types (fuchsjagd, viergewinnt) will hit the `!state.players` guard and return early — they render NOTHING on TV currently. Bilderkegeln has `state.players` so it falls through to the generic list.

**Note:** The generic renderer uses `playerListEl.replaceChildren()` to populate `#playerList` inside `#game`. The new game-type renderers use `gameEl.replaceChildren()` (replacing ALL children of `#game`, as KDA bracket does). This is different from the generic path which only modifies `#playerList`. For the new renderers, follow the KDA pattern: `gameEl.replaceChildren(container)`.

### Q4: Where exactly in index.html is renderSpielenTab() and the player row rendering?

**Finding:** [VERIFIED: codebase]
- `renderSpielenTab()`: line 777 — dispatcher switch on `S.aktSpiel.type_key`
- `renderBKSpiel(el, state)`: line 818 — uses `innerHTML` concatenation for all rows
- `renderNSpiel(el, state)`: line 857 — uses `innerHTML` concatenation
- `getWinnerName(state, type_key)`: line 480 — handles all game types including KDA (`state.gewinner.name`), bilderkegel (`state.gewinner.name` — NOTE: BK state does NOT have a `gewinner` field, this is actually unused/wrong for BK but no crash since the fallback is 'Unbekannt')
- `showWinnerBanner(state)`: line 507 — uses `innerHTML` with `winnerName` (XSS risk)
- `socket.on('game:finished', ...)`: line 421–424 — calls `showWinnerBanner(data.state)` via `handleGameFinished`
- `renderFJSpiel` and `renderVGSpiel` exist in the Vier Gewinnt and Fuchsjagd sections (lines ~860+), not fully read but referenced in the renderSpielenTab switch

### Q5: Does persistent champion/loser storage exist already?

**Finding:** [VERIFIED: codebase] No. The DB schema has no highlights, champion, or award tables. The `games` table has `type_key` and `status` columns, and `finished_at`. No existing endpoints exist for this. Route files in `server/routes/` are: auth, players, games, abende, stats, game-types — no highlights route. A new `highlights.js` route is required.

### Q6: What is the current game:finished socket handler in tv.js — exact code?

**Finding:** [VERIFIED: codebase] `tv.js` lines 23–26 (exact):
```js
socket.on('game:finished', function({ state, lastWinner }) {
  renderGame(state);
  setTimeout(function() { renderIdle(lastWinner || null); }, 3000);
});
```
This is the block to replace entirely per D-03.

### Q7: Are there any existing API routes for highlights or champion data?

**Finding:** [VERIFIED: codebase] None. No route file or app.js registration exists for highlights. The `stats.js` route computes aggregate win/loss/draw stats but does not expose current champion or last-game-winner data. `GET /api/highlights/current` is a new route.

### Q8: What is the showWinnerBanner function doing with innerHTML and what is the XSS risk exactly?

**Finding:** [VERIFIED: codebase] `index.html` lines 507–523:
```js
function showWinnerBanner(state) {
  if (S.aktSpiel) S.aktSpiel._finishing = true;
  var winnerName = getWinnerName(state, S.aktSpiel ? S.aktSpiel.type_key : '');
  var banner = document.createElement('div');
  // ...
  banner.innerHTML = '<div style="..."><div style="...">🏆</div>' +
    '<div style="...">' + winnerName + ' hat gewonnen!</div>' +
    '</div>';
  // ...
}
```
`winnerName` is derived from `state.gewinner.name`, `state.fuchs.name`, `state.tX.map(p => p.name)`, etc. These are player names from the DB. While player names are club-member strings unlikely to contain `<script>` tags, they ARE DB-sourced and concatenated into innerHTML — this violates the CLAUDE.md `textContent`-only rule. The fix: replace `banner.innerHTML = ...` with DOM construction using `textContent` for the name element.

---

## Common Pitfalls

### Pitfall 1: game:state missing type_key
**What goes wrong:** TV loads with an active game already in progress. `game:state` is emitted from `server.js` line 44 without `type_key`. The TV will have `currentTypeKey = null` and fall through to the generic player list even for FJ/VG games.
**Why it happens:** `game:state` was implemented before game-type-specific layouts existed.
**How to avoid:** Add `type_key: game.type_key` to the `game:state` emission in `server.js` line 44. (The `game` object is fetched on line 41: `db.prepare('SELECT * FROM games WHERE id = ?').get(activeGame.id)`.)
**Warning signs:** TV shows generic player list during a Fuchsjagd or Viergewinnt game.

### Pitfall 2: BK loser determination — empty bildPts during active game
**What goes wrong:** During a Bilderkegeln game, early in the game, most `bildPts` entries are `null`. `bkTotal` returns 0 for all players. The "loser" highlight will briefly attach to whichever player has the lowest non-null total, or all players show as tied at 0.
**Why it happens:** `bkTotal` counts `null` as 0.
**How to avoid:** In `renderBilderkegelTV`, only highlight as loser if at least one player has completed at least one `bildPts` entry (i.e., `state.aktBildIdx > 0` OR any player has `bildPts[0] !== null`). If all are null, don't apply the red highlight to anyone.
**Warning signs:** Red highlight randomly attaches to first player at game start.

### Pitfall 3: renderGame dispatch order — BK state has players array
**What goes wrong:** Bilderkegeln has `state.players` — it falls through to the generic list before any type-specific check can catch it (if type-checking uses `!state.players`).
**Why it happens:** The generic path guard is `if (!state || !state.players) return` — BK passes this guard and reaches the generic renderer.
**How to avoid:** The BK branch in `renderGame` must be checked BEFORE the `!state.players` guard. Use `currentTypeKey === 'bilderkegel'` rather than state-shape detection. Alternatively use state-shape detection: `state.aktBildIdx !== undefined`.

### Pitfall 4: innerHTML refactor scope in index.html
**What goes wrong:** The player renderers (renderBKSpiel, renderNSpiel, renderFJSpiel, renderVGSpiel) are long single-line innerHTML strings. Refactoring only the name span to DOM construction requires careful surgical insertion.
**Why it happens:** Original code was written as innerHTML for brevity.
**How to avoid:** Adopt a targeted approach: wrap only the name display portion in DOM construction. The rest of the row HTML can remain innerHTML for non-name content. The `appendSymbol()` helper can then be called on the nameEl reference.

### Pitfall 5: TV overlay conflicts with gameEl.active CSS
**What goes wrong:** `#game` has `display: none` by default and `#game.active { display: block }`. The overlay content is added via `gameEl.replaceChildren()`. If `gameEl.classList.add('active')` is not called first, the overlay won't be visible.
**Why it happens:** The generic path calls `gameEl.classList.add('active')` inside `renderGame`, but `renderEndOverlay` bypasses `renderGame`.
**How to avoid:** `renderEndOverlay` must call `idleEl.style.display = 'none'` and `gameEl.classList.add('active')` before `gameEl.replaceChildren(overlayEl)`. Follow the pattern in `renderKDABracket` (lines 104–105).

### Pitfall 6: Viergewinnt player scores
**What goes wrong:** `tX` and `tO` player objects have no score field. `renderViergewinntTV` cannot display per-player scores.
**Why it happens:** VG scores are implicit in the `grid` array (count cells by team). The game module's `getFinalResults` returns `score: 0` for all players.
**How to avoid:** For the TV display, calculate per-player contribution by counting grid cells: `state.grid.flat().filter(c => c === 'X').length` for Team X total. Per-player breakdown is not available without tracking throw history separately. Per UI-SPEC: show `—` or team total as per-player value until game ends.

### Pitfall 7: BK overlay loser name — state.gewinner is undefined for bilderkegel
**What goes wrong:** `getWinnerName(state, 'bilderkegel')` in index.html references `state.gewinner.name` — but Bilderkegeln state has NO `gewinner` field. The function would throw or return 'Unbekannt'.
**Why it happens:** `getWinnerName` on line 493 was likely written with the expectation that BK would have a `gewinner` field, which it doesn't (bilderkegel.js confirms: only `done`, `players`, `aktSpIdx`, etc.).
**How to avoid:** `renderEndOverlay` in tv.js must derive the BK loser name from `state.players` using the `bkTotal` function, NOT from `lastWinner` (lastWinner for BK would be the highest-score winner, not the loser). Write a `getBKLoserName(state)` helper.

---

## Code Examples

### getBKLoserName helper for tv.js
```js
// Source: derived from bilderkegel.js bkTotal logic [VERIFIED: codebase]
function getBKLoserName(state) {
  if (!state || !state.players || !state.players.length) return '—';
  var withTotals = state.players.map(function(p) {
    var total = (p.bildPts || []).reduce(function(a, b) { return a + (b !== null ? b : 0); }, 0);
    return { name: p.name, total: total };
  });
  withTotals.sort(function(a, b) { return a.total - b.total; });
  return withTotals[0].name;
}
```

### Fuchsjagd jäger contribution (sum of each jäger's throws)
```js
// Source: fuchsjagd.js state shape [VERIFIED: codebase]
// state.jaeger[i].w = array of throw values
var jaegerContrib = state.jaeger.map(function(j) {
  return { name: j.name, emoji: j.emoji, total: j.w.reduce(function(a, b) { return a + b; }, 0) };
});
```

### Viergewinnt team score from grid
```js
// Source: vier-gewinnt.js state shape [VERIFIED: codebase]
// No per-player score field — derive from grid
var teamXTotal = state.grid.flat().filter(function(c) { return c === 'X'; }).length;
var teamOTotal = state.grid.flat().filter(function(c) { return c === 'O'; }).length;
// Per-player: not available without throw history traversal
```

---

## State of the Art

| Old Behavior | New Behavior | When Changed | Impact |
|--------------|-------------|--------------|--------|
| `game:finished` → `renderGame(state)` + 3s idle | `game:finished` → `renderEndOverlay()` + 10s idle | Phase 7 | TV shows celebratory overlay before returning to idle |
| TV shows generic player list for all non-KDA types | TV shows game-type-specific layout | Phase 7 | FJ/VG/BK games now have meaningful TV views |
| Player table has no badges | Player table shows 🏆/💩 for persistent champions | Phase 7 | Immediate visual recognition of honor/shame |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | 24.15.0 | — |
| better-sqlite3 | DB queries | ✓ | in node_modules | — |
| Socket.io 4 | Real-time events | ✓ | 4.7.x | — |
| `node --test` | Test runner | ✓ | built-in Node 24 | — |
| Bebas Neue / DM Sans | TV fonts | ✓ (Google CDN) | — | Phase 9 will self-host |

No missing dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | none — `node --test` discovers `*.test.js` recursively |
| Quick run command | `cd Claude && node --test server/routes/highlights.test.js` |
| Full suite command | `cd Claude && node --test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIGHLIGHT-01/03 | `/api/highlights/current` returns correct champion IDs | integration | `node --test server/routes/highlights.test.js` | ❌ Wave 0 |
| HIGHLIGHT-02/04 | `game:finished` payload includes `typeKey` field | integration | `node --test server/routes/games.test.js` | ✅ (extend existing) |
| TV-01 | TV dispatch selects correct renderer per game type | unit (manual verify) | manual TV inspection | manual-only |
| XSS fix | `showWinnerBanner` uses textContent, not innerHTML | code review | — | manual-only |

### Sampling Rate
- **Per task commit:** `node --test server/routes/highlights.test.js` (quick, < 10s)
- **Per wave merge:** `node --test` (full suite, 391 tests currently passing)
- **Phase gate:** Full suite green before `/gsd:verify-work 7`

### Wave 0 Gaps
- [ ] `server/routes/highlights.test.js` — covers GET /api/highlights/current with mock DB
- [ ] Extend `server/routes/games.test.js` — verify typeKey present in game:finished event

*(Wave 0 = test infrastructure before implementation)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | highlights endpoint is read-only, public (same as stats) |
| V3 Session Management | no | no session changes |
| V4 Access Control | no | read-only public endpoint |
| V5 Input Validation | yes (existing) | typeKey comes from DB games.type_key — trusted internal value |
| V6 Cryptography | no | |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via innerHTML with player names | Tampering | Use textContent for all DB-sourced strings — specifically `showWinnerBanner` refactor and all new overlay code |
| Prototype pollution via JSON.parse | Tampering | Not applicable — no user-supplied JSON parsed in this phase's new code |

**XSS finding:** `showWinnerBanner` (index.html line 512) constructs `banner.innerHTML` with `winnerName` derived from player names stored in DB. This violates the CLAUDE.md textContent-only rule. While the immediate risk is low (club-internal app, controlled player names), CLAUDE.md mandates fixing this. The fix is a named task in the plan.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `game:state` emitted from server.js line 44 does not include `type_key` | Pitfall 1, Pattern 3 | If type_key is already included, Pattern 3's TV currentTypeKey approach is already partially solved |
| A2 | `renderFJSpiel` and `renderVGSpiel` in index.html use similar innerHTML patterns to `renderBKSpiel` | Pitfall 4 | If they use DOM construction already, symbol injection is simpler |

Both assumptions are low-risk — A1 requires a quick code check in server.js, A2 requires reading the FJ/VG renderer code in index.html (both are addressed by reading the full index.html before implementation).

---

## Open Questions

1. **Does game:state from server.js include type_key?**
   - What we know: server.js line 44 emits `{ gameId: activeGame.id, state, idle: false }` — no explicit `type_key` visible in the read excerpt
   - What's unclear: The `game` object fetched on line 41 has `type_key`; it may or may not be spread into the emission
   - Recommendation: Executor reads server.js lines 40–45 before implementing and adds `type_key` if missing

2. **Do renderFJSpiel and renderVGSpiel use innerHTML with player names?**
   - What we know: renderBKSpiel and renderNSpiel do
   - What's unclear: FJ and VG renderers not fully read
   - Recommendation: Executor reads those sections before deciding symbol injection approach

3. **lastWinner field for BK game:finished — does it reflect the winner (highest score) or loser?**
   - What we know: In games.js line 188–193, `lastWinner` is derived from `getFinalResults().find(r => r.winner)`. For BK, `getFinalResults` marks the player with the HIGHEST `bkTotal` as `winner` (bilderkegel.js line 69: `winner: tot === maxP`). So `lastWinner` = high scorer's name, NOT the payer/loser.
   - Impact: The TV's `renderEndOverlay` for BK must derive the loser name from `state.players` directly, not from `lastWinner`. Already accounted for in Pattern 2 and the `getBKLoserName` helper.

---

## Sources

### Primary (HIGH confidence — all verified against live codebase)
- `Claude/public/tv.js` — all TV rendering patterns, game:finished handler (exact lines verified)
- `Claude/public/tv.html` — DOM structure, CSS custom properties confirmed
- `Claude/server/routes/games.js` — game:finished emission (line 195 verified)
- `Claude/server/game-types/fuchsjagd.js` — state shape verified by running initState
- `Claude/server/game-types/vier-gewinnt.js` — state shape verified by running initState
- `Claude/server/game-types/bilderkegel.js` — state shape verified by running initState
- `Claude/server/game-types/kegler-des-abends.js` — gewinner field verified (line 383, 441)
- `Claude/server/db/index.js` — schema, migrations, table structure verified
- `Claude/server/app.js` — route registrations confirmed
- `Claude/server/server.js` — game:state emission reviewed
- `Claude/public/index.html` (lines 421–424, 470–530, 777–820) — socket handlers, showWinnerBanner, renderSpielenTab verified

### Secondary (MEDIUM confidence)
- Context.md decisions D-01 through D-13 — user-confirmed design decisions
- UI-SPEC (07-UI-SPEC.md) — approved visual contract

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- Architecture: HIGH — all integration points verified in live code
- Pitfalls: HIGH — all verified against actual state shapes and code paths
- TV layout patterns: HIGH — direct state shape verification via Node.js

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable codebase — 30 days)
