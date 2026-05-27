---
phase: 8
slug: statistiken-rueckblick
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Config file** | none — discovery via `node --test` glob |
| **Quick run command** | `node --test server/routes/stats.test.js server/routes/abende.test.js` |
| **Full suite command** | `node --test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test server/routes/stats.test.js server/routes/abende.test.js`
- **After every plan wave:** Run `node --test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 0 | STATS-01..05, RECAP-01..02 | — | N/A | unit (RED stubs) | `node --test server/routes/stats.test.js server/routes/abende.test.js` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 1 | STATS-01 | T-8-02 | year param validated: /^\d{4}$/ → 400 on bad input | unit/integration | `node --test server/routes/stats.test.js` | ✅ after W0 | ⬜ pending |
| 8-02-02 | 02 | 1 | STATS-02 | — | N/A | unit/integration | `node --test server/routes/stats.test.js` | ✅ after W0 | ⬜ pending |
| 8-02-03 | 02 | 1 | STATS-03 | T-8-03 | h2h params a,b validated: positive integers → 400 on invalid | unit/integration | `node --test server/routes/stats.test.js` | ✅ after W0 | ⬜ pending |
| 8-02-04 | 02 | 1 | STATS-04 | — | N/A | unit/integration | `node --test server/routes/stats.test.js` | ✅ after W0 | ⬜ pending |
| 8-02-05 | 02 | 1 | STATS-05 | — | N/A | unit/integration | `node --test server/routes/stats.test.js` | ✅ after W0 | ⬜ pending |
| 8-03-01 | 03 | 1 | RECAP-01, RECAP-02 | — | N/A | unit/integration | `node --test server/routes/abende.test.js` | ✅ after W0 | ⬜ pending |
| 8-04-01 | 04 | 2 | STATS-01..05, RECAP-01..02 | — | N/A | manual | browser test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/routes/stats.test.js` — new RED stubs for STATS-01 through STATS-05 (5 new `test()` blocks)
- [ ] `server/routes/abende.test.js` — new RED stubs for RECAP-01 and RECAP-02 (2 new `test()` blocks)
- [ ] Helper functions `insertFinishedKDAGame` and `insertFinishedBKGame` already exist in `highlights.test.js` — copy or import into stats.test.js and abende.test.js

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Year picker shows correct available years | STATS-01 | UI interaction | Open Stats tab, verify year dropdown lists only years with finished games |
| Player profile shows KDA and BK award counts | STATS-04, STATS-05 | UI modal | Click a player name, verify "Kegler des Abends: X mal" and "BK Verlierer: X mal" chips appear |
| Homepage recap card renders on Spiele tab | RECAP-01, RECAP-02 | UI render | Open homepage, verify "Letzter Abend" card shows date, KDA winner, BK loser, and game list |
| Head-to-head selector produces correct result | STATS-03 | UI interaction | Select two players from dropdowns, verify wins/losses match DB records |
| Streak badge shows current + longest | STATS-02 | UI render | Verify each player row in stats shows streak info |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
