# Pegelköpp — Kegelclub App

## What This Is

**Pegelköpp** ist eine mitgliederinterne Web-App für einen Kegelclub (9-Kegel). Sie dient als digitale Spielleitung am Kegelabend: Ergebnisse werden auf einem zentralen Tablet oder per Handy eingetragen, ein angeschlossener Fernseher zeigt live den Spielstand. Alle Daten werden auf einem VPS gespeichert, sodass Spielerprofile, Ergebnisse und Statistiken dauerhaft erhalten bleiben und geräteübergreifend verfügbar sind.

**Shipped v1.0:** App live at https://kegel.pegelkoepp.de — all 9 game types, real-time TV display, club sessions, statistics, and HTTPS deployment.

**Shipped v2.0:** Tournament engine (KDA Double-Elimination), highlights & TV layouts for all game types, deep statistics (streaks, H2H, leaderboard, historical award counts), last-evening recap, WhatsApp share, self-hosted fonts.

**Shipped v3.0:** Profilbilder (Tablet + TV), Gastkegler (temporäre Spieler), korrekte Team-Statistiken (VG/FJ-Siege), TV-Layout-Polish für alle 9 Spieltypen auf Samsung TV.

## Core Value

**Ein Tablet tippt, der Fernseher zeigt es sofort — live, ohne Reload.**

*Validated in v1.0: < 2 second latency confirmed in human verification, wss:// via Nginx confirmed in production.*

## Context

- **Stack:** Node.js 22 + Express 4 + Socket.io 4 + SQLite (better-sqlite3) + PM2 + Nginx + Certbot
- **Codebase:** ~15,000 lines across ~65 files; 433 tests passing
- **Production:** https://kegel.pegelkoepp.de, Netcup VPS (Debian 12, IP 94.16.108.174)
- **Process manager:** PM2 via pm2-root.service (systemd), auto-starts on reboot
- **Backup:** Daily SQLite backup cron to /root/pegelkoepp/backups/
- **Fonts:** Self-hosted (Bebas Neue, DM Sans, Pirata One) at /fonts/ — no CDN dependency
- **Zielgerät:** Mobile-first (Tablet / Handy für Eingabe), TV-Browser für die Anzeigeseite

## Who It's For

Mitglieder des Kegelclubs "Pegelköpp":
- **Eingabe-Person:** Trägt Würfe während des Spiels per Tablet oder Handy ein
- **Zuschauer / TV:** Sehen live die aktuellen Ergebnisse auf dem Fernseher (HDMI/Browser)
- **Alle Mitglieder:** Blättern durch vergangene Spiele, Spielerstatistiken, Ranglisten, Leaderboard

## Requirements

### Validated (v1.0)

- ✓ Alle 9 Spieltypen mit Spiellogik — v1.0
- ✓ Spielerverwaltung (hinzufügen, Emoji, Profil) — v1.0
- ✓ Spieleliste und Spielbibliothek — v1.0
- ✓ Statistik-Ansicht pro Spieler (wins/losses/Pudel%) — v1.0
- ✓ Persönliche Bestleistungen pro Spieltyp — v1.0
- ✓ Mobile-first Dark-Theme UI — v1.0
- ✓ Datenpersistenz: Spieler, Spiele, Ergebnisse dauerhaft in SQLite — v1.0
- ✓ Echtzeit-TV-Anzeigemodus (< 2s latency, auto-reconnect) — v1.0
- ✓ WebSocket-Sync: Tablet → TV ohne Reload — v1.0
- ✓ PIN-Authentifizierung (shared PIN, session-based) — v1.0
- ✓ Backend-API: REST für alle Spieltypen und Spielerverwaltung — v1.0
- ✓ Kegelabend-Sessions (gruppierende Spieleinheiten) — v1.0
- ✓ Eigene Spieltypen anlegen und dauerhaft speichern — v1.0
- ✓ Deployment auf VPS: HTTPS, PM2, Nginx, crash recovery — v1.0

### Validated (v2.0)

- ✓ Jahres-Leaderboard (Top-Spieler pro Kalenderjahr) — v2.0
- ✓ Win-Streak-Tracking pro Spieler — v2.0
- ✓ Head-to-Head-Statistiken zwischen zwei Spielern — v2.0
- ✓ Historische Kegler-des-Abends-Zählung pro Spieler — v2.0
- ✓ Historische Bilderkegeln-Verlierer-Zählung pro Spieler — v2.0
- ✓ Kegler des Abends: Symbol in Tabelle + TV-Overlay am Spielende — v2.0
- ✓ Bilderkegeln-Verlierer: Symbol in Tabelle + TV-Overlay — v2.0
- ✓ "Kegler des Abends": Loser Bracket (Double-Elimination, variabel 4–12 Spieler) — v2.0
- ✓ TV-Layout-Varianten pro Spieltyp (alle 9 Spieltypen) — v2.0
- ✓ WhatsApp-Share-Link für abgeschlossene Spielergebnisse — v2.0
- ✓ Self-hosted Fonts für Offline-Venue-Betrieb — v2.0

### Validated (v3.0)

- ✓ Profilbilder pro Spieler (hochladen, speichern, anzeigen, TV-Idle + TV-Game) — v3.0
- ✓ Gastkegler: temporäre Spieler ohne festen Account, auto-archiviert nach Abend — v3.0
- ✓ Team-Gewinner-Statistik (VG/FJ): alle Teammitglieder erhalten Sieg, historisch korrekt — v3.0
- ✓ Fuchsjagd TV: skaliert für bis zu 11 Jäger, 3-stufiges Scaling, kein Abschneiden — v3.0
- ✓ KDA TV Bracket: Großes Finale erst bei Finalisten, W oben / L unten gestapelt — v3.0

### Active (v4.0)

(Keine aktiven Requirements — /gsd-new-milestone starten)

### Deferred (post-v3.0)

- [ ] Letzter Abend: automatische Benachrichtigung / Push nach Abend-Ende
- [ ] Monatliches Leaderboard (derzeit nur Jahres-Leaderboard)
- [ ] Spieler-Detailseite: Verlaufsgraph der Siege über Zeit

### Out of Scope

- Einzelne Accounts pro Mitglied — PIN für alle reicht, spart Komplexität
- Mobile Push-Notifications — kein Bedarf für jetzt
- Öffentliche Vereins-Homepage — rein intern
- Bowling (10 Pin) — ausschließlich 9-Kegel
- Multi-club / multi-tenant — Single-Club-App
- PDF export — WhatsApp share link deckt den Bedarf
- Docker — PM2 + systemd ist das richtige Tool für Single-VPS

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Backend: Node.js + Express | Passt zu bestehender JS-Codebasis, kein Sprachwechsel | ✓ Bewährt — kein Reibungsverlust |
| Echtzeit: Socket.io 4 | Auto-reconnect, Rooms, HTTP fallback — nötig für TV-Zuverlässigkeit | ✓ < 2s bestätigt; wss:// in Produktion |
| Datenbank: SQLite (better-sqlite3) | Single-writer Club-App; kein Overhead von PostgreSQL | ✓ Richtig — WAL, < 5 MB, kein Daemon |
| Bestehende HTML weiterentwickeln, nicht neu schreiben | Design + Spiellogik bereits fertig und bewährt | ✓ Bewährt — Risiko minimiert |
| DB-first throw persistence | Crash recovery non-negotiable; INSERT before applyThrow | ✓ Crash recovery verified in production |
| textContent-only XSS guard | Hard constraint for TV and frontend; no innerHTML for DB strings | ✓ Consistent across all phases |
| SQLite WAL mode | Two-line fix; concurrent reads without writer contention | ✓ Mandatory from day 1 |
| Trust proxy = 1 | Enables Secure cookie flag behind Nginx | ✓ Required; without it PIN login was broken |
| PM2 fork mode (not cluster) | SQLite single-writer; cluster adds WAL contention | ✓ Correct for single-VPS SQLite |
| VPS-Deployment: Nginx + Certbot + PM2 | User hat bereits Netcup-VPS; kein Docker-Overhead | ✓ Live — certbot.timer auto-renews |
| TV renderGame: bracket BEFORE players guard | KDA has bracket not players; guard order matters | ✓ All 9 game types render correctly post v2.0 |
| submitKDAWurfe sequential await | Each throw must complete before next (race condition Pitfall 2) | ✓ No race conditions in bracket progression |
| getBKLoserId in highlights.js | Shared by stats + abende routes — single source of truth | ✓ No duplication; consistent BK loser logic |
| ORDER BY id ASC for game iteration | BK exemption chain requires chronological order | ✓ Correct exemption logic across restarts |
| Self-host fonts (6 woff2 committed) | Venue may have no internet — must work offline | ✓ No CDN dependency; ~129 KB committed |
| winners.length === 0 als isDraw | !== 1 war falsch: 2-Winner-Teams galten als Unentschieden | ✓ VG/FJ-Siege korrekt in allen 4 Stats-Endpoints |
| Guest-Ausschluss auf player-SELECT-Ebene | winsMap akkumuliert Guests, gibt sie aber nie aus | ✓ Gastkegler nie im Leaderboard (v3.0) |
| express.raw() route-scoped (nicht global) | Globales raw() bricht JSON-Parsing auf anderen Routes | ✓ Upload-Route isoliert, alle anderen Routes unberührt |
| img+emoji Overlay-Pattern | onerror versteckt img → Emoji als Fallback sichtbar | ✓ Kein broken-image-icon, kein leeres Feld (v3.0) |
| position:fixed auf TV-Renderer-Containern | #game{padding:2vw} verschiebt Content ohne fixed | ✓ Alle 9 TV-Layouts zeigen volle Spieleranzahl (v3.0) |
| viewport width=1920 statt device-width | Samsung TV DPR=2 → device-width gibt 960px CSS | ✓ TV-Layouts bei 1920px Breite auf Samsung TV (v3.0) |
| KDA: immer gestapelt, kein side-by-side | side-by-side nach Realabend-Test revertiert | ✓ W oben / L unten auf Samsung TV verifiziert (v3.0) |

## Shipped: v3.0 Spielerprofile, Gastkegler & Realabend-Fixes ✅

**Shipped:** 2026-06-17 | 3 Phasen, 6 Plans, 12 Requirements

**Delivered:**
- Profilbilder: Upload (5MB JPEG/PNG), Tablet-Anzeige, TV Idle-Grid + alle Spieltyp-Renderer
- Gastkegler: Checkbox-Dialog, (Gast)-Label, Leaderboard-Ausschluss, Auto-Archiv
- Team-Statistiken: isDraw-Fix in 4 Endpoints, historisch korrekt ohne Migration
- TV Polish: position:fixed + topPad Pattern für alle 9 Renderer, Samsung DPR=2 Fix

## Next Milestone

(Noch nicht geplant — /gsd-new-milestone starten)

## What Done Looks Like

1. ✅ Kegelabend startet → Spieler wählen → Spiel beginnen auf Tablet
2. ✅ Jeder Wurf wird eingetippt → erscheint in <2s auf dem Fernseher
3. ✅ Spielende → Ergebnis gespeichert, TV-Overlay, Statistiken aktualisiert
4. ✅ Nächster Abend → alle Spieler und vergangene Spiele sind noch da
5. ✅ Abend gruppiert → alle Spiele eines Abends zusammen sichtbar
6. ✅ Statistiken → Leaderboard, Streaks, H2H, KDA/BK counts, Letzter Abend
7. ✅ Turnier → KDA Double-Elimination live auf TV mit Bracket-Baum
8. ✅ Ergebnis teilen → WhatsApp-Link mit Zusammenfassung

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-17 — after v3.0 milestone (Spielerprofile, Gastkegler & Realabend-Fixes)*
