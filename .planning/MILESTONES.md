# Milestones — Pegelköpp Kegelclub App

## v1.0 MVP — Shipped 2026-05-22

**Phases:** 1–5 | **Plans:** 15 | **Tests:** 194 | **Duration:** 3 days (2026-05-20 → 2026-05-22)  
**Git:** 72 commits, 50 files, ~11,000 lines  
**Production:** https://kegel.pegelkoepp.de

**Delivered:** Full-stack club bowling app with real-time TV display (< 2s latency), all 9 game types persisted, club-night sessions, statistics, and live HTTPS deployment on Netcup VPS.

### Key Accomplishments

1. Scaffold, SQLite WAL, PIN auth, player CRUD, and crash recovery REST API — 153 tests green in Phase 1
2. Socket.io throw sync: tablet input → TV display < 2 seconds, auto-reconnect, connection dot — Phase 2
3. Full-screen TV display (72px scores / 36px names, gold overlay, idle + last winner) — Phase 2
4. All 9 game types wired end-to-end through the existing frontend UI with server-persisted state — Phase 3
5. Kegelabend sessions, per-player stats (wins/losses, Pudel%, personal bests), and custom game types — Phase 4
6. Live on HTTPS at kegel.pegelkoepp.de — Nginx + Certbot + PM2 + crash recovery + daily backup — Phase 5

### Requirements Coverage

23/23 v1.0 requirements complete. See [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md).

### Archive

- [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) — Full phase details
- [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) — All requirements with evidence

---

## v2.0 Statistiken, Highlights & Turnierbaum — Shipped 2026-05-27

**Phases:** 6–9 | **Plans:** 20 | **Tests:** 433 | **Duration:** 5 days (2026-05-22 → 2026-05-27)
**Git:** 121 commits, 158 files changed, +25,297 lines
**Production:** https://kegel.pegelkoepp.de

**Delivered:** Tournament engine (Double-Elimination KDA), TV highlights + 9 game-type TV layouts, deep statistics (streaks, H2H, leaderboard, historical awards), recap card, WhatsApp share, and self-hosted fonts for offline venue operation.

### Key Accomplishments

1. Double-Elimination bracket engine for "Kegler des Abends" (4–12 players) with live TV bracket tree — Phase 6
2. End-game TV overlays (winner/loser) + dedicated TV renderers for all 9 game types — Phase 7
3. Year leaderboard, win streaks, head-to-head, KDA/BK historical counts (7 new stat endpoints) — Phase 8
4. Last-evening recap card on homepage with collapsible game list — Phase 8
5. WhatsApp share link for finished game results — Phase 9
6. Self-hosted fonts (Bebas Neue, DM Sans, Pirata One) — no Google CDN required at venue — Phase 9

### Requirements Coverage

17/17 v2.0 requirements complete. See [milestones/v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md).

### Archive

- [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) — Full phase details
- [milestones/v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md) — All requirements with outcomes

---

## v3.0 Spielerprofile, Gastkegler & Realabend-Fixes — Shipped 2026-06-17

**Phases:** 10–12 | **Plans:** 6 | **Duration:** 2 days (2026-06-15 → 2026-06-17)
**Production:** https://kegel.pegelkoepp.de

**Delivered:** Profilbilder (Upload, Tablet, TV Idle + alle Spieltyp-Renderer), Gastkegler (temporäre Spieler, auto-archiviert), korrekte Team-Statistiken (VG/FJ-Siege), TV-Layout-Polish für alle 9 Spieltypen auf Samsung TV (position:fixed Pattern + DPR=2 Fix).

### Key Accomplishments

1. isDraw-Fix in 4 Stats-Endpoints: VG/FJ-Siege zählen für alle Teammitglieder — rückwirkend ohne Migration (Phase 10)
2. Gastkegler: is_guest DB-Column, (Gast)-Label in 5 Render-Punkten, Leaderboard-Ausschluss, Auto-Archiv beim Abend-Ende (Phase 10)
3. Profilbild-Upload (5 MB JPEG/PNG, magic-byte-Validierung, express.raw route-scoped) mit img+emoji Overlay-Pattern (Phase 11)
4. TV Idle Player-Grid (80px Avatare) + 40px Avatar in Generic Renderer + alle 7 Spieltyp-Renderer (Phase 11)
5. position:fixed + topPad Fix-Pattern für alle 9 TV-Renderer — kein Abschneiden mehr bei voller Spieleranzahl (Phase 12)
6. Samsung TV DPR=2 Fix: viewport width=1920 + isCompact-Sizing; KDA immer gestapelt (W oben / L unten) nach Realabend-UAT (Phase 12)

### Requirements Coverage

12/12 v3.0 requirements complete. See [milestones/v3.0-REQUIREMENTS.md](milestones/v3.0-REQUIREMENTS.md).

Known deferred items at close: 7 (see STATE.md Deferred Items)

### Archive

- [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) — Full phase details
- [milestones/v3.0-REQUIREMENTS.md](milestones/v3.0-REQUIREMENTS.md) — All requirements with outcomes
