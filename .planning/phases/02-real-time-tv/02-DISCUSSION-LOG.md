# Phase 2: Real-Time & TV - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 02-real-time-tv
**Areas discussed:** TV display layout, Undo UX & API, Socket.io subscription model, Schema migration

---

## TV Display Layout

### Player Arrangement

| Option | Description | Selected |
|--------|-------------|----------|
| Vollbreite Zeilen | Jeder Spieler bekommt eine volle Zeile: Name links, Punkte rechts. Einfach, gut lesbar bei beliebig vielen Spielern. | ✓ |
| Kacheln / Grid | Spieler als große Kacheln (2×3 oder 3×4). Sieht moderner aus. | |
| You decide | Planer entscheidet basierend auf Theme und Spieleranzahl (3–6). | |

**User's choice:** Vollbreite Zeilen

---

### Aktueller Spieler Hervorhebung

| Option | Description | Selected |
|--------|-------------|----------|
| Goldener Rahmen / Border | Die Zeile des aktuellen Spielers bekommt einen goldenen Rahmen (#e8b84b). | |
| Heller Hintergrund der Zeile | Die aktive Zeile hat einen hellen Hintergrund (goldenes Overlay), der Rest bleibt dunkel. | ✓ |
| Pfeil / Icon links | Ein Pfeil oder 🎯-Icon links neben dem Spielernamen zeigt an, wer dran ist. | |
| You decide | Planer wählt passend zum Dark Gold Theme. | |

**User's choice:** Heller Hintergrund der Zeile

---

### Letzter Wurf Anzeige

| Option | Description | Selected |
|--------|-------------|----------|
| Große Einblendung oben/unten (kurz) | "[Name]: 7" erscheint für 3–5 Sekunden groß eingeblendet, dann weg. | |
| Dauerhaft in der Spielerzeile sichtbar | Separate "Letzter Wurf"-Spalte in jeder Zeile, immer sichtbar. | ✓ |
| Nur aktueller Spieler zeigt letzten Wurf | Nur die hervorgehobene Zeile zeigt zusätzlich den letzten Wert. | |
| You decide | Planer entscheidet. | |

**User's choice:** Dauerhaft in der Spielerzeile sichtbar

---

### Idle Screen Inhalt

| Option | Description | Selected |
|--------|-------------|----------|
| Clubname + letzter Sieger (ROADMAP-Standard) | Groß: "Pegelköpp" + darunter "Letzter Sieger: [Name]". Schlicht. | ✓ |
| Clubname + letzter Sieger + Datum | Wie oben, plus Datum des letzten Kegelabends. | |
| You decide | Planer gestaltet den Idle-Screen. | |

**User's choice:** Clubname + letzter Sieger (ROADMAP-Standard)

---

## Undo UX & API

### Undo Button Platzierung

| Option | Description | Selected |
|--------|-------------|----------|
| Im Spielbereich, direkt sichtbar | Immer sichtbar im Spielformular sobald >= 1 Wurf eingegeben. | ✓ |
| Als Toast / Snackbar nach jedem Wurf | Erscheint kurz (5 Sek.) nach jedem Wurf als Popup. | |
| You decide | Planer platziert den Button sinnvoll. | |

**User's choice:** Im Spielbereich, direkt nach dem Eintippen sichtbar

---

### Undo Bestätigung

| Option | Description | Selected |
|--------|-------------|----------|
| Sofort (kein Dialog) | Tap → Wurf weg, kein "Bist du sicher?". Schnell. | |
| Kurze Bestätigung (1 Tap) | Undo-Button zeigt "Wirklich rückgängig?", zweiter Tap bestätigt. | ✓ |

**User's choice:** Kurze Bestätigung (1 Tap)

---

### TV Reaktion auf Undo

| Option | Description | Selected |
|--------|-------------|----------|
| Stilles Update | TV zeigt einfach den korrigierten Spielstand, kein visueller Effekt. | ✓ |
| Kurzer visueller Flash | Die geänderte Zeile blinkt kurz auf (roter Overlay 0,5 Sek.) | |
| You decide | Planer entscheidet. | |

**User's choice:** Stilles Update — TV aktualisiert sich ohne Sondereffekt

---

## Socket.io Subscription Model

### TV Game Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| TV abonniert immer das aktive Spiel automatisch | Server schickt aktuellen State auf connect, TV switcht automatisch bei game:started. | ✓ |
| TV-URL enthält Spiel-ID (/tv/42) | Bediener öffnet /tv/42 gezielt. URL muss bei neuem Spiel gewechselt werden. | |
| You decide | Planer wählt basierend auf Club-Abend-Workflow. | |

**User's choice:** TV abonniert immer das aktive Spiel automatisch

---

### Mehrere aktive Spiele gleichzeitig

| Option | Description | Selected |
|--------|-------------|----------|
| TV zeigt das zuletzt gestartete Spiel | Neueste ID gewinnt. Einfach. | ✓ |
| TV zeigt beide (Split-Screen) | Aufwändig, nicht realistisch für Kegelabend. | |
| You decide | Planer entscheidet — wahrscheinlich: neustes Spiel gewinnt. | |

**User's choice:** TV zeigt das zuletzt gestartete Spiel (höchste ID)

---

## Schema Migration (meta + fuchsjagd)

### Migrations-Ansatz

| Option | Description | Selected |
|--------|-------------|----------|
| ALTER TABLE beim Server-Start (empfohlen) | Idempotent, kein Datenverlust, try/catch auf duplicate column. | ✓ |
| Schema neu anlegen (DROP + CREATE) | Sauberer Schnitt, aber Testdaten aus Phase 1 gehen verloren. | |

**User's choice:** ALTER TABLE beim Server-Start

---

## Claude's Discretion

- **Undo API endpoint**: `POST /api/games/:id/undo` — DB-first (DELETE last throw row), recompute via `reconstructState`, emit Socket.io event
- **Socket.io event names**: `game:state`, `throw:applied`, `undo:applied`, `game:started`, `game:finished`
- **Active row background color**: `rgba(232, 184, 75, 0.15)` (gold at 15% opacity)
- **TV page delivery**: `public/tv.html` or inline route in `server/server.js`

## Deferred Ideas

- TV layout per game type (custom layouts for each of the 9 game types) → v2 backlog
- Multi-step undo history → v2 (PLAY-01 specifies single-step only)
