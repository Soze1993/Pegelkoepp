# Phase 10: Team-Gewinner & Gastkegler - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 10-Team-Gewinner & Gastkegler
**Areas discussed:** Gastkegler erstellen, Gastkegler archivieren, Stats-Fix Scope

---

## Gastkegler erstellen

| Option | Description | Selected |
|--------|-------------|----------|
| Gast-Checkbox im Dialog | Bestehender "Spieler hinzufügen"-Dialog bekommt eine "Gast?"-Checkbox. Ein Klick reicht — gleiche Fläche, kein neues UI-Element. | ✓ |
| Separater "Gast hinzufügen" Button | Eigener Button in der Spielerliste, der direkt einen Gast-Dialog öffnet. Deutlich getrennt von echten Spielern. | |

**User's choice:** Gast-Checkbox im Dialog (Empfohlen)
**Notes:** Einfachste Lösung, kein neues UI-Element nötig.

| Option | Description | Selected |
|--------|-------------|----------|
| Hinter dem Namen: 'Max (Gast)' | Kompakt, funktioniert in allen Kontexten (Spielerauswahl, Tablet, TV-Liste). | ✓ |
| Badge/Chip vor dem Namen | Visuell auffälliger, braucht aber neues CSS für das Badge-Element. | |

**User's choice:** `"Name (Gast)"` — Text hinter dem Namen
**Notes:** textContent-Pattern, kein Badge nötig.

---

## Gastkegler archivieren

| Option | Description | Selected |
|--------|-------------|----------|
| Alle unarchvierten Gäste im System | UPDATE players SET archived=1 WHERE is_guest=1 AND archived=0. Einfach, immer korrekt — da nur ein offener Abend gleichzeitig existiert. | ✓ |
| Nur Gäste die in diesem Abend gespielt haben | JOIN auf game_players+games WHERE abend_id=:id. Präziser: Gast erstellt aber nie gespielt bleibt aktiv. | |

**User's choice:** Alle unarchvierten Gäste
**Notes:** Da nur ein offener Abend gleichzeitig existiert, sind beide Optionen in der Praxis äquivalent. Simple Query bevorzugt.

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, Spieldaten bleiben erhalten | archived=1 versteckt den Gast aus aktiven Listen, aber game_players/throws bleiben unverändert. | ✓ |
| Nein, Spieldaten mitlöschen | Entspricht nicht dem ROADMAP (GUEST-04 explizit). | |

**User's choice:** Ja, Spieldaten bleiben erhalten
**Notes:** ROADMAP GUEST-04: "nicht gelöscht — historische Spieldaten bleiben erhalten".

---

## Stats-Fix Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Ja — konsistent mit Stats + Leaderboard | Wenn dein Team in VG/FJ gewinnt, zählt es auch für die Win-Streak. | ✓ |
| Nein — nur Stats + Leaderboard | Streaks bleiben wie bisher (VG/FJ als Draw → Streak-Reset). | |

**User's choice:** Ja — alle Endpoints konsistent fixen (inkl. Streaks)
**Notes:** Inkonsistenz wäre verwirrend.

| Option | Description | Selected |
|--------|-------------|----------|
| Ja — auch H2H konsistent fixen | Wenn beide auf demselben VG/FJ-Team gewinnen: beide bekommen wins_a++ und wins_b++. | ✓ |
| H2H bei VG/FJ skippen | VG/FJ-Spiele werden in H2H ignoriert. | |
| H2H bleibt vorerst unbefasst | Fix nur für Stats, Leaderboard, Streaks. | |

**User's choice:** Ja — auch H2H fixen. Freeform: "Ja auch wenn mehrere Spieler gewinnen (Beispielsweise die Jäger bei Fuchsjagd zählt das als Sieg)"
**Notes:** Alle Gewinner (auch mehrere) bekommen je einen Win in H2H. Implementation: `winners.some(w => w.playerId === a)` statt `winners[0].playerId === a`.

---

## Claude's Discretion

- Exaktes CSS/Layout für die Gast-Checkbox im Dialog
- Ob "(Gast)" auch auf dem TV sichtbar sein soll (nicht besprochen)
- Reihenfolge der Gäste in der Spielerliste

## Deferred Ideas

None — discussion stayed within phase scope.
