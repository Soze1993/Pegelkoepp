# Phase 7: Highlights & TV-Layouts - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers two capabilities: (1) visual highlights — winner/loser symbols in the player table on the tablet, and full-screen TV overlays when a KDA game ends (winner) or a Bilderkegeln game ends (loser); and (2) game-type-specific TV layouts for Bilderkegeln, Fuchsjagd, and Viergewinnt (KDA bracket display was completed in Phase 6).

**What is in scope:**
- "Kegler des Abends" (KDA) winner symbol 🏆 in player table rows on the tablet, persistent until next KDA game
- Bilderkegeln loser symbol 💩 in player table rows on the tablet, persistent until next Bilderkegeln game
- Full-screen TV overlay for KDA game end (winner celebration, 10 seconds)
- Full-screen TV overlay for Bilderkegeln game end (loser display, distinct style, 10 seconds)
- Bilderkegeln TV layout: player list with lowest-score row highlighted in red
- Fuchsjagd TV layout: split layout — Fuchs side vs Jäger group side
- Viergewinnt TV layout: Claude's discretion (two team panels recommended)

**What is NOT in scope:**
- Statistics or leaderboard (Phase 8)
- WhatsApp share link (Phase 9)
- Self-hosted fonts (Phase 9)
- TV symbols (symbols only appear on tablet)
- Symbols for other game types beyond KDA and Bilderkegeln

</domain>

<decisions>
## Implementation Decisions

### TV End Overlay (HIGHLIGHT-02, HIGHLIGHT-04)

- **D-01:** KDA winner overlay — full-screen takeover: dark background, large centered name + title "🏆 [Name] — Kegler des Abends!" using amber (`--ac`) accent. Replaces the game state entirely (not an on-top overlay). Displayed for 10 seconds, then auto-transitions to `renderIdle`.
- **D-02:** Bilderkegeln loser overlay — same full-screen takeover format, but visually distinct from the winner overlay: red accent (`--red`) instead of amber, loser framing. Text: "💩 [Name] — Bilderkegeln-Verlierer!" Displayed for 10 seconds, then auto-transitions to `renderIdle`.
- **D-03:** The current `game:finished` behavior (renderGame → 3-second timeout → idle) is replaced with: show overlay → 10-second timeout → `renderIdle`. The overlay replaces the game state view, not the idle screen.
- **D-04:** The TV needs to know the game type at `game:finished` time to decide which overlay to show. The backend should enrich the `game:finished` payload with `typeKey` (the game's `type_key` string). Alternatively, the TV can derive game type from state shape (`state.bracket` = KDA; `state.gewinner` alone = could be KDA old-format or Bilderkegeln). Prefer explicit `typeKey` field for clarity — researcher should verify which is cleaner.

### Player Table Symbols (HIGHLIGHT-01, HIGHLIGHT-03)

- **D-05:** Symbols appear in the tablet/app player table (Spielen tab) only — not on the TV player list rows.
- **D-06:** KDA winner symbol: 🏆 (trophy) — shown next to the winning player's name in their row in the active game player table.
- **D-07:** Bilderkegeln loser symbol: 💩 (poop) — shown next to the player with the fewest points in their row in the active game player table.
- **D-08:** Symbols are persistent across evenings. The "current KDA champion" (last player to win a KDA tournament) retains the 🏆 in their row until the next KDA game completes with a different (or even the same) winner. Same for the 💩 and Bilderkegeln. Symbols survive server restarts — persistent storage required (recommend: store in DB or derive from last finished game query on startup).
- **D-09:** The symbol appears inline in the player row next to the player's name. Exact placement (before name, after name, as a suffix badge) is Claude's discretion.

### TV Layout Variants (TV-01)

- **D-10:** Game types with distinct TV layouts (beyond the existing KDA bracket): Bilderkegeln, Fuchsjagd, Viergewinnt. All other game types (dreiVollen, plusMinus, grosseHaus, kleineHaus, anker) keep the generic player list layout.
- **D-11:** Bilderkegeln TV layout — same player list format as the generic layout, but the player with the lowest current score has their row visually highlighted in red. The loser position updates in real-time as scores change. No layout restructuring.
- **D-12:** Fuchsjagd TV layout — split layout: Fuchs player on one side (top or left), Jäger group on the other side (bottom or right). Each side shows the relevant player(s) with their role label and score.
- **D-13:** Viergewinnt TV layout — Claude's discretion. Recommendation: two team panels side by side (Team X on left, Team O on right), each showing team members and their scores. This matches the game's fundamental team-vs-team structure.

### Claude's Discretion

- Viergewinnt TV layout exact design (two team panels is the recommendation)
- Exact CSS for the TV overlay (animation, font size, padding — should be visually impactful on TV)
- Exact color accent for the Bilderkegeln loser overlay (red `--red` recommended)
- How the persistent champion/loser is stored: recommend querying the last finished KDA game and last finished Bilderkegeln game from the DB on server startup, cached in memory. No new DB schema required.
- Symbol placement within the player row (before or after name, badge or inline)
- Whether to patch `showWinnerBanner` in index.html (currently uses innerHTML — should use textContent for XSS safety)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### TV Display (primary target)
- `Claude/public/tv.js` — Full TV rendering logic. Key: `socket.on('game:finished', ...)` (lines 23-26) is the integration point for the overlay; `renderGame(state)` (line 37) is the dispatcher replaced/extended by game-type-specific renderers; `renderIdle(lastWinner)` (line 28) is called after overlay dismisses; `renderKDABracket(state)` (line 103) is the Phase 6 KDA layout (reference for new layout structure).
- `Claude/public/tv.html` — TV page HTML structure; inspect for existing DOM element IDs (`game`, `playerList`, `idle`, etc.) used by tv.js.

### Tablet Frontend (player table symbols)
- `Claude/public/index.html` — Key functions: `showWinnerBanner(state)` (line 507, uses innerHTML — XSS risk to audit); `getWinnerName(state, type_key)` (line 480, handles KDA, bilderkegel, fuchsjagd, viergewinnt, generic); `renderSpielenTab()` (line 777, the Spielen tab renderer where player table lives); `socket.on('game:finished', ...)` (line 421, tablet game:finished handler).

### Backend Game End Event
- `Claude/server/routes/games.js` — `game:finished` emission (lines ~186-196). Currently emits `{ state, lastWinner }`. May need `typeKey` added to payload (D-04). Also: `getFinalResults` interface per game module.

### Requirements & Acceptance Criteria
- `Claude/.planning/REQUIREMENTS.md` — HIGHLIGHT-01, HIGHLIGHT-02, HIGHLIGHT-03, HIGHLIGHT-04, TV-01 (lines 22-36).
- `Claude/.planning/ROADMAP.md` — Phase 7 success criteria (5 items, lines ~49-57).

### Game Type Implementations (for Fuchsjagd/Viergewinnt state shapes)
- `Claude/server/game-types/fuchsjagd.js` — State shape for Fuchsjagd (understand `state.fuchs`, `state.sieger`, `state.winner` fields used in Jäger/Fuchs role assignment).
- `Claude/server/game-types/viergewinnt.js` — State shape for Viergewinnt (understand `state.tX`, `state.tO`, team composition).
- `Claude/server/game-types/bilderkegel.js` — State shape for Bilderkegeln (understand `state.gewinner` = player with fewest points = loser; `state.players` score ordering).

### Project Conventions
- `Claude/CLAUDE.md` — Stack constraints (textContent-only XSS guard, Socket.io 4, CSS vars).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderIdle(lastWinner)` in tv.js — called after game ends; TV overlay should call this after the 10-second timeout (D-03).
- `getWinnerName(state, type_key)` in index.html — already handles KDA winner (`state.gewinner`), Bilderkegeln winner/loser (`state.gewinner` = fewest pins = loser), Fuchsjagd, Viergewinnt. Reuse for determining who gets the symbol.
- `socket.on('game:finished', ...)` in tv.js — the TV integration point. Currently calls `renderGame(state)` then timeout → idle. Replace this with overlay logic.
- `.badge .bgrn/.bamb/.bred` CSS classes — existing badge patterns for winner/loser visual indicators.
- `buildTVSlotEl` in tv.js — shows the established TV slot visual pattern; reference for TV overlay styling (Bebas Neue for headings, DM Sans for labels, `--ac` amber accent).

### Established Patterns
- **textContent-only XSS guard:** All player names rendered via `textContent` — no `innerHTML` with DB-sourced strings. The existing `showWinnerBanner` uses `innerHTML` with `winnerName` derived from DB — this should be refactored to use textContent (safe DOM construction). Any new overlay must use textContent.
- **`game:finished` event carries `{ state, lastWinner }`:** `lastWinner` is already a plain string (winner's name). If the TV overlay needs the game type, either enrich the payload with `typeKey` or derive from state shape. Deriving: `state.bracket` array present → KDA; check `typeKey` if added.
- **DB-first operations:** Persistent champion storage should be DB-queryable (last completed KDA/Bilderkegeln game). Recommend: `SELECT games.id, players.name, games.state FROM games JOIN ... WHERE type_key = 'kda' AND finished = 1 ORDER BY id DESC LIMIT 1` on startup.

### Integration Points
- `tv.js socket.on('game:finished', ...)` (line 23): Replace the current `renderGame` + 3s-timeout behavior with overlay display + 10s-timeout → `renderIdle`.
- `tv.js renderGame(state)` (line 37): Add game-type branches for Bilderkegeln, Fuchsjagd, Viergewinnt before the generic player list fall-through. The existing `state.bracket` check for KDA is the pattern to follow.
- `index.html renderSpielenTab()`: The player table rendering function must be updated to show 🏆 next to the current KDA champion's name and 💩 next to the current Bilderkegeln loser's name. These need to be loaded from a persistent source at page load.
- `server/routes/games.js game:finished` emission: May need `typeKey` field added to identify game type on the TV side.
- New TV render functions to add: `renderBilderkegelTV(state)`, `renderFuchsjagdTV(state)`, `renderViergewinntTV(state)`.

</code_context>

<specifics>
## Specific Ideas

- **KDA overlay text:** "🏆 [Name] — Kegler des Abends!" — amber (`--ac`) accent, Bebas Neue headline font, full-screen dark background.
- **Bilderkegeln overlay text:** "💩 [Name] — Bilderkegeln-Verlierer!" — red (`--red`) accent to visually distinguish from winner. Same full-screen format.
- **Overlay dismissal:** Both overlays auto-dismiss after 10 seconds → call `renderIdle`. No manual dismiss needed.
- **Bilderkegeln player row symbol:** The lowest-scoring player at any point during the game gets the 💩 symbol in their row. Updates live as scores change (same re-render cycle as other state updates).
- **Fuchsjagd TV split:** "Fuchs" (the fox player) on one side with their role label, "Jäger" (the hunters) on the other side. The TV shows who is who — useful since players may not know who's hunting whom.
- **Persistent champion:** When the app loads, query the DB for the last completed KDA game (get winner) and last completed Bilderkegeln game (get loser = gewinner). Display their 🏆/💩 in the player table from the moment the page loads.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 7-Highlights & TV-Layouts*
*Context gathered: 2026-05-24*
