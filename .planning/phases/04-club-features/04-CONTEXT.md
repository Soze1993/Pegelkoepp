# Phase 4: Club Features — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Source:** Inline discuss (gsd-autonomous --interactive)

<domain>
## Phase Boundary

Phase 4 adds three club-night features on top of the fully wired Phase 3 app:

1. **Kegelabend sessions** (PERS-04) — Group games into a named evening session with manual start/end
2. **Player statistics** (STAT-01, STAT-02, STAT-03) — Real wins/losses, personal bests, and Pudel% in the existing Stats tab
3. **Custom game type docs** (PERS-03) — A simple name+description reference system in the Bibliothek tab for game types that will be implemented later in code

**Out of scope for Phase 4:**
- Custom game type *scoring logic* — not planned; user confirmed it's too complex for a generic engine
- Kegelabend history browsing beyond grouping in the Spiele tab
- Multi-session statistics (stats span all time, not filtered by session)

</domain>

<decisions>
## Implementation Decisions

### D-01 — Kegelabend session model
A Kegelabend is a manually opened/closed session. The user taps "Abend starten" in the Spiele tab, optionally names it (default: current date, e.g. "Fr. 23.05."), and all games started while the session is open are linked to it via `games.abend_id`. Tapping "Abend beenden" closes the session (sets `abende.ended_at`). At most one session can be open at a time.

### D-02 — Abend schema
New table: `abende (id, name TEXT, started_at, ended_at TEXT NULL)`. Migration: `ALTER TABLE games ADD COLUMN abend_id INTEGER NULL REFERENCES abende(id)`. Both migrations use the try/catch duplicate-column pattern already established in the codebase (D-12 precedent from Phase 2).

### D-03 — Abend auto-name default
If the user leaves the name field blank, the server assigns a default: weekday + date abbreviation in German locale, e.g. "Fr. 23.05.". Computed server-side on `POST /api/abende`.

### D-04 — Game-to-abend association
`POST /api/games` accepts an optional `abend_id` field. If omitted but an active abend exists, the server auto-links the game to the active abend (server reads `abende WHERE ended_at IS NULL LIMIT 1`). This way the frontend does not need to explicitly pass the abend_id — it just starts games normally.

### D-05 — Win/loss attribution rule
For each finished game: call `getFinalResults(state)` → player ranked `rank === 1` gets a win; all others get a loss. **Exception:** if two or more players share `rank === 1` (identical top score), no wins or losses are recorded for that game — it is a draw. The `getFinalResults` functions already return ranked arrays; the stats endpoint reads the throws table + game_players to reconstruct results for all finished games.

### D-06 — Personal best (STAT-02)
Best score = the highest value of `results[i].score` (from `getFinalResults`) a player has ever achieved in a specific game type. Stored/queried dynamically — no separate table needed; computed from throws + game_players at query time.

### D-07 — Pudel definition
A Pudel is any throw where `meta.pudel === true` (JSON-parsed from `throws.meta`). Throws with `value = 0` but no `meta.pudel` flag are NOT counted as Pudel. This matches the frontend's existing `meta` flag usage.

### D-08 — Custom game type structure (PERS-03)
Custom types are reference documents only — name + description, no scoring engine. Stored in the existing `game_type_defs` table with `is_builtin = 0`. The `key` is auto-generated from the name (slugified, e.g. "mein-spiel"). `config_json` defaults to `{}`. Custom types appear in the Bibliothek tab with a gold left-border accent (`stc.cu` CSS class). They are NOT selectable when starting a game — only built-in types appear in the game-start flow. Adding them to game start is a future Phase 5+ task.

### D-09 — Stats endpoint design
`GET /api/stats` returns per-player aggregates computed at query time from existing tables. No denormalized stats table needed — the dataset is small (club = ~10 players, ~200 games/year). Response shape:
```json
[{
  "player_id": 1, "name": "Max", "emoji": "🎳",
  "wins": 5, "losses": 12, "draws": 1,
  "pudel_count": 7, "total_throws": 84, "pudel_pct": 8.3,
  "personal_bests": [{ "type_key": "drei-vollen", "score": 42 }]
}]
```

### D-10 — Spiele tab UI changes
- When no active Abend: show "▶ Abend starten" button at top of Spiele tab
- When an active Abend is open: show amber banner "📍 Abend läuft: {name}" + "■ Beenden" button
- Game history below the banner groups finished games under their Abend (accordion or date group header), ordered newest first
- Games not linked to any Abend appear under "Ohne Abend" at the bottom

### D-11 — Stats tab UI changes
Replace the current empty `<div id="r-stats">` content with a real stats view:
- Player cards matching `.uc` pattern (emoji + name + stat chips)
- Chips: Siege (wins), Niederlagen (losses), Pudel% (red chip `.pc`)
- Expandable or scrollable personal bests table per player (`.stbl` pattern)
- Empty state: "Noch keine Spiele gespielt" when no finished games exist

### D-12 — Bibliothek tab UI changes
Current Bibliothek tab shows built-in game type cards. Add:
- Section header "Eigene Spieltypen" with "+ Hinzufügen" button
- Modal to create a custom type: name input + description textarea
- Custom types rendered with `.stc.cu` (gold left border)
- Delete button on custom types (built-in types are not deleteable)

### Claude's Discretion
- SQL query optimization for stats — use a single aggregating query where possible, fall back to JS computation for personal bests (small dataset)
- Error handling for games with unknown type_key in stats computation (skip gracefully)
- Abend banner color: amber/gold (`--ac`) matches brand
- Frontend state: `S.aktAbend = { id, name }` stored alongside `S.aktSpiel` in the global state object
- Test coverage: socket tests for abend-linked game broadcasts, stats endpoint tests with fixture data

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing codebase patterns
- `Claude/server/db/index.js` — DB singleton + migration pattern (try/catch duplicate-column)
- `Claude/server/db/schema.sql` — current schema (abende + abend_id migration go here or inline)
- `Claude/server/routes/games.js` — route structure, reconstructState, getFinalResults usage
- `Claude/server/game-types/index.js` — gameTypes registry, getFinalResults signature
- `Claude/server/app.js` — route mounting pattern
- `Claude/public/index.html` — full frontend (CSS classes, tab structure, modal pattern, S.* global state)

### Prior phase summaries (for pattern consistency)
- `Claude/.planning/phases/03-frontend-wiring/03-03-SUMMARY.md` — Phase 3 final state, bug fixes
- `Claude/.planning/phases/02-real-time-tv/02-04-SUMMARY.md` — TV display patterns

### Requirements
- `Claude/.planning/REQUIREMENTS.md` — PERS-03, PERS-04, STAT-01, STAT-02, STAT-03

</canonical_refs>

<specifics>
## Specific Ideas

- The `game_type_defs` table already exists in schema.sql (seeded empty, for Phase 4 per the comment)
- `getFinalResults()` returns `[{ playerId, name, score, rank, winner, ... }]` — rank 1 = winner
- The `meta` column on throws is already TEXT (JSON string); `meta.pudel` is set by frontend game logic
- Abend default name: use `new Date().toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })` on the server
- The `.chip.pc` CSS class (red color) already exists for Pudel% display
- No new npm packages needed — all features use existing DB + vanilla JS patterns

</specifics>

<deferred>
## Deferred Ideas

- Custom game type scoring engine — too complex; reference docs only for now
- Stats filtered by Kegelabend (view one evening's stats) — v2
- Leaderboard / win streak — explicitly v2 (deferred at project init)
- Abend history view (browse past evenings) — v2

</deferred>

---

*Phase: 04-club-features*
*Context gathered: 2026-05-21 via inline discuss (gsd-autonomous --interactive)*
