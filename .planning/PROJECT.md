# Pegelköpp — Kegelclub App

## What This Is

**Pegelköpp** ist eine mitgliederinterne Web-App für einen Kegelclub (9-Kegel). Sie dient als digitale Spielleitung am Kegelabend: Ergebnisse werden auf einem zentralen Tablet oder per Handy eingetragen, ein angeschlossener Fernseher zeigt live den Spielstand. Alle Daten werden auf einem VPS gespeichert, sodass Spielerprofile, Ergebnisse und Statistiken dauerhaft erhalten bleiben und geräteübergreifend verfügbar sind.

**Shipped v1.0:** App live at https://kegel.pegelkoepp.de — all 9 game types, real-time TV display, club sessions, statistics, and HTTPS deployment on Netcup VPS.

## Core Value

**Ein Tablet tippt, der Fernseher zeigt es sofort — live, ohne Reload.**

*Validated in v1.0: < 2 second latency confirmed in human verification, wss:// via Nginx confirmed in production.*

## Context

- **Stack:** Node.js 22 + Express 4 + Socket.io 4 + SQLite (better-sqlite3) + PM2 + Nginx + Certbot
- **Codebase:** ~11,000 lines added across 50 files; 194 tests passing
- **Production:** https://kegel.pegelkoepp.de, Netcup VPS (Debian 12, IP 94.16.108.174)
- **Process manager:** PM2 via pm2-root.service (systemd), auto-starts on reboot
- **Backup:** Daily SQLite backup cron to /root/pegelkoepp/backups/
- **Zielgerät:** Mobile-first (Tablet / Handy für Eingabe), TV-Browser für die Anzeigeseite

## Who It's For

Mitglieder des Kegelclubs "Pegelköpp":
- **Eingabe-Person:** Trägt Würfe während des Spiels per Tablet oder Handy ein
- **Zuschauer / TV:** Sehen live die aktuellen Ergebnisse auf dem Fernseher (HDMI/Browser)
- **Alle Mitglieder:** Blättern durch vergangene Spiele, Spielerstatistiken, Ranglisten

## Current Milestone: v2.0 Statistiken, Highlights & Turnierbaum

**Goal:** Die App wird zur vollständigen Kegelclub-Plattform — mit Turnieren, Highlights und tiefen Statistiken.

**Target features:**
- Jahres-Leaderboard (Top-Spieler pro Kalenderjahr)
- Win-Streak-Tracking pro Spieler
- Head-to-Head-Statistiken zwischen zwei Spielern
- Historische Kegler-des-Abends-Zählung & Bilderkegeln-Verlierer-Zählung pro Spieler
- Kegler des Abends: Symbol in Tabelle + TV-Overlay am Spielende
- Bilderkegeln-Verlierer: Symbol in Tabelle + TV-Overlay (wer wenigste Punkte hat)
- "Kegler des Abends" Spieltyp erweitern um Loser Bracket (Double-Elimination, variabel 4–12 Spieler)
- TV-Layout-Varianten pro Spieltyp
- WhatsApp-Share-Link für abgeschlossene Spielergebnisse
- Self-hosted Fonts (Bebas Neue / DM Sans) für Offline-Venue-Betrieb

## Requirements

### Validated (v1.0)

- ✓ Alle 9 Spieltypen mit Spiellogik — existing (kegelclub_12.html) + v1.0 backend
- ✓ Spielerverwaltung (hinzufügen, Emoji, Profil) — existing + v1.0 API
- ✓ Spieleliste und Spielbibliothek — existing + v1.0 API
- ✓ Statistik-Ansicht pro Spieler (wins/losses/Pudel%) — v1.0
- ✓ Persönliche Bestleistungen pro Spieltyp — v1.0
- ✓ Mobile-first Dark-Theme UI — existing
- ✓ Datenpersistenz: Spieler, Spiele, Ergebnisse dauerhaft in SQLite — v1.0
- ✓ Echtzeit-TV-Anzeigemodus (< 2s latency, auto-reconnect) — v1.0
- ✓ WebSocket-Sync: Tablet → TV ohne Reload — v1.0
- ✓ PIN-Authentifizierung (shared PIN, session-based) — v1.0
- ✓ Backend-API: REST für alle Spieltypen und Spielerverwaltung — v1.0
- ✓ Kegelabend-Sessions (gruppierende Spieleinheiten) — v1.0
- ✓ Eigene Spieltypen anlegen und dauerhaft speichern — v1.0
- ✓ Deployment auf VPS: HTTPS, PM2, Nginx, crash recovery — v1.0

### Active (v2.0)

- [ ] Jahres-Leaderboard (Top-Spieler pro Kalenderjahr)
- [ ] Win-Streak-Tracking pro Spieler
- [ ] Head-to-Head-Statistiken zwischen zwei Spielern
- [ ] Historische Kegler-des-Abends-Zählung pro Spieler
- [ ] Historische Bilderkegeln-Verlierer-Zählung pro Spieler
- [ ] Kegler des Abends: Symbol in Tabelle + TV-Overlay am Spielende
- [ ] Bilderkegeln-Verlierer: Symbol in Tabelle + TV-Overlay (wer wenigste Punkte hat)
- [ ] "Kegler des Abends" Spieltyp: Loser Bracket (Double-Elimination, variabel 4–12 Spieler)
- [ ] TV-Layout-Varianten pro Spieltyp
- [ ] WhatsApp-Share-Link für abgeschlossene Spielergebnisse
- [ ] Self-hosted Fonts (Bebas Neue / DM Sans) für Offline-Venue-Betrieb

### Out of Scope

- Einzelne Accounts pro Mitglied — PIN für alle reicht, spart Komplexität
- Mobile Push-Notifications — kein Bedarf für jetzt
- Öffentliche Vereins-Homepage — rein intern
- Bowling (10 Pin) — ausschließlich 9-Kegel
- Multi-club / multi-tenant — Single-Club-App
- PDF export — share link ist geplant (v2)
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

## What Done Looks Like

1. ✅ Kegelabend startet → Spieler wählen → Spiel beginnen auf Tablet
2. ✅ Jeder Wurf wird eingetippt → erscheint in <2s auf dem Fernseher
3. ✅ Spielende → Ergebnis gespeichert, Statistiken aktualisiert
4. ✅ Nächster Abend → alle Spieler und vergangene Spiele sind noch da
5. ✅ Abend gruppiert → alle Spiele eines Abends zusammen sichtbar

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
*Last updated: 2026-05-22 — Milestone v2.0 started (Statistiken, Highlights & Turnierbaum)*
