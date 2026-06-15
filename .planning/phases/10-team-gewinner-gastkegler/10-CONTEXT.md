# Phase 10: Team-Gewinner & Gastkegler - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers two independent capabilities:

1. **Stats-Korrektur (STATS-01/02):** VierGewinnt- und Fuchsjagd-Siege werden korrekt als individuelle Siege für alle Gewinner gewertet — nicht mehr fälschlicherweise als Unentschieden. Root cause: `const isDraw = winners.length !== 1` in stats.js — wenn ein Team gewinnt und 2+ Gewinner hat, greift `!== 1` obwohl es eindeutig ein Sieg ist. Fix: `winners.length === 0` (nur echte Unentschieden wie VG-Draw-Grid). Da Stats query-time berechnet werden, ist kein DB-Migration nötig — historische Spiele zeigen korrekte Werte nach Server-Neustart automatisch (STATS-02 ist kostenlos).

2. **Gastkegler (GUEST-01-04):** Temporäre Spieler für einen Kegelabend — erstellt über bestehenden "Spieler hinzufügen"-Dialog mit "Gast?"-Checkbox, im UI als `"Name (Gast)"` gekennzeichnet, aus Statistiken und Leaderboard immer ausgeschlossen, automatisch archiviert wenn der Abend beendet wird.

**Was NICHT in Scope ist:**
- Profilbilder (Phase 11)
- TV-Layout-Fixes für FJ/KDA (Phase 12)
- Monatliches Leaderboard (post-v3.0)
- Kein neues NPM-Package

</domain>

<decisions>
## Implementation Decisions

### Stats-Fix (STATS-01, STATS-02)

- **D-01:** `isDraw`-Logik in ALLEN 4 Stats-Endpoints ändern: `winners.length !== 1` → `winners.length === 0`. Damit gilt: 0 Gewinner = Unentschieden (VG-Draw: volle Grid ohne 4er), 1+ Gewinner = Sieg für alle Gewinner.
- **D-02:** Fix wird in ALLEN 4 Endpoints konsistent angewendet: `/api/stats`, `/api/stats/year`, `/api/stats/streaks`, `/api/stats/h2h`.
- **D-03:** Jahr-Leaderboard (`/api/stats/year`): das bisherige `if (isDraw) continue; winsMap[winners[0].playerId]++` wird ersetzt durch Iteration über alle Gewinner — jeder bekommt seinen Win-Eintrag.
- **D-04:** H2H (`/api/stats/h2h`): mehrere Gewinner (gleicher Team) → beide bekommen ihren Win-Eintrag (`winsA++` UND `winsB++` wenn beide gewinnen). Implementierung via `winners.some(w => w.playerId === a)` statt `winners[0].playerId === a`.
- **D-05:** Streaks: VG/FJ-Team-Sieg erhöht die Streak für alle Gewinner (nicht mehr Reset durch fälschlichen Draw-Status).
- **D-06:** Kein Schema-Change für den Stats-Fix — reines Logik-Fix in `server/routes/stats.js`.

### Gastkegler DB & API (GUEST-01, GUEST-02, GUEST-03, GUEST-04)

- **D-07:** Neue Spalte in `players`-Tabelle: `is_guest INTEGER NOT NULL DEFAULT 0`. Migration via try/catch-Pattern in `server/db/index.js` migrations-Array (bestehender idempotenter Pattern).
- **D-08:** `POST /api/players` nimmt optionalen `is_guest: true` Parameter im Request-Body. Ohne Flag → 0 (regulärer Spieler).
- **D-09:** `GET /api/players` gibt `is_guest`-Feld zurück, damit das Frontend das `(Gast)`-Label anzeigen kann.
- **D-10:** Gastkegler erscheinen in der Spielerauswahl mit Label `"Name (Gast)"` direkt hinter dem Namen (textContent-Pattern, kein HTML). Kein eigenes Badge/Chip-Element nötig.
- **D-11:** Stats-Ausschluss für Gäste: alle Stats-Queries holen nur `WHERE archived = 0 AND is_guest = 0`. Gäste sind IMMER ausgeschlossen — auch während des aktiven Abends, bevor sie archiviert sind.
- **D-12:** `POST /api/abende/:id/end`: archiviert zusätzlich ALLE unarchvierten Gäste via `UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0`. (Einfach und korrekt, da nur ein offener Abend gleichzeitig existiert.)
- **D-13:** Spieldaten (game_players, throws) bleiben nach Archivierung unverändert — historische Spielergebnisse sind weiterhin abrufbar. Nur `archived = 1` wird gesetzt (wie bestehender Archivierungs-Pattern).

### Gastkegler UI (GUEST-01, GUEST-02)

- **D-14:** Neues "Gast?"-Checkbox im bestehenden "Spieler hinzufügen"-Dialog in `public/index.html`. Kein eigener "Gast-Button" nötig.
- **D-15:** Label-Format: `"Max (Gast)"` — `is_guest`-Flag aus API-Response, Name + Suffix im textContent ohne innerHTML.

### Claude's Discretion

- Exaktes CSS/Layout für die Gast-Checkbox im Dialog
- Ob "(Gast)" auch auf dem TV sichtbar sein soll (ROADMAP nennt es nur für Spielerauswahl/Label — TV wurde nicht besprochen)
- Reihenfolge der Gäste in der Spielerliste (nach regulären Spielern oder gemischt — alphabetisch nach ID)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Anforderungen & Erfolgskriterien
- `.planning/ROADMAP.md` — Phase 10 Goal + Success Criteria (6 Punkte); Phase 10 ist das erste Phase von v3.0
- `.planning/REQUIREMENTS.md` — STATS-01, STATS-02, GUEST-01, GUEST-02, GUEST-03, GUEST-04 (vollständige Anforderungstexte)

### Stats-Fix (Kern-Bug)
- `server/routes/stats.js` — **Primäre Änderungsdatei.** Bug in Zeile 59: `const isDraw = winners.length !== 1`. Alle 4 Endpoints hier: `/api/stats` (Z.16), `/api/stats/year` (Z.183), `/api/stats/streaks` (Z.245), `/api/stats/h2h` (Z.288). Jahr-Leaderboard bei Z.206-209 muss auf Iteration aller Gewinner umgestellt werden.
- `server/game-types/vier-gewinnt.js` — `getFinalResults`: gibt `winner: true` für ALLE Mitglieder des gewinnenden Teams zurück (→ `winners.length` = Teamgröße, nicht 1). `state.winner === 'draw'` → alle `winner: false` → `winners.length === 0` (echtes Unentschieden).
- `server/game-types/fuchsjagd.js` — `getFinalResults`: gibt `winner: true` für ALLE Jäger wenn Jäger gewinnt, nur für Fuchs wenn Fuchs gewinnt. Jäger-Sieg = multi-winner-Fall.

### Gastkegler Backend
- `server/db/index.js` — migrations-Array (Z.26-33): hier `is_guest`-Migration hinzufügen. Pattern: try/catch auf duplicate-column-name. Schema-Referenz: `server/db/schema.sql` (players-Tabelle).
- `server/routes/players.js` — `POST /api/players` (Z.17): `is_guest` aus Body lesen; `GET /api/players` (Z.9): `is_guest` in SELECT aufnehmen.
- `server/routes/abende.js` — `POST /api/abende/:id/end` (Z.150): nach `UPDATE abende SET ended_at` den Guest-Archive-UPDATE hinzufügen.

### Gastkegler Frontend
- `public/index.html` — Spielerliste-Rendering (suche `renderSpielenTab` oder Spieler-Liste-Funktion): `is_guest`-Flag auslesen, Label `"Name (Gast)"` via textContent anhängen. "Spieler hinzufügen"-Dialog: Gast-Checkbox hinzufügen, `is_guest` im POST-Payload mitschicken.

### Konventionen
- `CLAUDE.md` — textContent-only XSS-Guard, kein neues NPM-Package, Stack-Constraints

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **archived-Pattern in `players.js`** (`PUT /api/players/:id/archive`, Z.52): `UPDATE players SET archived = 1 WHERE id = ? AND archived = 0` — identisches Pattern für Guest-Archivierung, nur ohne ID-Filter.
- **Migration try/catch in `db/index.js`** (Z.35-42): `try { db.exec(sql) } catch(e) { if (!e.message.includes('duplicate column name')) throw e; }` — exakt dieser Pattern für `ALTER TABLE players ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0`.
- **`reconstructState(game)` + `gameModule.getFinalResults(state)`** in `stats.js` (Z.49-54): das Rekonstruktions-Muster für alle 4 Stats-Endpoints — bleibt unverändert, nur die isDraw-Logik dahinter ändert sich.

### Etablierte Patterns
- **textContent-only XSS-Guard:** alle Spielernamen via `textContent` — `"Name (Gast)"` als string via textContent anhängen, kein innerHTML.
- **`archived = 0` in allen Stats-Queries:** bestehende Guard-Bedingung — um Gäste auszuschließen: `AND is_guest = 0` dazuhängen.
- **Stats query-time computed:** keine Stats werden in der DB gespeichert — jede Stats-Anfrage rechnet frisch aus dem `games`/`throws`-Log. STATS-02 (historische Korrektur) ist damit kostenlos nach dem Code-Fix.

### Integration Points
- `stats.js:59` — erster `isDraw`-Bug (stats endpoint); analog an 3 weiteren Stellen in derselben Datei
- `abende.js:150` (`POST /api/abende/:id/end`) — nach dem `UPDATE abende` den Guest-Archive-Block einfügen; muss transaktionssicher sein (beide Updates in einer Anweisung oder sequenziell, da better-sqlite3 synchron ist)
- `players.js:9` (`GET /api/players`) — `is_guest` zum SELECT hinzufügen, damit Frontend Labels rendern kann
- `index.html` — Spielerliste-Rendering und "Spieler hinzufügen"-Dialog: zwei Änderungspunkte im Frontend

</code_context>

<specifics>
## Specific Ideas

- **`isDraw`-Fix Formulierung:** `const isDraw = winners.length === 0;` — sauberste Änderung, ein Zeichen ändert die Semantik.
- **H2H multi-winner check:** `winners.some(w => w.playerId === a)` statt `winners[0].playerId === a` — deckt sowohl Single-Winner als auch Multi-Winner (gleiche Team gewinnt) ab.
- **Gast-Archivierung in Abend-Ende:** `db.prepare('UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0').run()` — kein Parameter nötig (alle Gäste, da nur ein offener Abend).
- **DB-Migration:** `'ALTER TABLE players ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0'` — in die migrations-Array in `db/index.js` einhängen.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-Team-Gewinner & Gastkegler*
*Context gathered: 2026-06-15*
