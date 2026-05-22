---
phase: 2
slug: real-time-tv
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node.js 22) |
| **Config file** | none — `npm test` runs `node --test` |
| **Quick run command** | `node --test server/routes/games.test.js` |
| **Full suite command** | `node --test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test server/routes/games.test.js`
- **After every plan wave:** Run `node --test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| RT-01 | Throw on tablet emits `throw:applied` Socket.io event to TV room | T-02-emit-order | DB write before emit; no emit before INSERT committed | integration | `node --test server/routes/socket.test.js` | ❌ Wave 0 | ⬜ pending |
| RT-02 | TV auto-reconnects; `game:state` emitted on every `connect` event | — | N/A | integration | `node --test server/routes/socket.test.js` | ❌ Wave 0 | ⬜ pending |
| RT-03 | Connection dot changes class on socket connect/disconnect | — | N/A | manual smoke | Manual browser + `socket.test.js` connect/disconnect | ❌ Wave 0 | ⬜ pending |
| TV-01 | GET /tv returns 200 without session cookie | — | N/A | integration | `node --test server/routes/games.test.js` | ✅ GT11 | ⬜ pending |
| TV-02 | `game:state` event contains all player scores, active player ID, last throw per player | — | N/A | integration | `node --test server/routes/socket.test.js` | ❌ Wave 0 | ⬜ pending |
| TV-03 | tv.html CSS: `.score` min 72px, `.player-name` min 36px | — | N/A | manual | Manual visual check at 5m distance | manual-only | ⬜ pending |
| TV-04 | Idle `game:state` { idle: true } emitted on connect when no active game; lastWinner correct | — | N/A | integration | `node --test server/routes/socket.test.js` | ❌ Wave 0 | ⬜ pending |
| PLAY-01 | POST /api/games/:id/undo: deletes last throw (by id DESC), reconstructs state, emits `undo:applied` | T-02-unauth-undo | requireSession enforced; 404 if game not active; 400 if no throws | integration | `node --test server/routes/games.test.js` | ❌ Wave 0 | ⬜ pending |
| D-12 | ALTER TABLE migration is idempotent: runs twice without error or data loss | — | N/A | integration | `node --test server/db/db.test.js` (extend) | ❌ Wave 0 | ⬜ pending |
| D-13 | throws.meta persisted on INSERT; reconstructState parses it; grosseHaus/kleineHaus reconstruct correctly | — | N/A | integration | `node --test server/routes/games.test.js` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/routes/socket.test.js` — new file; covers RT-01, RT-02, TV-02, TV-04, PLAY-01 (socket-level integration tests using socket.io-client)
- [ ] `socket.io-client` devDependency — must be installed before socket.test.js runs (`npm install --save-dev socket.io-client`)
- [ ] Schema migration idempotency test — add to `server/db/db.test.js`: assert `throws.meta` and `game_players.role` columns exist after `require('./db')` (can run twice to verify idempotency)
- [ ] throws.meta persistence test — add to `games.test.js`: POST throw with `meta: { slot: 'h' }`, GET game, assert reconstructed state has correct slot

*Note: TV-01 (GET /tv → 200) already covered by existing GT11 in `games.test.js`. No new file needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TV text readable at 3–5m distance | TV-03 | Cannot be asserted programmatically; requires physical distance test | Open `/tv` on TV browser at 5m; verify player names ≥ 36px rendered, scores ≥ 72px rendered; active player row highlighted with gold overlay |
| TV idle screen shows correct last winner | TV-04 | DOM rendering requires browser | Complete a game, verify TV transitions to idle with "Letzter Sieger: [name]" text |
| Undo button 2-tap confirmation UX | PLAY-01 (D-06) | DOM interaction requires browser | In active game, enter 1 throw; tap undo once — "Wirklich rückgängig?" appears; tap again — throw removed; verify TV silently updates |
| Connection indicator green/red toggle | RT-03 | Requires real network drop | On input device, disable network; dot turns red; re-enable; dot turns green; verify state restored |
| Font fallback at venue without internet | TV-03/TV-04 | Requires offline test | Disable network; reload `/tv`; verify font sizes still meet requirements (self-hosted fonts or acceptable fallback) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
