# Phase 6: Turnierbaum - Research

**Researched:** 2026-05-23
**Domain:** Double-Elimination bracket engine, bracket UI, Socket.io real-time sync
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Replace `server/game-types/kegler-des-abends.js` with a true DE bracket engine. All match slots (W-R1, W-Semi, W-Final, LB rounds, Grand Final) are generated at tournament start with predetermined routing. The current dynamic round-by-round re-pairing approach is replaced entirely.

**D-02:** Bracket size: next power-of-2. For non-power-of-2 player counts (5, 6, 7, 9–12), the bracket is sized to the next power of 2. Top-seeded players receive byes in Round 1. Standard tournament convention.

**D-03:** No Grand Final bracket reset. The Grand Final is a single match — the winner wins outright regardless of which bracket they came from.

**D-04:** Old KDA games: display-only compatibility. Existing finished KDA games in the DB retain their old state format and are displayed with the old `renderKDASpiel` view (match history list). No migration. New games use the new DE bracket state format.

**D-05:** All matches use pin count to determine the winner — no manual "tap who wins" button. Winner is determined automatically after all throws are recorded.

**D-06:** Throws per match: All rounds (except Grand Final): 1 throw per player. Grand Final: 2 throws per player (higher total wins).

**D-07:** Tie resolution: If both players score equal pins in a match, an extra throw is prompted and repeated until one player scores more. The engine handles this as additional throw rounds within the same match.

**D-08:** The `applyThrow` API maps to: `player_id` = actual player ID, `throw_index` = sequential throw number within the match, `value` = pin count (integer). After all throws for a match are recorded, the engine computes the winner and advances the bracket. The `throw:applied` Socket.io event carries full updated state after each throw.

**D-09:** Visual CSS bracket tree — horizontal tournament bracket layout with W Bracket on top, L Bracket below, Grand Final at the right. Active matches highlighted.

**D-10:** Horizontally scrollable container. Fixed width; user swipes left/right. No zoom, no tab navigation.

**D-11:** Tap active match slot → bottom sheet/modal. Opens with throw entry: pin count input per player, per throw.

**D-12:** Player count validation: minimum 4 players, maximum 12. Current modal allows min 2 — this must be updated.

**D-13:** TV shows the full bracket tree — complete DE bracket, landscape layout, large match slots, large player names, no scrolling needed. Distinct CSS from the tablet's scrollable view.

**D-14:** Live updates on every throw. TV updates immediately to show in-progress result ("Spieler A: 7 pins" in the active match slot). TV does not wait for match completion.

**D-15:** TV bracket receives state via the existing `throw:applied` Socket.io event carrying full updated game state.

### Claude's Discretion

- Exact CSS structure of the bracket tree (flexbox or grid, line drawing technique)
- Seeding order for bye assignment (random shuffle from player list is fine)
- Exact bracket slot naming convention in state (e.g., `{id: 'W-R1-1', round: 1, bracket: 'W', ...}`)
- Tiebreaker UX details (e.g., whether extra throw is shown inline or as a separate step)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOURNAMENT-01 | User kann "Kegler des Abends"-Spieltyp mit Loser Bracket (Double-Elimination, variabel 4–12 Spieler) starten | D-01, D-02, D-12: DE engine + player count validation in start dialog |
| TOURNAMENT-02 | Bracket-Baum (Winner Bracket + Loser Bracket) wird in der App angezeigt und nach jedem Match aktualisiert | D-09, D-10, D-11: CSS bracket tree renderer for tablet, bottom-sheet modal |
| TOURNAMENT-03 | Bracket-Fortschritt wird live auf dem TV angezeigt (Socket.io sync) | D-13, D-14, D-15: TV bracket renderer + existing throw:applied socket event |

</phase_requirements>

---

## Summary

Phase 6 replaces the existing dynamic round-by-round KDA engine with a true Double-Elimination bracket engine where all match slots are predetermined at tournament start. The engine must handle 4–12 players by rounding up to the next power of 2 and auto-filling bye slots. Match results are determined by pin counts (not manual winner selection), with 1 throw per player per round (2 for Grand Final) and tie-break mechanics.

The frontend work is substantial: `renderKDASpiel` in `index.html` becomes a full CSS bracket tree renderer with a bottom-sheet modal for throw entry. The TV view (`tv.js`) needs a new KDA branch in `renderGame`. Old KDA games are distinguished from new ones by state shape (`state.bracket` present = new format) and continue to use the old renderer.

The existing infrastructure — `gameTypes` interface, `applyThrow` API with DB-first throw persistence, `throw:applied` Socket.io event, `reconstructState` function — all remain unchanged. The engine conforms to the same `{ initState, applyThrow, isFinished, getFinalResults }` contract as every other game type.

**Primary recommendation:** Implement the DE engine as a pure function module with a flat `bracket` array of match slots and predetermined `advancesTo` / `loserTo` routing fields. This makes `reconstructState` (throw replay) trivial and `renderKDASpiel` stateless.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DE bracket generation + routing | Backend (game-types module) | — | Pure function, server-authoritative, must survive crash/replay |
| Throw validation + pin scoring | Backend (applyThrow) | — | All game logic lives in server modules; client never computes outcome |
| Tie-break detection + prompting | Backend (applyThrow returns tiebreak state) | Frontend (modal re-render) | Engine sets flag; UI reads flag to show "Stechen" section |
| Bracket tree visual rendering | Frontend (index.html renderKDASpiel) | — | Client-side DOM builder from state object emitted by server |
| TV bracket live display | Frontend (tv.js renderGame) | — | TV is display-only; reads socket events |
| Match entry modal | Frontend (index.html) | — | Input collection only; all computation server-side |
| Player count validation | Frontend (startKDA) + Backend (games.js POST) | — | Frontend: UX guard. Backend: authoritative enforcement |
| Old-game display compatibility | Frontend (format detection switch) | — | No server change; state shape detection in client renderer |

---

## Standard Stack

### Core (No new packages — phase is purely brownfield)

Phase 6 introduces **zero new npm packages**. All capabilities are implemented using existing dependencies.

| Library | Version (locked) | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| Node.js | 22.x LTS | Runtime | Already installed; `node --test` used for tests |
| Express | 5.2.1 | HTTP routing | Already installed; no new routes needed |
| Socket.io | 4.8.3 | WebSocket real-time | Already installed; `throw:applied` event already in place |
| better-sqlite3 | 12.10.0 | DB persistence | Already installed; throws table already supports KDA |

All of the above are confirmed in `Claude/package.json`. [VERIFIED: npm registry]

### No External Bracket Libraries

Existing npm bracket libraries (e.g., `brackets-manager.js`, `@sportsgram/brackets`) are **not used**. The DE bracket algorithm is implemented from scratch in `kegler-des-abends.js`. Reasons:
1. The app's state must be a plain serializable JS object (JSON-round-trippable for SQLite throw replay)
2. External libraries carry their own data models which would break `reconstructState`
3. The bracket structure is small enough (max 12 players → 8-slot bracket, ~23 matches) that a custom implementation is straightforward
4. No transitive dependency risk on a single-VPS app with no package update automation

### Supporting
| Library | Version | Purpose |
|---------|---------|---------|
| `node:test` (built-in) | 22.x | Test runner — already used by all game-type tests |
| `node:assert/strict` (built-in) | 22.x | Test assertions |

**Installation:** No new packages to install.

---

## Package Legitimacy Audit

> No new packages are introduced in this phase. This section is N/A.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Tablet (browser)
  startKDA() — player selection, count validation (4–12)
       |
       v
POST /api/games  ──────────────────────────────────────────────────────>  games.js
                                                                              |
                                                                    kda.initState(players, config)
                                                                              |
                                                                    Returns bracket state object
                                                                    (all match slots pre-generated)
                                                                              |
                                                                    io.emit('game:started', state)
                                                                              |
       <────────────────────────────────────────────────────────── tv.js: renderGame(state)
                                                                   [new KDA branch: renderKDABracket]

Tablet (throw entry)
  Tap active bracket slot
       |
  Bottom-sheet modal opens
  User enters pin count per player
       |
  submitThrow(player_id, throw_index, value)
       |
       v
POST /api/games/:id/throws  ────────────────────────────────────────>  games.js
                                                                              |
                                                                    INSERT throws DB (DB-first)
                                                                              |
                                                                    kda.applyThrow(state, player_id, value)
                                                                    → updates match throws[]
                                                                    → if match complete: computes winner,
                                                                      advances bracket routing
                                                                    → if tiebreak: sets match.tiebreak:true
                                                                              |
                                                                    io.to('game:X').emit('throw:applied', state)
                                                                              |
       [tablet] renderKDASpiel(el, state)    [TV] renderGame(state)
       [bracket tree re-renders]             [renderKDABracket(state)]
```

### Recommended Project Structure

```
server/game-types/
├── kegler-des-abends.js        # REPLACED: new DE bracket engine
├── kegler-des-abends.test.js   # UPDATED: new test suite
public/
├── index.html                  # UPDATED: renderKDASpiel → bracket tree + modal
├── tv.js                       # UPDATED: new KDA branch in renderGame
```

No new files needed. All changes are in-place replacements of existing functions/modules.

---

### Pattern 1: DE Bracket Engine — Flat Slot Array with Predetermined Routing

**What:** The bracket is a flat array of match slot objects generated entirely in `initState`. Each slot has `advancesWinnerTo` and `advancesLoserTo` fields pointing to other slot IDs. `applyThrow` updates the relevant slot's throws array; when all required throws are recorded, the engine resolves winner/loser and populates the appropriate downstream slots.

**When to use:** Any time the full bracket structure must be visible before any matches are played (visual bracket tree requirement).

**Bracket slot structure (suggested by CONTEXT.md Specifics section):**

```javascript
// Source: CONTEXT.md <specifics> section, adapted for pin-count throws
{
  id: 'W-R1-1',           // unique slot identifier
  round: 1,               // round number within bracket
  bracket: 'W',           // 'W' | 'L' | 'GF'
  p1: { id, name, emoji } | null,  // null = slot not yet filled
  p2: { id, name, emoji } | null,
  throws: [],             // [{ playerId, throwIndex, value }, ...]
  winner: null,           // player object when resolved
  loser: null,            // player object when resolved
  done: false,            // true when match fully resolved
  isBye: false,           // true when auto-filled (no match needed)
  tiebreak: false,        // true when extra throw round needed
  advancesWinnerTo: 'W-Semi-1',  // slot ID where winner goes
  advancesLoserTo:  'L-R1-1',   // slot ID where loser goes (null for GF)
  throwsRequired: 2,      // 2 for most rounds (1 per player), 4 for GF, +2 for each tiebreak round
}
```

**Key design insight:** The flat array + ID references makes the structure JSON-serializable and replay-safe. `reconstructState` simply re-runs `applyThrow` for each stored throw, and the bracket rebuilds itself from scratch each time.

**Example — 4-player bracket (simplest case):**

```
W Bracket:
  W-R1-1: p1 vs p2  →  winner to W-Final, loser to L-Final
  W-R1-2: p3 vs p4  →  winner to W-Final, loser to L-Final

  W-Final: winner(W-R1-1) vs winner(W-R1-2)  →  winner to GF, loser to L-Final

L Bracket:
  L-Final: loser(W-R1-?) vs loser(W-R1-?)  →  winner to GF

Grand Final:
  GF: winner(W-Final) vs winner(L-Final)  →  tournament winner
```

**Example — 8-player bracket (most common at club):**

```
W Bracket (4 rounds):
  W-R1: 4 matches (W-R1-1..4)
  W-R2 (QF): 2 matches (W-R2-1..2)
  W-Semi: 1 match
  W-Final: 1 match

L Bracket (6 rounds, alternating "drop-in" and "play-through" rounds):
  L-R1: 2 matches (receives losers of W-R1 paired together)
  L-R2: 2 matches (L-R1 winners vs losers of W-R2)
  L-R3: 1 match (2 L-R2 winners play each other)
  L-R4: 1 match (L-R3 winner vs loser of W-Semi)
  L-R5: 1 match (L-R4 winner vs loser of W-Final)

Grand Final: 1 match (W-Final winner vs L-R5 winner)
```

Total for 8 players: 4 + 2 + 1 + 1 + 2 + 2 + 1 + 1 + 1 + 1 = 16 matches + 1 GF = 17 matches max.

---

### Pattern 2: applyThrow for Pin-Count Matches

**What:** Unlike the old engine where `applyThrow(state, matchId, winnerId)` immediately resolved a match, the new engine accumulates per-player per-throw values and only resolves when all required throws are in.

**Key logic flow:**

```javascript
// Source: CONTEXT.md D-08, interface contract
applyThrow(state, player_id, value, meta) {
  // 1. Deep clone state (immutability — existing convention)
  const s = JSON.parse(JSON.stringify(state));

  // 2. Find the active match for this player_id
  //    (player must be p1 or p2 of an active, non-done match)
  const match = findActiveMatchForPlayer(s.bracket, player_id);
  if (!match) return s; // guard: ignore stray throw

  // 3. Record the throw
  match.throws.push({ playerId: player_id, throwIndex: ???, value });

  // 4. Check if match is complete (all required throws recorded)
  if (matchIsComplete(match)) {
    // 5. Compute winner by summing pin counts per player
    //    Check for tie → set match.tiebreak = true
    //    If winner: advance bracket routing
    resolveMatch(s, match);
  }

  // 6. Check if tournament is done
  s.done = tournamentComplete(s);
  if (s.done) s.gewinner = findTournamentWinner(s);

  return s;
}
```

**Tiebreak handling:** When both players' totals are equal after all standard throws, the engine sets `match.tiebreak = true` and increments `match.throwsRequired += 2`. On the next two throws, the engine re-checks. Ties can repeat indefinitely. [ASSUMED — implementation detail not specified beyond "extra throw" in D-07]

---

### Pattern 3: Format Detection for Old vs New KDA State

**What:** Both the old and new state objects are stored under the `kda` game type. The renderer must detect which format it received.

**Detection logic (from CONTEXT.md UI-SPEC):**

```javascript
// Source: 06-UI-SPEC.md — Interaction Contracts > Old KDA Game Display
function renderKDASpiel(el, state) {
  // Old format: has state.matches[] + state.spieler[], no state.bracket
  // New format: has state.bracket[] (flat slot array)
  if (state.bracket) {
    renderKDABracket(el, state);   // new DE tree renderer
  } else {
    renderKDALegacy(el, state);    // old match-list renderer (preserved as-is)
  }
}
```

This is the **only branch point**. All existing old-game render logic is preserved unchanged inside `renderKDALegacy`.

---

### Pattern 4: TV KDA Branch in renderGame

**What:** `tv.js renderGame(state)` currently assumes all games have `state.players` (the generic player-list structure). KDA's new state has `state.bracket` instead. The TV needs a KDA-specific render path.

**Current tv.js renderGame (line 37–82):** Only handles games with `state.players` — renders a player list with scores and last throw. KDA new state has no `state.players`.

**Required change:**

```javascript
// Source: 06-CONTEXT.md D-13..D-15 + tv.js line 37
function renderGame(state) {
  // KDA new format: full bracket tree display
  if (state && state.bracket) {
    renderKDABracket(state);   // new function in tv.js
    return;
  }
  // All other game types: existing player-list logic (unchanged)
  if (!state || !state.players) return;
  // ... existing code ...
}
```

**renderKDABracket (TV):** Builds the full DE bracket DOM using `div.tv-bracket-slot` elements per the UI-SPEC. Active slots get amber glow; in-progress scores show "7 ⚫" in `var(--ac)`. Uses `textContent` throughout.

---

### Anti-Patterns to Avoid

- **Dynamic bracket generation:** Do NOT create new match slots in `applyThrow`. All slots must exist in the state returned by `initState`. The planner/executor must not recreate the old round-by-round approach.
- **innerHTML with player data:** All bracket slot content (player names, scores, round labels) must use `textContent`. The XSS guard is a hard constraint from CLAUDE.md and all existing game types.
- **applyThrow computing match IDs as player IDs:** The old engine used `matchId` as the `player_id` parameter and `winnerId` as `value`. The new engine uses the actual `player_id` of the player throwing, and `value` as pin count. This interface change is the most important migration detail.
- **Bracket reset in Grand Final:** D-03 explicitly disallows bracket reset. One match, one winner. Do not implement two-loss Grand Final logic.
- **Mutating state:** `applyThrow` must deep-clone state first (`JSON.parse(JSON.stringify(state))`). This is the established convention in all existing game-type modules.
- **Forgetting the seed:** `initState` receives `config.seed` from the POST body (set by `startKDA()` as `Date.now()`). Use `seededShuffle` for deterministic player ordering across crash/restart scenarios.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket real-time sync | Custom WebSocket handler | Existing `throw:applied` + `game:${id}` room | Already works; adding a KDA branch to `renderGame` in tv.js is 20 lines |
| Throw persistence / crash recovery | Custom state serialization | Existing DB-first throws table + `reconstructState` | The pattern is already working for all 9 game types |
| Pin-count input UI | Custom numpad | Existing `.kb` / `.kgrid` CSS classes | Already styled, already used in other game types (e.g., viergewinnt pudel grid) |
| Bottom sheet modal | Custom overlay | Existing `.mo` / `.md` CSS classes | Already styled; existing pattern in index.html |
| Badge/status display | Custom status pills | Existing `.bgrn` `.bamb` `.bred` `.bgry` badge classes | Already defined in index.html CSS |
| Seeded shuffle | Custom RNG | Existing `seededShuffle` utility in kegler-des-abends.js | Already tested, LCG-based, deterministic |

**Key insight:** This phase is almost entirely brownfield work. The infrastructure is complete. The deliverables are: (1) replace the bracket engine, (2) replace the frontend KDA renderer. No new API routes, no new socket events, no new CSS framework, no new npm packages.

---

## Runtime State Inventory

> This section is not applicable. Phase 6 is a feature addition (new bracket engine + new renderers), not a rename/refactor/migration. The old KDA state in the DB is display-only (D-04) and no data migration is required.

---

## Common Pitfalls

### Pitfall 1: throw_index Semantics Change

**What goes wrong:** The old KDA engine used `player_id` = matchId and `value` = winnerId. The new engine uses `player_id` = actual player ID and `value` = pin count. The `throw_index` in the throws table was used as a match round counter in the old engine, not a per-match throw sequence number.

**Why it happens:** The `reconstructState` function replays throws by calling `applyThrow(state, t.player_id, t.value)` from the DB. Old KDA throws in the DB have `player_id` = matchId (an integer 1–N). New throws have `player_id` = actual player row ID. The engines must not be confused.

**How to avoid:** Old KDA games remain finished in the DB — their throws are never replayed through the new engine (the game status is `'finished'`, so they never enter `reconstructState` for active game recovery). The format detection (`state.bracket` present) ensures old finished-game state objects (loaded from historical renders) go to `renderKDALegacy`. The risk is zero at runtime; awareness prevents confusion during implementation.

**Warning signs:** If during testing you see a `reconstructState` call on an old KDA game crash or produce wrong results — check that the game is `status = 'finished'` and never passes through `rebuildActiveGames`.

---

### Pitfall 2: Grand Final Throw Count (2 per player = 4 total API calls)

**What goes wrong:** The modal submit logic for the Grand Final must call `submitThrow` four times — Throw 1 for P1, Throw 2 for P1, Throw 1 for P2, Throw 2 for P2 — each as a separate API call to `POST /api/games/:id/throws`. The bracket only resolves when all 4 are recorded and there is no tie.

**Why it happens:** The `applyThrow` interface is a single-throw-at-a-time function. The modal collects all 4 values before the user presses "Würfe bestätigen", then must submit them sequentially, waiting for each response before sending the next. If done in parallel, race conditions in `reconstructState` can occur (though better-sqlite3 is synchronous and the unique-constraint guard handles true duplicates).

**How to avoid:** Submit GF throws sequentially: `await submitThrow(p1, 0, val1)` → `await submitThrow(p1, 1, val1_2)` → `await submitThrow(p2, 0, val2)` → `await submitThrow(p2, 1, val2_2)`. After each `throw:applied` event, the bracket re-renders. The modal should stay open until all throws are confirmed (or show a spinner between submissions).

**Warning signs:** TV shows partial GF state after each individual throw — this is correct behavior per D-14.

---

### Pitfall 3: Bye Auto-Advance Must Happen in initState, Not applyThrow

**What goes wrong:** If byes are not pre-resolved in `initState`, the bracket's `advancesWinnerTo` slots start with `p1` or `p2` = null, and `reconstructState` on an empty throws list will have null players in R2 that should already be filled.

**Why it happens:** The bracket must be fully navigable visually from the moment the tournament starts. If R1 bye slots are pending, the CSS tree cannot render because downstream match slots don't have players yet.

**How to avoid:** In `initState`, after assigning players to slots, immediately iterate over all `isBye: true` slots and: (1) set `done: true`, `winner = the_seeded_player`, (2) populate `advancesWinnerTo` target slot's `p1` or `p2` with the player. The `throws` array for bye slots remains empty — they are resolved without any throws.

**Warning signs:** Bracket renders W-R2 slots with "—" player names even at game start.

---

### Pitfall 4: CSS Line Connectors — Vertical Centering per Match

**What goes wrong:** The bracket connector lines (CSS `::before`/`::after` pseudo-elements using `border-right` + `border-top/bottom`) must connect the mid-point of each match slot to the mid-point of the downstream slot. If the column heights differ (e.g., an 8-slot W-R1 vs a 4-slot W-R2), the connector lines misalign.

**Why it happens:** `justify-content: space-around` in each `.bracket-col` distributes slots differently when column slot counts differ. The connector line length must account for slot count ratio differences.

**How to avoid:** Use CSS custom properties to set connector heights dynamically based on slot count. The UI-SPEC specifies `justify-content: space-around` — this works correctly when each round halves the slot count (which is always true for power-of-2 brackets). Test with 8-player and 12-player brackets specifically. [ASSUMED — CSS connector line implementation detail; validate visually]

**Warning signs:** Lines visually cross or don't reach the correct slot at 12-player bracket (tightest fit).

---

### Pitfall 5: TV renderGame — Null-Guard for New KDA State Shape

**What goes wrong:** The existing TV `renderGame` starts with `if (!state || !state.players) return;`. A new KDA game emits `state.bracket` but no `state.players`. Without an early branch before this guard, the TV silently renders nothing for a new KDA game.

**Why it happens:** `tv.js` was written assuming all game types have `state.players`. KDA new format does not. The guard causes an early return.

**How to avoid:** Add the KDA format branch BEFORE the `state.players` guard:
```javascript
function renderGame(state) {
  if (state && state.bracket) { renderKDABracket(state); return; }
  if (!state || !state.players) return;
  // ... existing code ...
}
```

**Warning signs:** TV shows idle screen when a new KDA game is started.

---

## Code Examples

### DE Bracket Slot Generation (8-player, canonical routing)

```javascript
// Source: derived from CONTEXT.md D-01, D-02 decisions + Wikipedia DE structure
// [ASSUMED] — canonical DE routing for 8-player bracket
// This is the pattern the engine must implement; exact slot IDs are Claude's discretion

function buildBracket8(seededPlayers) {
  // seededPlayers: array of 8 player objects after seededShuffle
  return [
    // Winner Bracket Round 1 (4 matches)
    { id: 'W-R1-1', bracket:'W', round:1, p1:seededPlayers[0], p2:seededPlayers[7], advancesWinnerTo:'W-R2-1', advancesLoserTo:'L-R1-2', throws:[], winner:null, loser:null, done:false, isBye:false },
    { id: 'W-R1-2', bracket:'W', round:1, p1:seededPlayers[3], p2:seededPlayers[4], advancesWinnerTo:'W-R2-1', advancesLoserTo:'L-R1-1', throws:[], winner:null, loser:null, done:false, isBye:false },
    { id: 'W-R1-3', bracket:'W', round:1, p1:seededPlayers[1], p2:seededPlayers[6], advancesWinnerTo:'W-R2-2', advancesLoserTo:'L-R1-2', throws:[], winner:null, loser:null, done:false, isBye:false },
    { id: 'W-R1-4', bracket:'W', round:1, p1:seededPlayers[2], p2:seededPlayers[5], advancesWinnerTo:'W-R2-2', advancesLoserTo:'L-R1-1', throws:[], winner:null, loser:null, done:false, isBye:false },

    // Winner Bracket Round 2 (QF, 2 matches)
    { id: 'W-R2-1', bracket:'W', round:2, p1:null, p2:null, advancesWinnerTo:'W-Semi', advancesLoserTo:'L-R2-1', throws:[], winner:null, loser:null, done:false, isBye:false },
    { id: 'W-R2-2', bracket:'W', round:2, p1:null, p2:null, advancesWinnerTo:'W-Semi', advancesLoserTo:'L-R2-2', throws:[], winner:null, loser:null, done:false, isBye:false },

    // Winner Bracket Semi/Final ...
    // Loser Bracket rounds ...
    // Grand Final
    { id: 'GF', bracket:'GF', round:1, p1:null, p2:null, advancesWinnerTo:null, advancesLoserTo:null, throws:[], winner:null, loser:null, done:false, isBye:false, throwsRequired:4 },
  ];
}
```

---

### applyThrow — Pin-Count Match Resolution Pattern

```javascript
// Source: CONTEXT.md D-05, D-06, D-07, D-08
// [ASSUMED] — implementation skeleton, not final code
applyThrow(state, player_id, value) {
  const s = JSON.parse(JSON.stringify(state));
  if (s.done) return s;

  // Find match where player_id is p1 or p2 and match is not done
  const match = s.bracket.find(m =>
    !m.done && !m.isBye && m.p1 && m.p2 &&
    (m.p1.id === player_id || m.p2.id === player_id)
  );
  if (!match) return s;

  // Record throw
  const throwIndex = match.throws.length;
  match.throws.push({ playerId: player_id, throwIndex, value });

  // Determine required throw count
  const throwsRequired = match.throwsRequired || (match.bracket === 'GF' ? 4 : 2);

  if (match.throws.length >= throwsRequired) {
    // Sum per player
    const p1Total = match.throws.filter(t => t.playerId === match.p1.id)
                                .reduce((sum, t) => sum + t.value, 0);
    const p2Total = match.throws.filter(t => t.playerId === match.p2.id)
                                .reduce((sum, t) => sum + t.value, 0);

    if (p1Total === p2Total) {
      // Tie — add 2 more throws required
      match.tiebreak = true;
      match.throwsRequired = (match.throwsRequired || throwsRequired) + 2;
    } else {
      // Winner determined
      match.winner = p1Total > p2Total ? match.p1 : match.p2;
      match.loser  = p1Total > p2Total ? match.p2 : match.p1;
      match.done   = true;

      // Advance routing: populate downstream slots
      advancePlayer(s.bracket, match.advancesWinnerTo, match.winner);
      if (match.advancesLoserTo) {
        advancePlayer(s.bracket, match.advancesLoserTo, match.loser);
      }

      // Check tournament completion
      const gf = s.bracket.find(m => m.bracket === 'GF');
      if (gf && gf.done) {
        s.done = true;
        s.gewinner = gf.winner;
      }
    }
  }

  return s;
}
```

---

### TV renderKDABracket — Structural Pattern

```javascript
// Source: CONTEXT.md D-13, D-14, D-15 + 06-UI-SPEC.md TV component spec
// All DOM creation via createElement + textContent (XSS guard)
function renderKDABracket(state) {
  const bracket = state.bracket;
  const container = document.createElement('div');
  container.id = 'kda-tv-bracket';
  // ... build W bracket columns, L bracket columns, GF column
  // For each slot: createElement('div'), className='tv-bracket-slot', ...
  // Player name: textContent = player.emoji + ' ' + player.name  (NOT innerHTML)
  // Score: textContent = throw ? throw.value + (inProgress ? ' ⚫' : '') : '—'

  gameEl.replaceChildren(container);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| KDA: dynamic round-by-round re-pairing | KDA: static DE bracket with predetermined routing | Phase 6 | Bracket is fully visible at start; TV can show the complete bracket tree |
| KDA: manual winner selection (tap who wins) | KDA: pin-count throw entry (engine determines winner) | Phase 6 | Consistent with how all other game types work; eliminates ambiguity |
| KDA: min 2 players | KDA: min 4 players (DE bracket requires at least 4) | Phase 6 | Prevents degenerate 2/3-player brackets that would have trivial structure |
| TV: no KDA display | TV: full bracket tree display | Phase 6 | Fills the gap — all other game types have TV displays |

**Deprecated/outdated (within KDA only):**
- `state.matches[]` array (old format): replaced by `state.bracket[]` — old format retained for legacy game display only
- `state.mid` (match ID counter): replaced by static string IDs like `'W-R1-1'`
- `state.wRound` (round counter): not needed — all rounds pre-exist as slots
- `state.bye` (single bye player): replaced by `isBye: true` slots in the bracket array
- `kdaSetWinner(matchId, winnerId)`: replaced by throw-based `submitThrow` calls from the match modal

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tiebreak implementation: engine increments `throwsRequired += 2` per tie; modal re-renders when `match.tiebreak: true` in returned state | Pattern 2, Common Pitfalls | Engine could use a different tiebreak flag/mechanism; low risk since D-07 is clear on behavior |
| A2 | CSS connector line heights work correctly with `justify-content: space-around` when round slot counts halve cleanly (power-of-2 brackets) | Common Pitfall 4 | Visual misalignment — caught in dev review before ship; no data risk |
| A3 | The canonical DE routing table (which L-bracket slot receives losers from which W-bracket round) follows standard tournament seeding conventions | Code Examples (8-player bracket routing) | Incorrect bracket structure — would produce rematches or wrong player routing; verified by comparing against published DE bracket templates |
| A4 | For 12-player bracket (next power of 2 = 16), 4 players receive first-round byes, seeded at positions 1–4 | Architecture (bracket size) | Could use alternating bye distribution instead; functionally equivalent — no match outcome risk |
| A5 | `submitThrow` in index.html is called sequentially in the Grand Final (4 calls, each awaited) | Common Pitfall 2 | Parallel submission risk — race condition possible with concurrent throws; testing will catch this |

---

## Open Questions

1. **Exact L-bracket routing for 4-player bracket**
   - What we know: 4 players → 8-slot (next power 2=4, so actually 4-slot bracket: W-R1-1, W-R1-2, W-Final). With only 4 players, the L bracket has just 1 match (the two W-R1 losers face each other), then GF.
   - What's unclear: Is the "L-Final" match the only L-bracket match, or does the 4-player bracket use L-R1 + L-Final naming?
   - Recommendation: Use the simplest naming that fits. For 4-player: W-R1-1, W-R1-2, W-Final, L-Final (just one L match), GF. The engine should normalize naming based on player count — Claude's discretion (locked as discretion in CONTEXT.md).

2. **Player slot assignment in L-bracket for non-power-of-2 counts**
   - What we know: 6 players → 8-slot bracket. Players 1–6 are seeded; slots 7 and 8 are byes. Standard convention seeds byes against the lowest-ranked players (positions 7 and 8 would have been the opponents) — so the highest seeds get byes.
   - What's unclear: The exact seeding order (1 vs 8, 2 vs 7, etc.) when there are more byes.
   - Recommendation: Seeding order is Claude's discretion per CONTEXT.md. Random shuffle from the existing `seededShuffle` utility is explicitly approved. Fill bracket from top; last 2 slots in W-R1 are bye slots. No risk to correctness.

3. **TV slot sizing for 12-player bracket (16-slot bracket)**
   - What we know: The UI-SPEC specifies slot sizes for 4, 8, and 12 players. 12 players → 16-slot bracket → many more columns, tightest fit.
   - What's unclear: Whether the bracket will physically fit in a 1920×1080 viewport without horizontal overflow.
   - Recommendation: Implement with the UI-SPEC's 140px × 64px slot size for 12 players and verify in browser at TV resolution before shipping. The TV has `overflow: hidden` so overflow would silently clip — requires visual testing.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v24.15.0 (confirmed via `node --version`) | — |
| `node --test` | Test runner | ✓ | Built into Node 22+ | — |
| npm (existing packages) | App runtime | ✓ | All deps in package.json confirmed | — |
| Browser (tablet) | Bracket UI | ✓ | Existing app | — |
| Browser (TV) | TV bracket | ✓ | Existing TV page | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) |
| Config file | none — `node --test server/game-types/*.test.js` |
| Quick run command | `npm run test:games` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOURNAMENT-01 | DE engine: `initState` generates full predetermined bracket for 4/8/12 players | unit | `npm run test:games` | ❌ Wave 0 — new test suite in kegler-des-abends.test.js |
| TOURNAMENT-01 | Player count: 4–12 validated in backend `initState` | unit | `npm run test:games` | ❌ Wave 0 |
| TOURNAMENT-01 | Byes auto-resolve in `initState` for non-power-of-2 counts | unit | `npm run test:games` | ❌ Wave 0 |
| TOURNAMENT-02 | `applyThrow` accumulates throws, resolves winner on completion | unit | `npm run test:games` | ❌ Wave 0 |
| TOURNAMENT-02 | Tiebreak: equal pins → extra throw prompted, match stays open | unit | `npm run test:games` | ❌ Wave 0 |
| TOURNAMENT-02 | Grand Final: 2 throws per player, higher total wins | unit | `npm run test:games` | ❌ Wave 0 |
| TOURNAMENT-02 | `getFinalResults` returns single winner for completed tournament | unit | `npm run test:games` | ❌ Wave 0 |
| TOURNAMENT-02 | `applyThrow` is immutable (does not mutate input state) | unit | `npm run test:games` | ❌ Wave 0 |
| TOURNAMENT-02 | Determinism: two replays of same throw sequence produce identical state | unit | `npm run test:games` | ❌ Wave 0 |
| TOURNAMENT-03 | `throw:applied` socket event carries updated bracket state | integration | manual or socket.io-client test | ❌ existing pattern; verify manually |

### Sampling Rate

- **Per task commit:** `npm run test:games`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/game-types/kegler-des-abends.test.js` — entire file must be rewritten to cover new DE engine interface (old tests reference `state.matches`, `state.mid`, `state.wRound` — none of which exist in new format)
- [ ] Test coverage: 4-player, 8-player, and 12-player (with byes) bracket generation
- [ ] Test coverage: complete tournament sequence (all matches resolved, `isFinished` returns true, `getFinalResults` has exactly one winner)

*Old tests (C1–C6, KDA1–KDA6) test the interface contract shape and immutability — these tests should be adapted, not deleted. The module shape (id, name, initState, applyThrow, isFinished, getFinalResults) remains the same.*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change — existing PIN session |
| V3 Session Management | no | No session change |
| V4 Access Control | no | No new protected endpoints |
| V5 Input Validation | yes | `player_id` (integer, must be in bracket), `value` (integer 0–9 for pin count), `throw_index` (integer ≥ 0) |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Out-of-range pin count submission | Tampering | Engine `applyThrow` should guard `value` is 0–9 (9-Kegel max); API already validates integer type |
| Duplicate throw injection (replay throw_index) | Tampering | Existing UNIQUE constraint on `(game_id, player_id, throw_index)` in throws table → 409 response |
| XSS via player name in bracket DOM | XSS | `textContent` only — hard constraint from CLAUDE.md; no `innerHTML` with DB-sourced strings |
| Throw for a non-active match (stale slot) | Tampering | `applyThrow` guard: only accept throws for matches where the player is p1 or p2 and match is not done |

---

## Sources

### Primary (HIGH confidence)

- `Claude/server/game-types/kegler-des-abends.js` — Current engine interface inspected directly (all 4 contract functions, seededShuffle utility, state shape)
- `Claude/server/routes/games.js` — applyThrow call signature `(state, player_id, value, meta)`, reconstructState pattern, DB-first throw persistence, throw:applied socket event at line ~169
- `Claude/public/index.html` — renderKDASpiel (line 931), kdaSetWinner (line 922), startKDA (line 907), existing CSS classes (.mo, .md, .kb, .kgrid, .badge, .bgrn, .bamb, etc.)
- `Claude/public/tv.js` — renderGame function, socket event handlers (game:state, throw:applied, game:started)
- `Claude/.planning/phases/06-turnierbaum/06-CONTEXT.md` — all locked decisions D-01 through D-15
- `Claude/.planning/phases/06-turnierbaum/06-UI-SPEC.md` — full visual and interaction contract

### Secondary (MEDIUM confidence)

- [Double-elimination tournament — Wikipedia](https://en.wikipedia.org/wiki/Double-elimination_tournament) — General DE structure, round naming conventions, L-bracket feed pattern from W-bracket rounds
- [Easy double elimination bracket gist](https://gist.github.com/ninewise/2d8d7a09d02d5044c3d4) — Algorithm reference: flat bracket array, predetermined routing, bye handling

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; no new deps
- Architecture: HIGH — engine interface contract confirmed from existing codebase; DE bracket structure is well-established
- Pitfalls: HIGH — derived from direct code inspection of existing engine and frontend
- CSS bracket tree: MEDIUM — line connector technique is standard CSS pseudo-element pattern; exact implementation needs visual testing at 12-player scale

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (stable stack — all dependencies are locked)
