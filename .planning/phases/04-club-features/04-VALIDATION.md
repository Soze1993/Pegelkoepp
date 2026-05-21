---
phase: 4
slug: club-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none — `node --test` auto-discovers `*.test.js` |
| **Quick run command** | `node --test server/routes/abende.test.js` |
| **Full suite command** | `node --test` |
| **Estimated runtime** | ~5–10 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant test file (`abende.test.js`, `stats.test.js`, or `game-types.test.js`)
- **After every plan wave:** Run `node --test` (full suite — must stay 170+ passing)
- **Before `/gsd:verify-work`:** Full suite green + human verification of all 5 success criteria
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| AB01 | 04-01 | 1 | PERS-04 | T-04-04 | POST /api/abende returns 409 if abend already open | unit | `node --test server/routes/abende.test.js` | ❌ W0 | ⬜ pending |
| AB02 | 04-01 | 1 | PERS-04 | — | POST /api/abende creates abend and returns {id, name} | unit | `node --test server/routes/abende.test.js` | ❌ W0 | ⬜ pending |
| AB03 | 04-01 | 1 | PERS-04 | — | GET /api/abende/active returns null when none open | unit | `node --test server/routes/abende.test.js` | ❌ W0 | ⬜ pending |
| AB04 | 04-01 | 1 | PERS-04 | — | GET /api/abende/active returns abend object when open | unit | `node --test server/routes/abende.test.js` | ❌ W0 | ⬜ pending |
| AB05 | 04-01 | 1 | PERS-04 | — | POST /api/abende/:id/end closes abend (sets ended_at) | unit | `node --test server/routes/abende.test.js` | ❌ W0 | ⬜ pending |
| AB06 | 04-01 | 1 | PERS-04 | — | POST /api/games auto-links to active abend when abend_id omitted | unit | `node --test server/routes/games.test.js` | Modify | ⬜ pending |
| ST10 | 04-01 | 1 | STAT-01 | — | GET /api/stats returns wins/losses/draws per player | unit | `node --test server/routes/stats.test.js` | ❌ W0 | ⬜ pending |
| ST11 | 04-01 | 1 | STAT-01 | — | Shared-rank game (2 winners) → draw, no wins/losses | unit | `node --test server/routes/stats.test.js` | ❌ W0 | ⬜ pending |
| ST12 | 04-01 | 1 | STAT-01 | — | VG draw (0 winner: true entries) → draw counted correctly | unit | `node --test server/routes/stats.test.js` | ❌ W0 | ⬜ pending |
| ST13 | 04-01 | 1 | STAT-02 | — | GET /api/stats includes personal_bests per type_key | unit | `node --test server/routes/stats.test.js` | ❌ W0 | ⬜ pending |
| ST14 | 04-01 | 1 | STAT-02 | — | Personal best updates when higher score achieved | unit | `node --test server/routes/stats.test.js` | ❌ W0 | ⬜ pending |
| ST15 | 04-01 | 1 | STAT-03 | — | Pudel counted from meta.pudel=true only (json_extract = 1) | unit | `node --test server/routes/stats.test.js` | ❌ W0 | ⬜ pending |
| ST16 | 04-01 | 1 | STAT-03 | — | Throw with value=0 but no meta.pudel NOT counted as Pudel | unit | `node --test server/routes/stats.test.js` | ❌ W0 | ⬜ pending |
| ST17 | 04-01 | 1 | STAT-03 | — | pudel_pct = pudel_count / total_throws * 100 (1 decimal) | unit | `node --test server/routes/stats.test.js` | ❌ W0 | ⬜ pending |
| GT25 | 04-01 | 1 | PERS-03 | T-04-01 | GET /api/game-types returns only is_builtin=0 rows | unit | `node --test server/routes/game-types.test.js` | ❌ W0 | ⬜ pending |
| GT26 | 04-01 | 1 | PERS-03 | — | POST /api/game-types creates custom type with slugified key | unit | `node --test server/routes/game-types.test.js` | ❌ W0 | ⬜ pending |
| GT27 | 04-01 | 1 | PERS-03 | — | POST /api/game-types returns 409 on duplicate key | unit | `node --test server/routes/game-types.test.js` | ❌ W0 | ⬜ pending |
| GT28 | 04-01 | 1 | PERS-03 | T-04-02 | DELETE /api/game-types/:id removes custom type | unit | `node --test server/routes/game-types.test.js` | ❌ W0 | ⬜ pending |
| GT29 | 04-01 | 1 | PERS-03 | T-04-03 | DELETE /api/game-types/:id returns 403 for is_builtin=1 | unit | `node --test server/routes/game-types.test.js` | ❌ W0 | ⬜ pending |
| GT30 | 04-01 | 1 | PERS-03 | T-04-05 | POST /api/game-types requires session (401 without) | unit | `node --test server/routes/game-types.test.js` | ❌ W0 | ⬜ pending |
| FE01 | 04-02 | 2 | PERS-04 | — | Spiele tab shows "Abend starten" when no active abend | integration | manual | Manual | ⬜ pending |
| FE02 | 04-02 | 2 | PERS-04 | — | Amber banner visible with abend name when abend active | integration | manual | Manual | ⬜ pending |
| FE03 | 04-02 | 2 | STAT-01 | — | Stats tab shows player cards with wins/losses/draws | integration | manual | Manual | ⬜ pending |
| FE04 | 04-02 | 2 | STAT-03 | — | Pudel% chip displayed (red .chip.pc) per player | integration | manual | Manual | ⬜ pending |
| FE05 | 04-02 | 2 | PERS-03 | — | Bibliothek tab shows custom type with gold border after creation | integration | manual | Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files needed before Wave 1 implementation begins (written as RED stubs first, then GREEN):

- [ ] `server/routes/abende.test.js` — covers AB01–AB05 (abend CRUD, single-active enforcement)
- [ ] `server/routes/stats.test.js` — covers ST10–ST17 (wins/losses/draws/pudel with fixture data)
- [ ] `server/routes/game-types.test.js` — covers GT25–GT30 (custom type CRUD, auth guards)
- [ ] Modify `server/routes/games.test.js` — add AB06 (auto-link to active abend on POST /api/games)

No new test framework installation needed — `node:test` is built into Node 22 and already in use.

---

## Key Validation Notes

### Stats computation correctness
- Draw detection: `winners.length !== 1` (handles 0-winner VG draws AND multi-winner tied-score draws)
- Pudel SQL: `json_extract(t.meta, '$.pudel') = 1` — SQLite stores booleans as integer 1, not `true`
- Personal best for kleineHaus: only from `winner: true` entries (inverted scoring — winner has the lowest number)
- Skip personal best for VG (score always 0) and FJ-jaeger (score always 0)

### Phase gate
All 170+ tests must pass AND all manual FE01–FE05 verifications pass before `gsd-verify-work` runs.
