# Phase 3: Frontend Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 03-frontend-wiring
**Areas discussed:** File & integration strategy, Login / auth UX, Active game recovery on refresh, Socket.io client in the input UI

---

## File & Integration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Copy kegelclub_12.html → public/index.html, wire API in-place | Move file into static-serving dir, replace S.spieler/game calls with fetch(). HTML structure stays identical. | ✓ |
| Keep kegelclub_12.html, update public/index.html as a thin wrapper | Serve original under its own URL, index.html redirects/iframes. Avoids renaming. | |
| Write a fresh index.html from scratch | Start clean — no legacy variable names. Higher effort, risk of UI regression. | |

**User's choice:** Copy kegelclub_12.html → public/index.html, wire API in-place

| Option | Description | Selected |
|--------|-------------|----------|
| Keep S as runtime UI cache, load from API on init | S.spieler populated via GET /api/players; S.aktSpiel stores gameId + server state. Every write goes through fetch(). | ✓ |
| Remove S entirely, use module-level variables per feature | Replace monolithic S with separate variables per feature. Cleaner but touches every render function. | |
| You decide | Claude picks based on minimal blast radius. | |

**User's choice:** Keep S as runtime UI cache, load from API on init

| Option | Description | Selected |
|--------|-------------|----------|
| No — defer custom types to Phase 4 | Phase 3 success criteria only require 9 built-in types. PERS-03 is Phase 4 scope. | ✓ |
| Yes — wire it now if the backend already supports it | game_type_defs table exists (empty). Risk of scope creep. | |

**User's choice:** Defer custom game type creator to Phase 4

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — load game history from GET /api/games | Success criterion 3 requires completed games to be visible. Feeds Spiele tab. | ✓ |
| Minimal — only show just-completed game after finishing | Post-game result inline, no history list. Doesn't fully satisfy criterion 3. | |

**User's choice:** Yes — load game history from GET /api/games

---

## Login / Auth UX

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen overlay on page load if no session | DOMContentLoaded → GET /api/auth/status → show PIN modal if unauthenticated. App blocked until PIN verified. | ✓ |
| Separate /login page | Server serves login.html, redirect back to / after PIN submit. Extra route + file. | |
| Inline prompt at the top of each tab | Write actions show inline PIN banner. Read-only views stay accessible. | |

**User's choice:** Full-screen overlay on page load if no session

| Option | Description | Selected |
|--------|-------------|----------|
| No — omit logout for this club app | Shared PIN, no per-user session to protect. Session expires naturally. | ✓ |
| Yes — small logout link in the top bar | Calls POST /api/auth/logout, re-shows PIN overlay. | |

**User's choice:** No logout button

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — small dot in topbar | Reuses Phase 2 green/red dot pattern. Tablet users benefit from knowing socket state. | ✓ |
| No — only TV needs it | Throws go over HTTP; socket disconnect is silent degradation on input side. | |

**User's choice:** Yes — small connection dot in topbar

---

## Active Game Recovery on Refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-resume: switch to Spielen tab and show current game state | On init, GET /api/games?status=active → populate S.aktSpiel + navigate to Spielen tab automatically. | ✓ |
| Show a 'Game in progress — resume?' banner | Don't auto-switch; show resumption prompt on Spiele tab. More intentional UX. | |

**User's choice:** Auto-resume, no confirmation prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Add GET /api/games with optional ?status filter | Small route addition; serves both recovery (active) and history tab (finished). Two birds, one endpoint. | ✓ |
| Store gameId in sessionStorage and use GET /api/games/:id | Works for refresh, fails if storage cleared or browser switched. | |

**User's choice:** Add GET /api/games with ?status filter

---

## Socket.io Client in Input UI

| Option | Description | Selected |
|--------|-------------|----------|
| Subscribe to throw:applied / undo:applied, re-render from server state | Client joins game room; updates S.aktSpiel.state from server event; re-renders. Keeps tablet in sync. | ✓ |
| Optimistic local update only, no socket subscription on input UI | Tablet updates local state from HTTP response. Simpler but undo/concurrent-session edge cases could desync. | |
| You decide | Claude picks the approach that minimises complexity. | |

**User's choice:** Subscribe to throw:applied / undo:applied, re-render from server state

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — auto-switch to Spielen tab on game:started | If another device starts a game, input device auto-navigates. Consistent with TV. | ✓ |
| No — only the device that starts the game navigates | Other tabs ignore game:started; user navigates manually. | |

**User's choice:** Yes — listen to game:started, auto-switch to Spielen tab

| Option | Description | Selected |
|--------|-------------|----------|
| Show a results screen / winner banner, then return to Spiele tab | Winner banner + navigate to Spiele tab on game:finished. Implements Phase 2 deferred TV idle transition too. | ✓ |
| Auto-transition to idle screen on input UI (same as TV) | Implements the Phase 2 deferred item simultaneously on both surfaces. | |

**User's choice:** Results/winner banner, then navigate to Spiele tab

---

## Claude's Discretion

No areas were fully deferred to Claude's discretion. All questions had explicit user choices.

## Deferred Ideas

- **Custom game types (PERS-03):** `m-st` modal + `startGenSpiel` disabled in Phase 3. Phase 4 scope.
- **Full statistics (STAT-01/02/03):** Statistik tab stays placeholder or "Coming soon" in Phase 3. Phase 4 scope.
- **Player management write operations (BACK-01, PERS-01):** Backend API exists; not in Phase 3 success criteria. Stretch goal at best.
