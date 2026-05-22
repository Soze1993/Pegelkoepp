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

## Cross-Milestone Trends

| Milestone | Duration | Phases | Tests | Key Pain Point |
|-----------|----------|--------|-------|----------------|
| v1.0 MVP | 3 days | 5 | 194 | Requirements checkbox drift; Helmet CSP at Phase 3 |
