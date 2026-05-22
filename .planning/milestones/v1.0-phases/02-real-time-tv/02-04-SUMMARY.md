---
phase: 02-real-time-tv
plan: "04"
subsystem: tv-display
tags:
  - tv-display
  - client
  - dom
  - css
  - idle-screen
  - socket-io
  - xss-guard
dependency_graph:
  requires:
    - 02-01 (socket.test.js RED stubs ST01–ST05, db.test.js, games.test.js GT19)
    - 02-02 (Socket.io init, Helmet CSP ws:/wss:, throws.meta + game_players.role migrations)
    - 02-03 (throw:applied / undo:applied / game:started / game:finished emits, POST /:id/undo)
  provides:
    - public/tv.html (full-screen TV display markup, idle + game screens, connection dot)
    - public/tv.js (Socket.io client, renderIdle/renderGame, textContent-only XSS guard)
    - server/server.js (io.on('connection') emits real lastWinner via JOIN query, try/catch fallback)
    - server/routes/socket.test.js (ST03 GREEN, new ST06 for idle lastWinner field)
  affects:
    - phase-03 (TV display is reference implementation for Socket.io event shapes; RT-03 connection dot pattern must be replicated in kegelclub_12.html input UI)
tech_stack:
  added:
    - Google Fonts (Bebas Neue + DM Sans) via link tag in tv.html (fix commit 5f6a4c4)
  patterns:
    - textContent-only DOM updates (XSS guard T-02-02 — no .innerHTML = anywhere)
    - replaceChildren() for safe list clear without innerHTML
    - CSS custom properties (--bg, --ac, --txt, --fh, --fb) matching kegelclub_12.html theme
    - conn-dot CSS class toggling (green/red) on socket connect/disconnect events
    - try/catch wrapper around lastWinner JOIN query — falls back to null, server never crashes
    - Idle vs. active game:state payload shape (idle: true/false discriminated union)
key_files:
  created:
    - public/tv.html
    - public/tv.js
  modified:
    - server/server.js (io.on('connection') handler — lastWinner JOIN query replacing null stub)
    - server/routes/socket.test.js (ST03 GREEN, ST06 added)
decisions:
  - "textContent-only rule is a hard constraint — no innerHTML shortcut permitted even for read-only TV display (T-02-02)"
  - "Google Fonts CDN link added post-verification as fix commit (Step 2 font readability confirmed on screen; offline fallback font-size constraints still enforced regardless of which font renders)"
  - "Auto-transition to idle on game:finished deferred to Phase 3 (Option A accepted by user) — TV stays on final game state until next reconnect/refresh"
  - "lastWinner JOIN uses try/catch fallback to null — reconstruction failures on legacy data do not crash the server (T-02-Reconstruct mitigation)"
  - "getScore() generic fallback (wuerfe.reduce sum) deferred to Phase 3 per-game-type score shapes — sufficient for dreiVollen and most game types in current phase"
metrics:
  duration: "~90 minutes"
  completed: "2026-05-20"
  tasks_completed: 3
  files_created: 2
  files_modified: 2
---

# Phase 2 Plan 04: TV Display Vertical Slice — Summary

**One-liner:** Full-screen TV display page (Socket.io client, gold active-player overlay, 72px scores / 36px names, idle screen with last winner, connection dot) with server-side lastWinner JOIN — all 6 socket tests green, 166 tests passing, human verification approved on all 10 steps.

## What Was Built

### Files created

| File | Purpose |
|------|---------|
| `public/tv.html` | Full-screen TV display: dark theme (#0f0f14), idle screen (Pegelkoepp + last winner), game screen (full-width player rows, gold active overlay), top-right connection dot; script tags for /socket.io/socket.io.js and /tv.js; Google Fonts link for Bebas Neue + DM Sans |
| `public/tv.js` | Socket.io client (same-origin io()); registers game:state / throw:applied / undo:applied / game:started / game:finished / connect / disconnect handlers; renderIdle() and renderGame() with textContent-only DOM writes; isActivePlayer() and getScore() helpers |

### Files modified

| File | Change |
|------|--------|
| `server/server.js` | io.on('connection') handler: idle branch now runs a real lastWinner JOIN query (SELECT id FROM games WHERE status='finished' ORDER BY finished_at DESC LIMIT 1) with try/catch fallback to null; active-game branch unchanged |
| `server/routes/socket.test.js` | ST03 stub turned GREEN (asserts idle:false, state.players array with id/name/wuerfe); ST06 added (asserts idle:true and lastWinner field shape on fresh DB / finished game) |

### TV page layout

```
+--------------------------------------------------+  (dark background #0f0f14)
|                                          [dot]   |  <- connection dot (fixed top-right, green/red)
|                                                  |
|             PEGELKOEPP                           |  <- Bebas Neue, 15vw, gold #e8b84b (idle screen)
|         Noch kein Spiel gespielt                 |  <- DM Sans, 3vw, muted #8884a0
|                                                  |
+--------------------------------------------------+

+--------------------------------------------------+  (game screen — replaces idle)
|  [dot]                                           |
|  Emoji Name          Letzter Wurf       Score    |  <- flex row: name left, column center, score right
|  [gold overlay row for active player]            |  <- rgba(232, 184, 75, 0.15)
|  ...                                             |
|  Player name: 36px Bebas Neue (TV-03 minimum)    |
|  Score: 72px Bebas Neue gold (TV-03 minimum)     |
+--------------------------------------------------+
```

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| Task 1 | TV display page (tv.html + tv.js) | 9efa28e |
| Task 2 | lastWinner JOIN + ST03/ST06 GREEN | 2cd741b |
| Fix | Google Fonts link (Bebas Neue + DM Sans) | 5f6a4c4 |

## Test Counts

| Suite | Tests | Result |
|-------|-------|--------|
| ST01–ST06 (this plan) | 6 | 6/6 PASS |
| Plan 02-01 (DB05/DB06) | 2 | 2/2 PASS |
| Plan 02-03 (GT19/GT20 + socket events) | ~5 | PASS |
| Phase 1 foundation | 153 | 153/153 PASS |
| **Full suite (npm test)** | **166** | **166/166 PASS** |

## Task 3: Human Verification Results

**Status:** APPROVED (2026-05-20)

All 10 verification steps performed in order. Results recorded by user:

| Step | Requirement | Description | Result |
|------|-------------|-------------|--------|
| 1 | TV-01 + TV-04 | Idle screen: dark background, gold Pegelkoepp centered, last winner text or fallback, no input elements, green connection dot | PASS |
| 2 | TV-03 | Font readability at distance: 72px scores clearly readable, 36px player names clearly readable | PASS |
| 3 | TV-02 + RT-01 | Live throw < 2 seconds: TV switches from idle to game view on game:started; throw updates Letzter Wurf column and score in real time | PASS |
| 4 | D-02 | Gold overlay: active player row has subtle gold-tinted background rgba(232, 184, 75, 0.15); other rows have no overlay | PASS |
| 5 | D-03 | Letzter Wurf column permanently visible in every row; updates immediately on subsequent throw | PASS |
| 6 | PLAY-01 + D-07 | Undo: POST /api/games/:id/undo causes TV to silently revert score and Letzter Wurf to pre-throw state | PASS |
| 7 | RT-02 | Reconnect + state restore: connection dot turns red on disconnect; turns green on reconnect; game state fully restored automatically — no manual reload needed | PASS |
| 8 | RT-03 | Connection dot: tested via browser console socket.disconnect()/socket.connect() (DevTools Offline does not block localhost). Dot reliably follows green/red across 2–3 toggles | PASS — tested via browser console |
| 9 | TV-04 | Idle transition on game finish: auto-transition deferred to Phase 3; TV stays on final game state until next reconnect/refresh. User accepted Option A (defer) | PARTIAL — deferred to Phase 3 |
| 10 | Full suite | npm test final smoke: 166 passing | PASS — 166 passing |

**Note on Step 8:** DevTools Network throttling does not block localhost WebSocket connections. Browser console `socket.disconnect()` / `socket.connect()` was used as the equivalent test — correctly exercises the Socket.io reconnect logic and connection dot CSS class toggling.

## Phase 2 Requirement Coverage Map

| Requirement | Description | Automated Coverage | Manual Coverage |
|-------------|-------------|-------------------|----------------|
| RT-01 | Throw appears on TV < 2 seconds | Plan 02-03 ST02 (socket event timing) | Step 3 (live latency observed < 2s) |
| RT-02 | TV auto-reconnects + restores state | Plan 02-03 ST05 (reconnect event) | Step 7 (manual disconnect/reconnect) |
| RT-03 | Connection indicator visible | Plan 02-04 (conn-dot green/red CSS class logic in tv.js) | Step 8 (socket.disconnect()/connect() in console) |
| TV-01 | /tv route: full-screen, no auth, no input elements | Plan 01-04 GT11 (GET /tv returns 200 unauthenticated) | Step 1d (no input elements visible) |
| TV-02 | TV shows live game state: scores, highlight, last throw | Plan 02-04 ST03 (state.players array shape) | Steps 3–5 (live game rendering observed) |
| TV-03 | Text sizes: scores min 72px, names min 36px | Plan 02-04 Task 1 verify (literal font-size checks in tv.html) | Step 2 (font readability at distance) |
| TV-04 | Idle screen: club name + last winner | Plan 02-04 ST06 (idle:true + lastWinner field) | Step 1 (idle screen rendered correctly) |
| PLAY-01 | Undo last throw — tablet and TV update | Plan 02-03 GT16/GT17/GT18/GT20 + ST04 (undo endpoint) | Step 6 (TV reverts on undo) |

## Deferred Items

| Item | Reason | Target Phase |
|------|--------|-------------|
| Auto-transition TV to idle on game:finished event | Requires game-type-aware "is finished" logic on client; deferred by user (Option A) | Phase 3 |
| Game-type-specific TV UI layouts | Each of the 9 game types has different scoring shapes (e.g. grosseHaus slots, fuchsjagd roles); generic wuerfe.reduce fallback in place | Phase 3 |
| BilderKegeln image display on TV | Requires image assets and game-type-specific render branch | Phase 3 |
| RT-03 connection dot in kegelclub_12.html input UI | TV connection dot pattern must be replicated for the tablet input device | Phase 3 |
| TV font readability at true 5m venue distance | Verified on monitor at dev time; final check requires actual TV at Kegelabend venue | Deployment (Phase 5) |
| RT-03 with real network drop (non-localhost) | Localhost does not honor DevTools Offline; real Nginx proxy WebSocket upgrade headers must be verified | Phase 5 deployment |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Google Fonts CDN link for Bebas Neue + DM Sans**
- **Found during:** Task 3 Step 2 human verification (font readability check)
- **Issue:** The plan's Pitfall 4 warning about offline CDN risk led to omitting the Google Fonts link in the initial implementation. The system-font fallback (sans-serif) was used instead. During verification, the user noted that Bebas Neue was not rendering — the font was not available as a system font on the test device.
- **Fix:** Added Google Fonts `<link>` tag for Bebas Neue and DM Sans to tv.html. The 72px / 36px hard size constraints remain enforced regardless of which font renders, so TV-03 is met even if the CDN is unavailable at venue. The plan's warning remains valid for venue use — if Bebas Neue is essential offline, self-hosting is the Phase 5 solution.
- **Files modified:** `public/tv.html`
- **Commit:** 5f6a4c4

### No Other Deviations

All other plan tasks executed exactly as written. The try/catch fallback around lastWinner JOIN, the textContent-only XSS guard, and the idle/active payload discrimination all match the plan specification.

## Known Stubs

| Stub | File | Line (approx.) | Reason |
|------|------|----------------|--------|
| `getScore(player)` wuerfe.reduce fallback | `public/tv.js` | ~85 | Generic sum of wuerfe array; game-type-specific score shapes (e.g. grosseHaus slots) require Phase 3 per-game-type rendering |
| Auto-idle on game:finished | `public/tv.js` | game:finished handler | renderGame() called but no auto-transition to idle; deferred to Phase 3 |

These stubs do not prevent the plan's goal: live score display during dreiVollen (the primary Phase 2 game type) works correctly end-to-end.

## Threat Surface Scan

No new network endpoints or auth paths introduced beyond what the plan's threat model covers. All mitigations from the threat register were implemented:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-02 (XSS) | textContent-only in tv.js; no .innerHTML = anywhere | Implemented + verified by automated literal check |
| T-02-03 (CSP) | Helmet CSP ws:/wss: allow added in plan 02-02; confirmed green dot in Step 1 | Verified |
| T-02-XS-Font | Font size hard constraints hold offline regardless of CDN | Verified (72px/36px literals in tv.html) |
| T-02-Auth | /tv route unauthenticated; no input elements, no PII surface | Verified Steps 1d + GT11 |
| T-02-Reconstruct | try/catch around lastWinner JOIN falls back to null | Implemented in server.js |

## Remaining Manual-Only Verifications (carried into deployment)

1. **TV-03 at true 5m venue distance** — Verified on monitor at dev time. Final confirmation requires actual TV screen at Kegelabend venue.
2. **RT-03 with real network drop** — Localhost does not honor DevTools Offline. Real Nginx proxy WebSocket upgrade headers must be verified (`proxy_http_version 1.1; Upgrade; Connection "upgrade"`) before first live Kegelabend.
3. **Bebas Neue offline fallback** — If venue has no internet, the system-font fallback (sans-serif) will render. TV-03 pixel constraints hold, but the visual brand identity may differ. Self-hosting the font files is the Phase 5 solution if offline rendering is required.

## Phase 2 Success Criteria Status

| SC | Description | Status |
|----|-------------|--------|
| SC #1 | Throw on tablet → TV update < 2 seconds, no reload | PASS (Step 3) |
| SC #2 | TV auto-reconnects + restores game state | PASS (Step 7) |
| SC #3 | Connection indicator changes state on WebSocket drop | PASS (Step 8) |
| SC #4 | /tv: full-screen layout, min 36px names / 72px scores, no login | PASS (Steps 1–2) |
| SC #5 | User can undo throw; correction reflected on TV | PASS (Step 6) |
| SC #6 | TV shows idle screen with club name and last winner | PASS (Step 1) |

All 6 Phase 2 success criteria met. Phase 2 complete.

## Self-Check: PASSED

- `public/tv.html` — FOUND (commit 9efa28e, updated in 5f6a4c4)
- `public/tv.js` — FOUND (commit 9efa28e)
- `server/server.js` — modified with lastWinner JOIN (commit 2cd741b)
- `server/routes/socket.test.js` — ST03 GREEN, ST06 added (commit 2cd741b)
- Commit 9efa28e (feat(02-04): TV display page) — FOUND
- Commit 2cd741b (feat(02-04): lastWinner JOIN + ST03/ST06) — FOUND
- Commit 5f6a4c4 (fix(02-04): Google Fonts) — FOUND
- 166/166 tests passing — VERIFIED (Step 10 human verification)
- Human verification Task 3: 9/10 PASS, 1/10 PARTIAL (Step 9 deferred to Phase 3 with user acceptance)
- Phase 2 plan 02-04 complete — all 4 Phase 2 plans committed and verified
