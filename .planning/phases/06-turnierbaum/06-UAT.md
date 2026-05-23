---
status: complete
phase: 06-turnierbaum
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md
started: 2026-05-23T00:00:00.000Z
updated: 2026-05-23T12:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. KDA Start Dialog — Player Counter
expected: |
  Open the KDA start modal (Kegler des Abends). The label now reads "Spieler (min. 4, max. 12)".
  Below the player selection chips, a counter shows "0 Spieler ausgewählt" in red.
  As you tap players: 1–3 selected → counter stays red. 4–12 selected → counter turns green.
  The start button is labelled "Turnier starten".
result: pass

### 2. KDA Start — Minimum Player Validation
expected: |
  In the KDA start modal, select only 3 players (or fewer) and tap "Turnier starten".
  A red notification appears: "Mind. 4 Spieler (max. 12)". The game does NOT start.
result: skipped
reason: User already had a 7-player game active — couldn't test without disrupting it

### 3. Start a 4-Player KDA Tournament
expected: |
  Select exactly 4 players in the KDA start modal and tap "Turnier starten".
  The tournament starts without error. The Spielen tab switches to the KDA game view.
result: pass
reported: "User started with 7 players — game started successfully"

### 4. Bracket Tree Layout
expected: |
  After starting a 4-player KDA game, the bracket tree renders with three sections:
  "Winner Bracket" at top, "Loser Bracket" below it, and a Grand Final section.
  Each section shows slots with player names. Active (playable) slots have an amber/gold border.
  Bye slots (if any) appear faded with a dashed border.
result: pass
reported: "Tablet bracket tree correct. TV name overflow noted — logged on Test 8."

### 5. Tap Active Slot — Throw Modal Opens
expected: |
  Tap an active slot (amber border) in the bracket tree.
  A bottom sheet modal opens showing both players' names and a 0–9 pin grid for each.
  The "Wurf bestätigen" confirm button is disabled (greyed out) until both players have a pin selected.
result: pass

### 6. Enter Throws — Bracket Updates
expected: |
  In the throw modal, tap a pin number for Player 1 and a pin number for Player 2.
  The confirm button becomes active. Tap "Wurf bestätigen".
  The modal closes, and the bracket tree updates: the slot now shows scores next to each player name.
  If one player scored more, that slot is resolved (winner row green, loser row red, a divider appears).
  The winner advances — their name appears in the next downstream slot.
result: fixed
reported: "Works in W-bracket. In L-bracket slots, a 'Doppelter Wurf' (double throw) error appeared."
severity: major
fix: "Server now auto-computes throw_index as MAX+1 per player for KDA games (games.js). Client fix also applied (kdaPlayerThrowCount). Confirmed working after server restart."

### 7. Old KDA Games — Legacy View Still Works
expected: |
  Navigate to Ergebnisse (history). Find a KDA game created BEFORE this update (one that used the old match-list format).
  Open it. It renders with the old match-list view (not a bracket tree) — no crash, no blank screen.
  (If no old KDA games exist yet, skip with "no old games".)
result: skipped
reason: No pre-Phase-6 KDA games exist yet to test against

### 8. TV — Bracket Tree Displayed Live
expected: |
  With a KDA game active, open the TV view (the /tv URL on a second device or tab).
  The TV shows the full bracket tree (not the idle screen, not the player list).
  W-bracket, L-bracket, and Grand Final sections appear. Active slot has amber glow.
  After submitting a throw on the tablet, the TV updates automatically without page reload —
  the score appears in the bracket slot as "N ⚫" before the match is complete.
result: issue
reported: "Player names overflow/don't fit within slot borders on TV at 1920x1080"
severity: major

## Summary

total: 8
passed: 4
fixed: 1
issues: 1
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "submitKDAWurfe submits with correct game-wide throw_index per player across all bracket matches"
  status: fixed
  reason: "User reported: 'Doppelter Wurf' (409) when submitting throws in L-bracket"
  severity: major
  test: 6
  root_cause: "submitKDAWurfe used slot.throws.length (match-local, resets to 0 per slot) as throw_index base. DB UNIQUE constraint is (game_id, player_id, throw_index) — game-wide. When a player reaches L-bracket, their new slot.throws.length=0 collides with their W-bracket throw_index=0."
  artifacts:
    - path: "Claude/public/index.html"
      issue: "submitKDAWurfe: replaced currentThrowCount+j with kdaPlayerThrowCount(bracket, playerId) — counts all throws for the player across the entire bracket"
  missing: []
  fix_commit: "cfc2347 (client), 9e483c4 (server)"

- truth: "TV bracket tree renders player names within slot borders at 1920x1080 without overflow"
  status: failed
  reason: "User reported: Player names overflow/don't fit within slot borders on TV at 1920x1080"
  severity: major
  test: 8
  root_cause: "buildTVSlotEl in tv.js:238 — nameSpan has no overflow:hidden/text-overflow:ellipsis/white-space:nowrap. The flex row (justify-content:space-between) does not constrain the name span, so long names push past the fixed slot width (140–200px). Fix: add overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0 to nameSpan."
  artifacts:
    - path: "Claude/public/tv.js"
      issue: "buildTVSlotEl nameSpan (line 238) missing overflow/truncation CSS — name overflows slot"
  missing:
    - "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0 on nameSpan"
    - "flex-shrink:0 on scoreSpan to prevent score from being squeezed"
  debug_session: ""
