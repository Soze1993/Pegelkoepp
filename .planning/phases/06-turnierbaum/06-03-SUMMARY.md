---
phase: 06-turnierbaum
plan: "03"
subsystem: frontend-tablet-ui
tags: [kda, bracket, tournament, ui, modal]
dependency_graph:
  requires: [06-02]
  provides: [tablet-bracket-ui, throw-entry-modal, format-detection-switch]
  affects: [public/index.html]
tech_stack:
  added: []
  patterns: [textContent-only XSS guard, createElement+appendChild DOM, sequential-await throw submission, bottom-sheet modal]
key_files:
  modified:
    - Claude/public/index.html
decisions:
  - "renderKDASpiel became a dispatcher: state.bracket present routes to renderKDABracket, otherwise to renderKDALegacy (old body preserved verbatim)"
  - "submitKDAWurfe uses sequential await pattern — each throw awaited before next, matching PATTERNS.md sequential submission requirement"
  - "throw_index for submitKDAWurfe derived from slot.throws.length + loop offset to match server expectation"
  - "GF modal collects p1-throw0, p2-throw0, p1-throw1, p2-throw1 interleaved order for submit list"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-23"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 6 Plan 03: DE Bracket Tree UI + Throw-Entry Modal Summary

DE bracket tree renderer, throw-entry modal, format-detection switch, and KDA start dialog validation added to `index.html` tablet view.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update KDA start dialog (D-12 validation) and add throw modal HTML | e3dc73e | public/index.html |
| 2 | Implement bracket renderer and throw-entry modal logic | e3dc73e | public/index.html |

## What Was Built

### Format Detection Dispatcher (`renderKDASpiel`)
`renderKDASpiel(el, state)` now acts as a thin router:
- `!state` → clears element
- `state.bracket` present → calls `renderKDABracket` (new DE bracket tree)
- Otherwise → calls `renderKDALegacy` (old match-list view, body moved verbatim)

### Bracket Tree Renderer (`renderKDABracket`)
Builds W-bracket, L-bracket, and GF sections as horizontally-scrollable CSS flexbox layout. Uses `createElement`+`textContent` throughout — no `innerHTML` with DB strings. Sections: Winner Bracket (top), Loser Bracket (below), Grand Final (own section). Round labels use the copywriting contract from UI-SPEC (W · Runde 1, W · Halbfinale, etc.).

### Bracket Slot (`buildBracketSlotEl`)
140px × 56px slots with:
- Active slots: amber border, pointer cursor, onclick → `openKDAWurfModal`
- Done slots: winner row (green tint), loser row (red tint), 1px divider
- Bye slots: 0.45 opacity, dashed border
- In-progress scores: value + ' ⚫' in amber
- All names/scores via `textContent`

### Throw-Entry Modal (`#m-kda-wurf`)
Bottom-sheet modal with:
- Dynamic title (`m-kda-wurf-title`) and badge (`m-kda-wurf-badge`)
- Player sections: emoji avatar, name, 0–9 pin grids (`.kgrid`/`.kb`)
- Grand Final: 2 throw rows per player labelled "Wurf 1"/"Wurf 2" + running total
- Tiebreak: "Stechen — Gleichstand!" amber header + extra throw row
- Confirm button enabled only when all required pins selected
- ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="m-kda-wurf-title"`

### Sequential Submit (`submitKDAWurfe`)
Submits throws in order: interleaves p1-t0, p2-t0, p1-t1, p2-t1 for GF (4 API calls). Each `await submitThrow(...)` checked before proceeding. `S.aktSpiel.state` updated from each response. Modal closes on success or `handleGameFinished` called if `data.finished`.

### KDA Start Dialog Updates
- Label: "Spieler (min. 4, max. 12)"
- Counter: `#m-kda-counter` updates live on every toggle — green (4–12), red (otherwise)
- Validation: `kdaSel.length < 4 || kdaSel.length > 12` → notify 'Mind. 4 Spieler (max. 12)'
- Button: "Turnier starten"

### CSS Added
New classes inside existing `<style>` tag: `.kda-bracket-scroll`, `.kda-bracket`, `.kda-bracket-section`, `.bracket-section-title`, `.bracket-cols`, `.bracket-col`, `.bracket-round-label`, `.bracket-slot`, `.bracket-slot.active`, `.bracket-slot.bye`, `.bracket-slot-divider`, `.bracket-player-row`, `.bracket-player-row.winner-row`, `.bracket-player-row.loser-row`, `.bracket-player-name`, `.bracket-player-score`, `.kda-winner-banner`, `.kda-wurf-*` modal classes.

## Deviations from Plan

None — plan executed exactly as specified. All must_haves satisfied.

## Self-Check

### Files Exist
- [x] `Claude/public/index.html` — modified (454 lines added)

### Commits Exist
- [x] `e3dc73e` — feat(06-03): add DE bracket tree UI and throw-entry modal to tablet view

### Verification Checks (Automated)
All 12 node checks pass:
- `counter: true` — `#m-kda-counter` present
- `modal: true` — `#m-kda-wurf` modal present
- `min4: true` — `kdaSel.length < 4` guard present
- `max12: true` — `kdaSel.length > 12` guard present
- `turnier: true` — "Turnier starten" button text present
- `renderKDABracket: true`
- `renderKDALegacy: true`
- `state.bracket: true` — format detection present
- `openKDAWurfModal: true`
- `submitKDAWurfe: true`
- `no innerHTML kda: true` — no innerHTML with player.name/emoji
- `textContent: true`

## Self-Check: PASSED

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All changes are client-side DOM rendering within existing game view. XSS mitigations T-06-03-01 and T-06-03-02 implemented: all player name/emoji rendering uses `textContent`. Pin value range 0–9 enforced by button grid only (T-06-03-03 frontend layer). Slot access guard in `openKDAWurfModal` (T-06-03-04).

## Manual Verification Required (VALIDATION.md)

1. Start a 4-player KDA game on tablet — bracket tree renders W-bracket, L-bracket, GF columns
2. Tap an active bracket slot — throw modal opens with pin grids for both players
3. Enter pin counts and confirm — bracket updates
4. Open a pre-Phase-6 KDA game from history — old match-list view renders (uses renderKDALegacy, no crash)
5. Try starting KDA with 3 players — error notification "Mind. 4 Spieler (max. 12)" appears
