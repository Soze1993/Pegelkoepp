---
phase: 01
slug: backend-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (Node 22 LTS — no external framework needed) |
| **Config file** | none — Wave 0 creates test files |
| **Quick run command** | `node --test server/game-types/*.test.js` |
| **Full suite command** | `node --test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test server/game-types/*.test.js`
- **After every plan wave:** Run `node --test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-db-01 | db | 0 | PERS-01, PERS-02 | — | WAL mode enabled | integration | `node --test server/db/*.test.js` | ❌ Wave 0 | ⬜ pending |
| 01-gm-01 | game-modules | 0 | BACK-02 | — | Pure functions, no DOM | unit | `node --test server/game-types/*.test.js` | ❌ Wave 0 | ⬜ pending |
| 01-auth-01 | auth | 1 | AUTH-01 | — | Wrong PIN → 401 | integration | `node --test server/routes/auth.test.js` | ❌ Wave 0 | ⬜ pending |
| 01-auth-02 | auth | 1 | AUTH-02 | — | /tv accessible without cookie | integration | `node --test server/routes/tv.test.js` | ❌ Wave 0 | ⬜ pending |
| 01-api-01 | api | 1 | BACK-01 | — | Write route without session → 401 | integration | `node --test server/routes/players.test.js` | ❌ Wave 0 | ⬜ pending |
| 01-api-02 | api | 1 | BACK-03 | — | Throw survives restart | integration | `node --test server/db/*.test.js` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/game-types/*.test.js` — stubs for BACK-02 (one test file per module)
- [ ] `server/db/db.test.js` — WAL mode, UNIQUE constraint, throw persistence
- [ ] `server/routes/auth.test.js` — login success/fail, session creation
- [ ] `server/routes/tv.test.js` — unauthenticated GET /tv returns 200
- [ ] `server/routes/players.test.js` — unauthenticated write → 401

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Server starts with `npm start` | PERS-01 | Process startup | Run `npm start`, check console for "Server running on port" |
| Seed populates 12 players on first run | PERS-01 | First-run state | Delete kegelclub.db, run `npm start`, call GET /api/players |
| Active game survives server restart | BACK-03 | Full restart cycle | Start game via API, kill server, restart, verify game in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
