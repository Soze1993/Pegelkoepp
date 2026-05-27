---
phase: 09-polish
plan: 02
subsystem: frontend
tags: [whatsapp, share, modal, frontend-only]
requirements: [SHARE-01]

dependency_graph:
  requires: []
  provides: [SHARE-01]
  affects: [showGameDetail()]

tech_stack:
  added: []
  patterns: [wa.me share URL, encodeURIComponent XSS guard]

key_files:
  modified:
    - public/index.html

decisions:
  - Used sp2 (not sp) for inner player lookup to avoid shadowing the outer sorted.forEach variable
  - Used – (em-dash literal) in share text to avoid encoding issues in WhatsApp preview
  - waUrl.replace(/'/g, '%27') escapes the onclick string delimiter; encodeURIComponent handles everything else

metrics:
  duration: 5m
  completed: 2026-05-27
  tasks_completed: 1
  files_modified: 1
---

# Phase 09 Plan 02: WhatsApp Share Button Summary

WhatsApp share button added to the finished-game detail modal — clicking opens wa.me with a formatted German game summary including type, date, and ranked player results.

## What Was Built

Inside `showGameDetail()` in `public/index.html`, immediately after `html += '</tbody></table>';` (within the `if (data.results && data.results.length)` block), the following was added:

1. **Share text builder** — iterates the already-sorted `sorted` array and constructs lines:
   - Header: `🎳 Pegelköpp – {typName}`
   - Date line: `📅 {DD.MM.YYYY}` (omitted if `dateStr` is empty)
   - Blank separator line
   - One line per player: `{rank}. {emoji} {name}[ – {score}][ 🏆][ 💸 zahlt!]`

2. **WhatsApp URL** — `https://wa.me/?text=` + `encodeURIComponent(shareText)`

3. **Button** — appended to `html` using existing `.btn .bg .sm` classes, full width, 12px top margin. Opens URL via `window.open(..., '_blank')`.

## Lines Changed

`public/index.html` — after line 707 (`html += '</tbody></table>';`), 17 lines inserted. Total: +18 lines, -1 blank (net +17).

## Security

| Threat | Mitigation |
|--------|-----------|
| XSS via player name in onclick | Names go into `encodeURIComponent(shareText)` only — never into raw innerHTML |
| Apostrophe in onclick string | `waUrl.replace(/'/g, '%27')` handles the delimiter |

## Test Results

`node --test`: 433 tests, 0 failures.

## Deviations from Plan

None — plan executed exactly as written. Used `sp2` for the inner player lookup as specified (outer loop uses `sp`).

## Self-Check: PASSED

- `public/index.html` contains `wa.me`: confirmed
- `public/index.html` contains `Via WhatsApp teilen`: confirmed
- `public/index.html` contains `encodeURIComponent`: confirmed
- `public/index.html` contains `window.open`: confirmed
- Commit `669ba36` exists: confirmed
- `node --test` exits 0 (433/433): confirmed
