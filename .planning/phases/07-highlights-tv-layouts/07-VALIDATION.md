---
phase: 7
slug: highlights-tv-layouts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | none — `node --test` discovers `*.test.js` recursively |
| **Quick run command** | `cd Claude && node --test server/routes/highlights.test.js` |
| **Full suite command** | `cd Claude && node --test` |
| **Estimated runtime** | ~30 seconds (full suite; 391+ tests) |

---

## Sampling Rate

- **After every task commit:** Run `cd Claude && node --test server/routes/highlights.test.js`
- **After every plan wave:** Run `cd Claude && node --test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-W0-01 | 01 | 0 | HIGHLIGHT-01, HIGHLIGHT-03 | XSS | textContent-only | unit | `node --test server/routes/highlights.test.js` | ❌ W0 | ⬜ pending |
| 7-W0-02 | 01 | 0 | HIGHLIGHT-02, HIGHLIGHT-04 | — | typeKey present in game:finished | integration | `node --test server/routes/games.test.js` | ✅ extend | ⬜ pending |
| 7-01-01 | 01 | 1 | HIGHLIGHT-01, HIGHLIGHT-03 | XSS | champion data served without innerHTML | integration | `node --test server/routes/highlights.test.js` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | HIGHLIGHT-02, HIGHLIGHT-04 | XSS | typeKey in game:finished payload | integration | `node --test server/routes/games.test.js` | ✅ extend | ⬜ pending |
| 7-03-01 | 03 | 2 | HIGHLIGHT-02, HIGHLIGHT-04, TV-01 | — | TV overlay renders correct content | manual | manual TV inspection | — | ⬜ pending |
| 7-04-01 | 04 | 2 | HIGHLIGHT-01, HIGHLIGHT-03 | XSS | symbol spans use textContent not innerHTML | code review | manual code review | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/routes/highlights.test.js` — stubs for GET /api/highlights/current: returns `{ kda_champion, bk_loser }` shape; returns correct player when last KDA game exists; returns null when no finished KDA game; returns correct loser (lowest bkTotal) from last BK game
- [ ] Extend `server/routes/games.test.js` — add assertion: game:finished socket event includes `typeKey` field equal to the game's type_key

*Wave 0 must pass before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TV end overlay appears after KDA game ends | HIGHLIGHT-02 | Requires live Socket.io + browser TV client | 1. Start KDA game, complete all throws. 2. TV should show amber overlay with 🏆 and winner name for 10s then go idle |
| TV end overlay appears after BK game ends | HIGHLIGHT-04 | Requires live Socket.io + browser TV client | 1. Start Bilderkegeln game, complete all throws. 2. TV should show red overlay with 💩 and loser name for 10s then go idle |
| TV shows Fuchsjagd split layout during active game | TV-01 | Requires live TV browser session | Start Fuchsjagd game, verify TV shows Fuchs/Jäger split panels |
| TV shows Viergewinnt team panels during active game | TV-01 | Requires live TV browser session | Start Viergewinnt game, verify TV shows Team X / VS / Team O layout |
| TV shows BK loser highlight row in red | TV-01 | Requires live TV browser session | Start Bilderkegeln, enter throws — verify lowest-score row shows red left-border |
| 🏆 symbol shows in player table after KDA game | HIGHLIGHT-01 | Requires browser session + fresh page load | After KDA game ends, reload tablet — verify 🏆 appears next to winner's name |
| 💩 symbol shows in player table after BK game | HIGHLIGHT-03 | Requires browser session + fresh page load | After BK game ends, reload tablet — verify 💩 appears next to loser's name |
| showWinnerBanner XSS fix | HIGHLIGHT-01 | Code review / DOM inspection | Inspect index.html showWinnerBanner — confirm no innerHTML with player name string; uses textContent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
