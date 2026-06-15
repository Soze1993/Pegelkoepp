---
phase: 10-team-gewinner-gastkegler
verified: 2026-06-15T12:00:00Z
status: human_needed
score: 6/6
overrides_applied: 0
human_verification:
  - test: "Starte ein Viergewinnt-Spiel, lass Team X gewinnen und prüfe, dass beide X-Mitglieder im Jahres-Leaderboard (+1 Sieg) auftauchen"
    expected: "Beide Spieler des gewinnenden Teams erscheinen mit +1 Sieg — nicht mehr als Unentschieden"
    why_human: "Benötigt ein laufendes Server-System mit echten Spielen"
  - test: "Füge einen Gastspieler über den Dialog hinzu (Checkbox aktiviert), starte ein Spiel mit ihm, beende den Abend"
    expected: "Gastspieler erscheint mit '(Gast)'-Label in der Spielerliste und den drei Spielauswahl-Modals; nach Abend-Ende verschwindet er aus GET /api/players (archived=1)"
    why_human: "End-to-end Browsertest erforderlich — Checkbox-Interaktion, Modal-Rendering, Abend-Beenden"
  - test: "Prüfe GET /api/stats nach einem Abend mit Gastkeglern"
    expected: "Gastspieler erscheint NICHT im players[]-Array der Stats-Response"
    why_human: "Benötigt laufenden Server mit Gastkegler-Daten in der DB"
  - test: "Letzte-Abend-Rückblick-Karte: Siege eines VG-Team-Spielers (Abend-Recap)"
    expected: "Die Siege-Zahl im Rückblick ist möglicherweise noch falsch für VG-Team-Gewinne — /api/abende/last-summary verwendet noch winners.length !== 1 (Zeile 78). Dies ist KEIN Leaderboard, aber beeinflusst die Rückblick-Karte auf der Startseite."
    why_human: "Erfordert Sichtprüfung der Rückblick-Karte nach einem VG-Team-Sieg; Scope-Entscheidung ob abende.js auch gefixt werden muss"
---

# Phase 10: Team-Gewinner & Gastkegler — Verification Report

**Phase Goal:** Statistiken korrekt machen und Gastkegler ermöglichen — beides reines Backend/DB, kein neues Package, höchste Priorität für den nächsten Abend.
**Verified:** 2026-06-15T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VG-Sieg zählt als Sieg für beide Team-Mitglieder im Leaderboard (nicht mehr als Unentschieden) | VERIFIED | `const isDraw = winners.length === 0` exakt 4x in stats.js (non-comment); `/api/stats/year` iteriert `for (const w of winners)` — beide Team-Mitglieder bekommen `winsMap[w.playerId]++` |
| 2 | FJ-Sieg zählt als Sieg für alle Jäger im Leaderboard | VERIFIED | Gleiche `isDraw = winners.length === 0` Logik in allen 4 Endpoints; multi-winner loop deckt FJ-Jäger-Fall (winners.length = 10) automatisch ab |
| 3 | Historische VG/FJ-Spiele zeigen korrekte Siege nach Server-Neustart (Stats recomputed) | VERIFIED | Stats sind query-time computed (kein Cache, keine gespeicherten Stats in DB) — Fix in stats.js gilt rückwirkend für alle historischen Spiele nach dem nächsten Server-Start. STATS-02 kostenlos erfüllt. |
| 4 | Gastkegler kann erstellt werden; erscheint mit "(Gast)"-Label in Spielerliste und Spielauswahl | VERIFIED | `id="m-sp-gast"` Checkbox vorhanden (Z.174); `async function addSpieler` postet an `/api/players` mit `is_guest:isGast`; ternary `s.is_guest?s.name+' (Gast)':s.name` 5x vorhanden (renderSpielerListe + renderBKWahl + renderVGWahl + renderFJWahl Fuchs + renderFJWahl Jäger) |
| 5 | Gastkegler erscheint nicht im Leaderboard oder in Streak-Statistiken | VERIFIED | `FROM players WHERE archived = 0 AND is_guest = 0` in 2 Player-SELECTs (`/api/stats` Z.19 + `/api/stats/year` Z.214); 0 unguarded `archived = 0` player queries in stats.js |
| 6 | Gastkegler wird beim Beenden des Kegelabends automatisch archiviert | VERIFIED | `UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0` in abende.js Z.160; Positions-Check: NACH `UPDATE abende SET ended_at` (idx 6260) UND NACH `'Abend not found'` 404-Check (idx 6404) UND VOR `res.json({ ok: true })` (idx 6586) |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/routes/stats.js` | Korrekte isDraw-Semantik in 4 Endpoints + Guest-Ausschluss in 2 Player-Queries | VERIFIED | 4x `winners.length === 0`, 0x `winners.length !== 1`, `for..of` loop, `winners.some()` für H2H, 2x `AND is_guest = 0` Guard |
| `server/db/index.js` | Migration `ALTER TABLE players ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0` idempotent | VERIFIED | Migration in migrations-Array vorhanden; try/catch Loop greift bei Duplikat; In-Memory-Test: is_guest Spalte nach Migration vorhanden |
| `server/routes/players.js` | GET gibt is_guest zurück; POST nimmt is_guest entgegen | VERIFIED | GET: `SELECT id, name, emoji, is_guest FROM players WHERE archived = 0 ORDER BY id ASC`; POST: INSERT mit `(name, emoji, is_guest) VALUES (?, ?, ?)`, Coercion `is_guest ? 1 : 0`, Response enthält `is_guest: guestFlag` |
| `server/routes/abende.js` | Guest-Archive UPDATE in POST /:id/end nach 404-Check | VERIFIED | Exakter SQL-String vorhanden; Positions-Reihenfolge verifiziert (abend UPDATE → 404 Guard → guest archive → res.json) |
| `public/index.html` | Gast-Checkbox, async addSpieler(), (Gast)-Label in 4 Render-Punkten | VERIFIED | Alle 5 Kriterien erfüllt (Checkbox, async, fetch, is_guest Body, 5x Ternary, kein mkSp(Date.now())) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `stats.js /api/stats` | `winners.length === 0 + AND is_guest = 0` | Drop-in replacement | VERIFIED | Z.59 + Z.19 |
| `stats.js /api/stats/year` | `for (const w of winners) winsMap[w.playerId]++` | Loop über alle Gewinner | VERIFIED | Z.206 + Z.209-211 |
| `stats.js /api/stats/h2h` | `winners.some(w => w.playerId === a/b)` als zwei unabhängige ifs | Multi-Winner-Check | VERIFIED | Z.327-328; kein `else if` Muster vorhanden |
| `public/index.html addSpieler()` | POST /api/players mit is_guest | fetch mit same-origin Session | VERIFIED | Z.833; `fetch('/api/players',{method:'POST',...,body:JSON.stringify({...,is_guest:isGast})})` |
| `public/index.html renderSpielerListe/BK/VG/FJ` | (Gast)-Suffix | `s.is_guest?s.name+' (Gast)':s.name` | VERIFIED | 5 Occurrences: Z.834, Z.1263, Z.1386, Z.1416 (2x FJ) |
| `server/routes/abende.js POST /:id/end` | UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0 | db.prepare().run() nach abend-UPDATE | VERIFIED | Z.160; nach 404-Guard, vor res.json |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `public/index.html renderSpielerListe` | `S.spieler[n].is_guest` | `fetch('/api/players')` → `S.spieler = await playersRes.json()` (Z.374-375) | Yes — DB query `SELECT id, name, emoji, is_guest FROM players WHERE archived = 0` | FLOWING |
| `public/index.html renderBKWahl/VGWahl/FJWahl` | `s.is_guest` | gleiche `S.spieler` Quelle | Yes — API response enthält is_guest Feld aus DB | FLOWING |
| `server/routes/stats.js /api/stats` | `players` array (ohne Gäste) | `FROM players WHERE archived = 0 AND is_guest = 0` | Yes — DB query filtert Gäste | FLOWING |
| `server/routes/stats.js /api/stats/year` | `leaderboard` array | `FROM players WHERE archived = 0 AND is_guest = 0` + winsMap via multi-winner loop | Yes — echte DB-Queries | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| stats.js syntax | `node -c server/routes/stats.js` | exit 0 | PASS |
| db/index.js syntax | `node -c server/db/index.js` | exit 0 | PASS |
| players.js syntax | `node -c server/routes/players.js` | exit 0 | PASS |
| abende.js syntax | `node -c server/routes/abende.js` | exit 0 | PASS |
| isDraw === 0 count (non-comment) | node -e grep test | 4 occurrences | PASS |
| isDraw !== 1 count (non-comment) | node -e grep test | 0 occurrences | PASS |
| for..of winners loop in /year | node -e regex test | true | PASS |
| winners.some(a) + winners.some(b) in /h2h | node -e regex test | both true | PASS |
| no legacy winsMap[winners[0]] | node -e regex test | absent | PASS |
| guest guards in player SELECTs (count) | node -e regex test | 2 | PASS |
| unguarded player SELECTs | node -e regex test | 0 | PASS |
| is_guest migration in db/index.js | node -e regex test | true | PASS |
| idempotency (try/catch pattern) | node -e regex test | true | PASS |
| is_guest column after in-memory migration | node DB_PATH=:memory: test | present | PASS |
| GET players.js SELECT includes is_guest | node -e regex test | true | PASS |
| POST players.js INSERT includes is_guest | node -e regex test | true | PASS |
| POST coercion is_guest ? 1 : 0 | node -e regex test | true | PASS |
| POST response includes is_guest | node -e regex test | true | PASS |
| Guest archive UPDATE present in abende.js | node -e regex test | true | PASS |
| Archive after abend UPDATE (position check) | node -e index comparison | idx 6544 > 6260 | PASS |
| Archive after 404 check (position check) | node -e index comparison | idx 6544 > 6404 | PASS |
| Archive before res.json (position check) | node -e index comparison | idx 6544 < 6586 | PASS |
| m-sp-gast checkbox in index.html | node -e regex test | true | PASS |
| async function addSpieler | node -e regex test | true | PASS |
| fetch('/api/players') present | node -e regex test | true | PASS |
| is_guest:isGast in body | node -e regex test | true | PASS |
| checkbox reset after submit | node -e regex test | true | PASS |
| old mkSp(Date.now()) absent | node -e regex test | absent | PASS |
| (Gast) ternary count | node -e regex test | 5 (>= 5) | PASS |
| Git commits referenced in SUMMARYs exist | git cat-file | all 4 exist | PASS |

### Probe Execution

Not applicable — no probe scripts defined for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STATS-01 | 10-01 | VG/FJ Team-Siege als individuelle Siege zählen | SATISFIED | `winners.length === 0` in 4 Endpoints; multi-winner loop + H2H .some() |
| STATS-02 | 10-01 | Historische Spiele rückwirkend korrekt (recomputed) | SATISFIED | Stats query-time computed — kein DB-State; kostenlos nach Code-Fix |
| GUEST-01 | 10-02 | Gastkegler erstellen | SATISFIED | DB-Migration + POST /api/players mit is_guest + Frontend-Checkbox |
| GUEST-02 | 10-02 | Gastkegler in Spielerauswahl mit "(Gast)"-Label | SATISFIED | 5x Ternary in renderSpielerListe + BK/VG/FJ Modals |
| GUEST-03 | 10-01 + 10-02 | Gastkegler aus Statistiken ausgeschlossen | SATISFIED | `AND is_guest = 0` in 2 Player-SELECTs in stats.js |
| GUEST-04 | 10-02 | Gastkegler beim Abend-Ende auto-archiviert | SATISFIED | `UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0` in abende.js |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/routes/stats.js` | 76 | `// ... VG/FJ return 0 as placeholder` | Info | Kommentar im Code — kein Problem, nur Dokumentation des Score-Verhaltens; kein Code-Stub |
| `public/index.html` | 172, 189, 190, 288, 298-299, 423, 2357 | `placeholder="..."` HTML-Attribut | Info | HTML-Input-Platzhalter — kein Code-Stub; normale UI-Praxis |
| `server/routes/abende.js` | 78 | `const isDraw = winners.length !== 1;` | WARNING | `/api/abende/last-summary` Endpoint verwendet noch die alte isDraw-Semantik. Dies betrifft (a) `winner_name` in der Spielliste des Rückblicks (zeigt nur einen Namen auch bei Team-Siegen) und (b) die per-Abend Siege-Zählung in der Rückblick-Karte (`playerStatsMap.wins`). Dies ist KEIN Leaderboard (SC-1/2 beziehen sich explizit auf "im Leaderboard"), aber es ist semantisch inkonsistent. |

**Debt-marker gate:** Keine TBD, FIXME oder XXX Marker in modifizierten Dateien gefunden. Gate PASS.

### Human Verification Required

#### 1. VG-Team-Sieg im Leaderboard verifizieren

**Test:** Starte ein Viergewinnt-Spiel mit 4 Spielern (2 vs. 2), lass Team X gewinnen. Öffne dann `/api/stats/year` und `/api/stats`.
**Expected:** Beide Spieler des gewinnenden X-Teams erscheinen mit +1 Sieg im Jahres-Leaderboard. Team O erscheint mit +0 Siegen (Verlust). Kein "draw" für Team-Sieg.
**Why human:** Benötigt laufenden Server mit Spielzustand in echter SQLite-DB; Browsertest des Leaderboards.

#### 2. Gastkegler End-to-End-Flow

**Test:** (a) Öffne den "Spieler hinzufügen"-Dialog. (b) Gib einen Namen ein, wähle ein Emoji, aktiviere "Gast?"-Checkbox. (c) Klicke "Hinzufügen". (d) Starte ein BK-Spiel, überprüfe dass der Gast in der Spielerauswahl mit "(Gast)"-Label erscheint. (e) Beende den Abend.
**Expected:** (a) Checkbox mit Label "Gast? (wird nach Abend archiviert)" ist sichtbar. (b) Gastspieler erscheint sofort in der Spielerliste mit "(Gast)"-Suffix — keine Seiten-Reload nötig. (c) Nach Abend-Ende: `GET /api/players` gibt den Gast nicht mehr zurück (`archived=1`). Spieldaten in `game_players` bleiben erhalten.
**Why human:** Browser-UI-Interaktion + Checkbox-Rendering + Label-Rendering in 4 Modals + Abend-Ende-Flow.

#### 3. Gastkegler im Leaderboard-Ausschluss

**Test:** Spiele einen Abend mit einem Gastspieler, öffne `/api/stats` und `/api/stats/year`.
**Expected:** Der Gastspieler erscheint NICHT im `players[]` Array der Stats-Response — auch nicht wenn er Spiele gewonnen hat.
**Why human:** Benötigt laufenden Server mit Gastkegler-Spieldaten.

#### 4. Abend-Rückblick-Karte — VG-Sieg Anzeige (WARNING-Scope-Entscheidung)

**Test:** Beende einen Abend mit einem VG-Team-Sieg (2 Sieger). Schaue auf die "Letzte Abend"-Rückblick-Karte auf der Startseite. Prüfe die Siege-Spalte der Spieler-Tabelle im Rückblick.
**Expected nach aktueller Implementierung:** In der Rückblick-Karte zeigt nur maximal 1 Spieler einen "Sieg" für das VG-Spiel — das ist die alte Logik in `/api/abende/last-summary` (Zeile 78: `winners.length !== 1`). Diese Diskrepanz ist scope-bedingt (Phase 10 fixte nur `stats.js`, nicht `abende.js`).
**Entscheidung erforderlich:** Ist dieser Rückblick-Bug akzeptabel (abende.js nicht in Scope von STATS-01), oder soll er im Nachgang auch gefixt werden?
**Why human:** Sichtprüfung der Rückblick-Karte; Developer-Entscheidung über Scope-Ausweitung.

### Gaps Summary

Alle 6 Roadmap Success Criteria sind in der Codebasis verifiziert. Keine BLOCKER-Gaps.

**Einziger gefundener Befund außerhalb des expliziten Scopes:** `/api/abende/last-summary` in `server/routes/abende.js` (Zeile 78) verwendet noch `winners.length !== 1` für die per-Abend Siegesberechnung in der Rückblick-Karte. Dies war nicht im Scope von Phase 10 (PLAN 10-01 definierte explizit nur 4 Endpoints in `stats.js`), und die ROADMAP Success Criteria beziehen sich auf "Leaderboard" (nicht Rückblick). Es ist ein WARNING — keine BLOCKER für die Phase-Ziele. Eine Follow-up-Task oder Scope-Entscheidung wird empfohlen.

---

_Verified: 2026-06-15T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
