---
phase: 11-profilbilder
plan: "03"
subsystem: tv
tags: [tv, avatar, profile-photo, idle-screen, generic-renderer]
dependency_graph:
  requires: [11-01]
  provides: [TV-idle-player-grid, TV-generic-avatar]
  affects: [public/tv.html, public/tv.js]
tech_stack:
  added: []
  patterns: [overlay-avatar, emoji-fallback, textContent-only, race-condition-self-heal]
key_files:
  created: []
  modified:
    - public/tv.html
    - public/tv.js
decisions:
  - "Avatar overlay pattern: emoji div underneath, img absolutely positioned on top — onerror hides img to reveal emoji (no broken icon)"
  - "Race condition handled via self-healing fetch: renderPlayerGrid() re-fetches /api/players if tvPlayers is null when called"
  - "Generic renderer only: game-type-specific renderers (FJ, VG, BK, KDA, HN, PM, Anker, DreiVollen) left untouched per D-20"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-15"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
---

# Phase 11 Plan 03: TV Profilbilder (Idle Grid + Generic Renderer) Summary

**One-liner:** TV idle screen now shows an 80px round avatar grid per non-guest player, and the generic game renderer shows a 40px round avatar left of each player name — both with emoji fallback via img.onerror.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add #player-grid div to tv.html idle section | d271db9 | public/tv.html |
| 2 | Add tvPlayers cache + renderPlayerGrid() + update renderIdle() | cb2fcf0 | public/tv.js |
| 3 | Add 40px avatar to generic playerListEl loop | 53482ff | public/tv.js |

## What Was Built

**tv.html:** Added `<div id="player-grid">` as last child of `#idle`, after `#lastWinnerText`. Styled inline with `auto-fill minmax(120px,1fr)` grid, `max-height:40vh`, `overflow:hidden` — no CSS class added to avoid regression in existing style block.

**tv.js — tvPlayers cache:** Module-level `var tvPlayers = null;` added after `var tvHighlights`. DOMContentLoaded now pre-fetches `/api/players` to populate the cache before `renderIdle()` fires.

**tv.js — renderPlayerGrid():** New function placed between `renderIdle()` and `renderGame()`. Handles null tvPlayers race condition by re-fetching and calling itself once resolved. For each non-guest player, builds a cell with an 80px overlay avatar (emoji div + absolutely-positioned img) and player name via textContent. img.onerror hides the img to reveal the emoji fallback.

**tv.js — renderIdle() update:** Added `renderPlayerGrid()` call at end of renderIdle(), after `renderHighlightsHdr()`.

**tv.js — generic renderer:** Replaced single nameEl (containing emoji + name) with avEl (40px overlay avatar) prepended before nameEl. nameEl now contains only `player.name` (emoji moved to avEmoji inside avEl). appendChild order: avEl → nameEl → throwEl → scoreEl.

## Deviations from Plan

None — plan executed exactly as written.

## Security / Threat Model

All player names and emojis reach the DOM via `textContent` exclusively (T-02-02). img.src uses numeric `player.id` only — no user-controlled string interpolation in the URL path segment. No new packages. No new endpoints. /api/players was already a public endpoint (T-11-11: accepted).

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- public/tv.html contains `player-grid`: confirmed
- public/tv.js contains `tvPlayers`, `renderPlayerGrid`, `avImg`, `avEmoji`, `nameEl.textContent = player.name`: confirmed
- All three commits exist: d271db9, cb2fcf0, 53482ff
