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
