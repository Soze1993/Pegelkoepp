---
phase: 6
slug: turnierbaum
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node 22+) |
| **Config file** | none — `node --test server/game-types/*.test.js` |
| **Quick run command** | `npm run test:games` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:games`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-W0-tests | W0 | 0 | TOURNAMENT-01/02 | — | N/A | unit | `npm run test:games` | ❌ W0 — must be written first | ⬜ pending |
| 6-engine-init | W1 | 1 | TOURNAMENT-01 | T-input-validation | `initState` rejects player count < 4 or > 12 | unit | `npm run test:games` | ❌ W0 dependency | ⬜ pending |
| 6-engine-throw | W1 | 1 | TOURNAMENT-02 | T-stale-throw, T-xss | `applyThrow` ignores throws for non-active matches | unit | `npm run test:games` | ❌ W0 dependency | ⬜ pending |
| 6-engine-gf | W1 | 1 | TOURNAMENT-02 | — | Grand Final resolves after 4 throws, handles ties | unit | `npm run test:games` | ❌ W0 dependency | ⬜ pending |
| 6-frontend-tablet | W2 | 2 | TOURNAMENT-02 | T-xss | Bracket DOM uses textContent only (no innerHTML with player data) | manual | Visual inspection in browser | N/A | ⬜ pending |
| 6-frontend-tv | W2 | 2 | TOURNAMENT-03 | T-tv-null-guard | TV renders bracket when `state.bracket` present, not idle screen | manual | Start KDA game, verify TV shows bracket | N/A | ⬜ pending |
| 6-socket-live | W2 | 2 | TOURNAMENT-03 | — | `throw:applied` updates TV bracket without page reload | manual | Enter throw on tablet, observe TV update in < 2s | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `Claude/server/game-types/kegler-des-abends.test.js` — entire test suite must be rewritten; old tests reference `state.matches`, `state.mid`, `state.wRound` which no longer exist. New tests must cover:
  - `initState`: bracket generation for 4, 8, 12 players (including byes for non-power-of-2 counts)
  - `applyThrow`: throw accumulation, match resolution, winner advancement, tiebreak detection
  - Grand Final: 2 throws per player, higher total wins, tie → extra throw
  - `isFinished`: returns true only when GF slot is done
  - `getFinalResults`: returns array with single winner
  - Immutability: `applyThrow` must not mutate input state
  - Determinism: two replays of same throw sequence produce identical state

*Existing module shape (id, name, initState, applyThrow, isFinished, getFinalResults) remains the same — adapt interface contract tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSS bracket tree renders correctly at 12-player scale (tightest fit) | TOURNAMENT-02 | CSS connector line alignment requires visual browser test | Start a 12-player KDA game; verify W/L bracket tree renders on tablet with correct connector lines and no overflow |
| TV bracket fits on 1920×1080 without clipping at 12 players | TOURNAMENT-03 | Requires actual TV/browser at that resolution | Open tv.js in browser at 1920×1080; start 12-player game; verify no horizontal overflow |
| `throw:applied` updates TV bracket live per throw | TOURNAMENT-03 | WebSocket/real-time behavior cannot be unit tested | On tablet: tap active slot, enter P1 throw → TV must show "X ⚫" in active match before P2 throws |
| Tiebreak flow in modal ("Stechen" section) | TOURNAMENT-02 | UI modal render path for tie state | Enter equal pin counts for both players in a match; verify modal shows "Stechen — Gleichstand!" and new throw inputs |
| Old KDA games still display correctly (display-only mode) | TOURNAMENT-02 | Legacy compatibility — detect `state.matches` not `state.bracket` | Open a pre-Phase-6 KDA game in game history; verify match list renders, no crash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
