# Requirements — Pegelköpp Kegelclub App

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can log in with a shared PIN and stay logged in across browser sessions
- [ ] **AUTH-02**: TV display route (`/tv`) is accessible without login — no PIN required

### Backend & Persistence

- [ ] **PERS-01**: Player profiles (name, emoji) are saved permanently in the database
- [x] **PERS-02**: All game sessions, throws, and results are stored in the database
- [ ] **PERS-03**: Custom game types created by users are saved persistently across restarts
- [ ] **PERS-04**: Games played on the same evening are grouped into a Kegelabend session

- [ ] **BACK-01**: User can manage players via API (create, edit, archive — no hard delete)
- [x] **BACK-02**: All 9 built-in game type scoring rules run on the server as pure-function modules
- [x] **BACK-03**: Every throw is written to the database immediately (active game survives server restart)

### Real-Time Sync

- [x] **RT-01**: A throw entered on tablet appears on the TV display in under 2 seconds
- [x] **RT-02**: TV display auto-reconnects after connection drop and immediately restores the current game state (no manual refresh required)
- [x] **RT-03**: A connection status indicator (dot/icon) is visible on the input device showing WebSocket state

### TV Display

- [x] **TV-01**: Dedicated `/tv` route serves a full-screen TV view with no authentication and no input elements
- [x] **TV-02**: TV shows live game state during an active game: all player scores, current player highlighted, last throw visible
- [x] **TV-03**: TV text sizes are readable at 3–5m distance (scores min 72px, player names min 36px)
- [x] **TV-04**: TV shows idle screen with club logo and last game winner when no game is running

### Gameplay

- [x] **PLAY-01**: User can undo the last entered throw during any active game (single-step undo)
- [x] **PLAY-02**: All 9 built-in game types (Vier Gewinnt, Fuchsjagd, Drei in die Vollen, Große Hausnummer, Kleine Hausnummer, Plus/Minus/Mal/Geteilt, Anker, Kegler des Abends, Bilderkegel) work with backend-connected state

### Statistics

- [ ] **STAT-01**: User can see wins and losses per player across all evenings
- [ ] **STAT-02**: User can see the best score per player per game type (personal records)
- [ ] **STAT-03**: User can see total Pudel count and Pudel percentage (Pudel ÷ total throws × 100) per player

### Deployment

- [x] **DEPLOY-01**: App is deployed on VPS and accessible via HTTPS
- [x] **DEPLOY-02**: App survives server restarts without data loss; active games are recoverable from the database

---

## v2 Requirements (deferred)

- Monthly leaderboard (top players per calendar month)
- Win streak tracking per player
- WhatsApp share link for a completed game result
- Head-to-head stats between two players
- TV layout variants per game type (custom full-screen layout for each of the 9 types)

---

## Out of Scope

- Per-user accounts — shared PIN is sufficient; individual logins add complexity with no benefit
- PDF export — share link covers the need at a fraction of the complexity
- Push notifications — members are physically present at the club evening
- Native mobile app — tablet/phone browser with PWA is sufficient
- Bowling (10 Pin / Strike+Spare scoring) — this club plays 9-Kegel only
- Public homepage or SEO — private internal app, behind PIN
- Multi-club / multi-tenant support — single club, single VPS

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| PERS-01 | Phase 1 | Pending |
| PERS-02 | Phase 1 | Complete |
| PERS-03 | Phase 4 | Pending |
| PERS-04 | Phase 4 | Pending |
| BACK-01 | Phase 1 | Pending |
| BACK-02 | Phase 1 | Complete |
| BACK-03 | Phase 1 | Complete |
| RT-01 | Phase 2 | Complete |
| RT-02 | Phase 2 | Complete |
| RT-03 | Phase 2 | Complete |
| TV-01 | Phase 2 | Complete |
| TV-02 | Phase 2 | Complete |
| TV-03 | Phase 2 | Complete |
| TV-04 | Phase 2 | Complete |
| PLAY-01 | Phase 2 | Complete |
| PLAY-02 | Phase 3 | Complete |
| STAT-01 | Phase 4 | Pending |
| STAT-02 | Phase 4 | Pending |
| STAT-03 | Phase 4 | Pending |
| DEPLOY-01 | Phase 5 | Complete |
| DEPLOY-02 | Phase 5 | Complete |
