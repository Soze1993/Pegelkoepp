# Retrospective — Pegelköpp Kegelclub App

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-05-22  
**Phases:** 5 | **Plans:** 15 | **Tests:** 194 | **Duration:** 3 days

### What Was Built

- **Phase 1:** Walking skeleton → PIN auth → 9 game modules → Games REST API + crash recovery (153 tests)
- **Phase 2:** Socket.io throw sync → TV display page with full-screen layout, idle screen, connection dot (166 tests)
- **Phase 3:** kegelclub_12.html → public/index.html, auth gate, init sequence, all 9 game types wired to API (170 tests)
- **Phase 4:** Kegelabend sessions, per-player stats (wins/losses/Pudel%), personal bests, custom game types (194 tests)
- **Phase 5:** Trust proxy fix, PM2 ecosystem config, DEPLOY.md runbook, Nginx + Certbot HTTPS, crash recovery + reboot tests on live VPS

### What Worked

- **DB-first throw persistence** — the `INSERT before applyThrow` invariant was established in Phase 1 and never violated; crash recovery worked first time in production
- **textContent-only XSS guard** — enforced from Phase 2 (TV) through Phase 4 (frontend); no innerHTML regressions across the full stack
- **Human verification checkpoints** — each phase had a defined verification step list that caught real bugs (Helmet CSP blocking, TV room join missing, GET /api/games missing abend_id)
- **Walking skeleton in Phase 1** — having a server that started and responded to GET /api/players from day one made subsequent phases stack smoothly
- **Nyquist gate (test scaffolding before implementation)** — Phase 2 wrote RED stubs first; all test suites green before human verification

### What Was Inefficient

- **REQUIREMENTS.md checkbox drift** — the checkboxes were never updated as phases completed; 9 requirements showed "Pending" at milestone close despite all being implemented. Should be updated at each phase summary commit.
- **io guard pattern discovery late** — the `if (io)` guard pattern in all emit calls was discovered during Phase 2 but should have been in Phase 1 plan templates
- **Three bug fixes found at human checkpoint** — Helmet CSP (unsafe-inline), TV room join, and Google Fonts CDN were all missed during planning. The human verification step caught them, which is correct, but earlier review could have surfaced Helmet CSP.

### Patterns Established

- `DB-first write ordering` — INSERT before applyThrow; non-negotiable crash safety invariant
- `textContent-only XSS guard` — no `.innerHTML =` for any DB-sourced string; enforced throughout
- `try/catch + console.warn on reconstruction` — server startup never crashes on a malformed game; graceful skip
- `app.locals.io set before server.listen` — safe for all route handlers
- `if (io)` guard in emit calls — keeps Phase 1 tests green without Socket.io initialized
- `DocumentFragment for batch DOM construction` — avoids intermediate repaint in renderSpiele/renderStats
- `IIFE closure for loop variable capture` — in custom type delete button loop

### Key Lessons

- **Trust proxy must be set before Helmet** — without `app.set('trust proxy', 1)`, session cookies lose the `Secure` flag and PIN login appears to succeed but the cookie is never sent. This is a Day 1 Express + Nginx gotcha.
- **Helmet CSP blocks inline event handlers** — `onclick=` attributes in index.html are blocked by default Helmet CSP. Add `'unsafe-inline'` to `script-src-attr` when working with inline handlers.
- **TV display needs to `join` a room, not just receive broadcasts** — the TV socket never received `throw:applied` events because it wasn't in the game room. Server-side `join` handler is required.
- **Socket.io over wss:// requires specific Nginx headers** — `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 120s;` — without these, Socket.io falls back to XHR polling.
- **PM2 startup command must NOT be run with sudo** — running `pm2 startup` without sudo generates the correct `sudo env PATH=... systemctl` command to copy/paste; running it with sudo generates a broken path.

### Cost Observations

- Sessions: ~5 working sessions across 3 days
- All phases executed autonomously with human checkpoints at key gates
- Zero rework cycles — each phase built cleanly on the previous without backtracking

---

---

## Milestone: v2.0 — Statistiken, Highlights & Turnierbaum

**Shipped:** 2026-05-27
**Phases:** 4 (6–9) | **Plans:** 20 | **Tests:** 433 | **Duration:** 5 days

### What Was Built

- **Phase 6:** Double-Elimination KDA tournament engine (initState/applyThrow/getFinalResults), tablet bracket UI, live TV bracket tree
- **Phase 7:** End-game TV overlays for all game types, 9 dedicated TV renderers, audio feedback, game-cancel persistence
- **Phase 8:** 7 new stat endpoints (year leaderboard, streaks, H2H, KDA/BK counts, last-summary), frontend stats wiring
- **Phase 9:** WhatsApp share button + self-hosted fonts (6 woff2 files, no CDN)

### What Worked

- **RED→GREEN for bracket engine** — writing the test contract first for KDA made the engine implementation clean; no ambiguity about expected state shapes
- **Wave-based parallel execution** — Phase 8 Wave 1 (08-02 + 08-03) ran in parallel; backend endpoints ready before frontend needed them
- **Quick-task mechanism** — 6 post-phase fixes applied without disturbing phase plans; kept plans as clean historical records
- **getBKLoserId in highlights.js** — extracting the BK loser logic as an export prevented duplication when Phase 8 needed it too
- **Phase 9 as a true polish phase** — two small self-contained plans, both Wave 0, executed in parallel in ~20 minutes total

### What Was Inefficient

- **Phase 7 scope underestimate** — planned 4 plans, shipped 10. TV renderer work was 1 plan per game type + multiple UAT fix cycles. Should have planned 1 plan per game type from the start.
- **REQUIREMENTS.md traceability not updated during Phase 7** — HIGHLIGHT-*/TV-01 stayed "Pending" throughout v2.0 despite being shipped in Phase 7. Should update traceability at phase summary time, not milestone close.
- **No milestone audit** — gaps could surface earlier with a pre-close audit, especially for a milestone with 4 phases and iterative TV work.

### Patterns Established

- `reconstructState(game) + getFinalResults(state)` — standard pattern for reading game results in stats/recap routes
- `ORDER BY id ASC` (not `finished_at`) — required for BK exemption chain iteration; finished_at can be null for active games
- `encodeURIComponent` for all user-data-in-URL — no direct innerHTML injection for WhatsApp share URL
- `state.bracket BEFORE state.players` guard in renderGame — KDA has bracket, not players; guard order matters for dispatcher pattern

### Key Lessons

- **TV renderer work scales with game type count** — plan N plans for N game types, not 1 plan total for "TV layouts"
- **Self-hosting fonts is a one-time 30-minute task** — should be in v1.0 for any venue-operated app; venue internet is unreliable
- **Quick tasks are the right mechanism for post-UAT iterative fixes** — they keep phase plans clean and make git history readable
- **Parallel Wave 0 execution works well for truly independent plans** — Phase 9's two plans had zero dependencies; parallel execution cut time in half

---

## Cross-Milestone Trends

| Milestone | Duration | Phases | Tests | Key Pain Point |
|-----------|----------|--------|-------|----------------|
| v1.0 MVP | 3 days | 5 | 194 | Requirements checkbox drift; Helmet CSP at Phase 3 |
| v2.0 Stats+Highlights | 5 days | 4 | 433 | Phase 7 scope underestimate (4→10 plans); traceability drift |
