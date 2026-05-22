---
phase: 3
slug: frontend-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none — already configured in package.json `"test"` script |
| **Quick run command** | `node --test server/routes/games.test.js` |
| **Full suite command** | `node --test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test server/routes/games.test.js`
- **After every plan wave:** Run `node --test` (full suite — must stay 166+ passing)
- **Before `/gsd:verify-work`:** Full suite must be green + human verification of all 9 game types
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-xx-01 | backend-fixes | 0 | PLAY-02 | — | GET /api/games returns only own-club data (no auth bypass) | unit | `node --test server/routes/games.test.js` | ❌ W0 | ⬜ pending |
| 3-xx-02 | backend-fixes | 0 | PLAY-02 | — | vier-gewinnt.js fix: tX/tO non-empty after role assignment | unit | `node --test server/routes/games.test.js` | ❌ W0 | ⬜ pending |
| 3-xx-03 | auth-overlay | 1 | AUTH-01 | — | Unauthenticated requests to write routes rejected 401 | unit | `node --test server/routes/auth.test.js` | ✅ | ⬜ pending |
| 3-xx-04 | index-html | 2 | PLAY-02 | — | All 9 game types complete end-to-end | integration | manual verification | Manual only | ⬜ pending |
| 3-xx-05 | game-recovery | 2 | PLAY-02 | — | Refresh mid-game restores state without data loss | integration | manual verification | Manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test stubs needed in `server/routes/games.test.js` (Wave 0 plan):

- [ ] `GET /api/games` returns all games sorted by id DESC
- [ ] `GET /api/games?status=active` returns only active games
- [ ] `GET /api/games?status=finished` returns only finished games
- [ ] `GET /api/games/:id` after viergewinnt fix: `state.tX` and `state.tO` are non-empty arrays when roles provided

No new test framework installation needed — `node:test` already in use across all test files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 9 game types complete end-to-end | PLAY-02 | Browser interaction required for full game flow | Start each of 9 types, submit throws until finished, verify winner banner appears |
| Active game recovery after browser refresh | PLAY-02 | Browser state + server round-trip | Start a game, refresh mid-throw, verify tab switches to Spielen with state intact |
| PIN overlay blocks app before auth | AUTH-01 | Browser DOM interaction | Open `/` in fresh incognito, verify overlay blocks content; enter PIN, verify app loads |
| TV idle transition after game:finished | D-12 | Cross-device socket event | Finish a game on tablet, verify TV shows result then transitions to idle screen within 3-4 seconds |
| Connection dot reflects WebSocket state | D-07 | Live WebSocket state | Disconnect network briefly, verify topbar dot turns red; reconnect, verify green |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING (❌) references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
