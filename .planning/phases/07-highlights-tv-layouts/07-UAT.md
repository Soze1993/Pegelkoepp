---
status: partial
phase: 07-highlights-tv-layouts
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md, 07-08-SUMMARY.md]
started: 2026-05-24T00:00:00Z
updated: 2026-05-24T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Start from scratch (node server/server.js or npm start). Server boots without errors. No crash or missing-module messages in the console. A basic request like GET /api/stats or the app root returns live data.
result: pass

### 2. Highlights API — Endpoint Response
expected: Call GET /api/highlights/current (e.g. via curl or browser). Response is HTTP 200 JSON with two fields: kda_champion (player object or null) and bk_loser (player object or null). If at least one KDA game and one BK game have been finished in the DB, both fields are non-null and contain player name/id fields.
result: pass

### 3. Highlights API — No Auth Required
expected: Call GET /api/highlights/current without being logged in (fresh browser tab, no session cookie). The endpoint still returns 200 with data — it is a public endpoint and does not redirect to login.
result: pass

### 4. TV: KDA Game-End Overlay
expected: On the TV screen (/tv), finish a KDA (Kegler des Abends) game. Immediately after the game ends, the TV shows a full-screen amber overlay with a 🏆 emoji and the winner's name. The overlay stays for 10 seconds, then the TV returns to the idle/waiting screen.
result: pass

### 5. TV: BK Game-End Overlay
expected: On the TV screen (/tv), finish a Bilderkegel game. Immediately after the game ends, the TV shows a full-screen red overlay with a 💩 emoji and the loser's name (lowest bkTotal). The overlay stays for 10 seconds, then the TV returns to the idle screen.
result: pass

### 6. TV: Bilderkegel Live Layout
expected: During an active Bilderkegel game, the TV screen shows a player list with each player's current Bilderkegel score. The player with the lowest total (the loser) has their row highlighted in red. At game start (before any throws), no row is highlighted red (loser guard prevents false positive).
result: pass

### 7. TV: Fuchsjagd Live Layout
expected: During an active Fuchsjagd game, the TV screen shows a split layout: Fuchs on one side, Jäger on the other. The Fuchs's running fp score is shown prominently (large font). Layout updates live as throws are entered.
result: issue
reported: "Layout funktioniert und sieht gut aus, aber Fuchsjagd endet nicht nach 5 Runden"
severity: major

### 8. TV: Viergewinnt Live Layout
expected: During an active Viergewinnt game, the TV screen shows Team X on the left, a VS divider in the center, and Team O on the right. When the game ends, the winning team is shown at full opacity while the losing team is dimmed to 0.6 opacity.
result: issue
reported: "Overlay gefällt nicht — komplettes Redesign gewünscht: echtes Viergewinnt-Spielfeld (Raster mit Steinen) live auf dem TV-Screen statt Team-X-VS-Team-O-Layout"
severity: major

### 9. Tablet: KDA Champion Symbol
expected: Open the tablet view (index.html). In any player list that shows the current KDA champion, a 🏆 emoji appears next to that player's name. This works immediately on page load (populated from /api/highlights/current) — no interaction required.
result: pass

### 10. Tablet: BK Loser Symbol
expected: In any player list on the tablet that shows the current BK loser, a 💩 emoji appears next to that player's name. Visible on page load without any interaction.
result: pass

### 11. Tablet: Symbols Refresh After Game
expected: After any game finishes (game:finished event fires), the 🏆 and 💩 symbols on the tablet player lists update to reflect the new highlights — without requiring a page reload. The old champion/loser symbol disappears and the new one appears in place.
result: pass

### 12. Fuchsjagd — ends after 6 rounds
expected: Start a FJ game. After 6 Runden (6 rounds per Jäger) are complete, the game ends automatically without manual intervention. TV shows the overlay.
result: pass

### 13. KDA 4-player bracket — L-R1 slot
expected: Start a KDA game with exactly 4 players. After both W-R1 matches complete, a third game (L-R1) appears in the loser bracket, matching both R1-losers against each other. The bracket has 6 slots total: W-R1×2, W-Final, L-R1, L-Final, Grand Final.
result: pass

### 14. Bilderkegel — early advance on max (non-Volle)
expected: When playing Kleeblatt (max=6) and the first throw knocks down 6 pins, the system immediately advances — no second throw is offered. When playing Volle (max=12), two throws are always given regardless of first-throw score.
result: pass

### 15. Bilderkegel — Kleeblatt pin formation
expected: The Kleeblatt pin SVG in the tablet view shows 6 active pins (3 center pins: front, mid, and back-center are all highlighted). No missing pin at the back.
result: pass

### 16. Bilderkegel — winner name in overlay
expected: After a Bilderkegel game ends, the game-end overlay shows the actual winner's name (e.g. "Tobi hat gewonnen!"), not "Unbekannt".
result: pass

### 17. Drei-Vollen — stechen at tie
expected: If 2 or more players are tied for first in Drei-Vollen, the game enters a stechen (tiebreaker) phase instead of ending immediately. A "Stechen überspringen" option is visible. If pressed, the game ends with no declared winner.
result: pass

### 18. TV overlay — auto-dismiss (no stuck)
expected: After a KDA or BK game ends, the TV overlay appears and auto-dismisses after 10 seconds. Triggering another game-end immediately after works cleanly — the old overlay doesn't stack or get stuck. No TV reload required.
result: pass

### 19. TV — game name header
expected: During any active game on the TV screen, the game type name is displayed at the top of the layout (e.g. "Bilderkegel", "Fuchsjagd", "Viergewinnt").
result: issue
reported: "Drei in die Vollen zeigt den Namen, Große Hausnummer nicht — Spielname fehlt im TV-Layout für Große Hausnummer"
severity: minor

### 20. TV Bilderkegel — Bild display
expected: During an active Bilderkegel game, the TV shows the current Bild name (e.g. "Kleeblatt"), a pin-formation SVG, and a "Bild 1/5" counter above the player list. Updates as the game progresses through Bilder.
result: pass

### 21. TV idle — highlights bar
expected: When no game is active, the TV idle screen shows a highlights bar with "KDA-Sieger: [name]" and "BK-Verlierer: [name]" (if data is available from previous games).
result: issue
reported: "Highlights-Bar zeigt KDA-Sieger und BK-Verlierer nicht an im TV-Idle-Screen"
severity: major

### 22. TV Viergewinnt — real 9×9 board
expected: During an active Viergewinnt game, the TV shows a 9-column grid of circles (empty/X/O coloured), column numbers 1–9, and team headers with player names. When the game ends, the losing team's side is dimmed to 0.5 opacity. The winner banner shows "TEAM X" or "TEAM O" — not a single player name.
result: issue
reported: "TV-Layout soll überarbeitet werden: 6 Spieler (alle Team-Mitglieder) plus das 9×9-Grid müssen gleichzeitig sichtbar sein. Referenz-Design: Downloads/kegel_app_viergewinnt_fix.html"
severity: major

### 23. Undo button in game views
expected: During any active game (in the spielen tab on the tablet), a "↩ Rückgängig" button is visible. Pressing it reverses the last throw and the displayed state updates accordingly. The button disappears after the game ends.
result: pass

### 24. Game-end audio tones
expected: When a KDA game ends, an ascending arpeggio tone plays automatically. When a Bilderkegel game ends, a distinct descending tone sequence plays. Both tones play via the browser (no external audio files required). The two tones are clearly different.
result: issue
reported: "Kein Ton zu hören bei KDA- oder BK-Spielende"
severity: major

## Summary

total: 24
passed: 17
issues: 8
pending: 0
skipped: 0
blocked: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Bilderkegel winner banner shows the correct winner name (highest bkTotal), not 'Unbekannt'"
  status: failed
  reason: "User reported: nach Bilderkegel-Sieg von Tobi erschien 'Unbekannt hat gewonnen' — Winner-Ermittlung für Bilderkegel im showWinnerBanner falsch oder fehlend"
  severity: major
  test: 11
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Drei in die Vollen: if two or more players are tied for first place, a tiebreaker (Stechen) is offered. Stechen can be skipped — if skipped, no winner is declared for that game."
  status: failed
  reason: "User requested: bei Gleichstand Stechen anbieten mit Option zum Überspringen; wenn übersprungen → kein Gewinner. Aktuell kein Tiebreaker-Mechanismus vorhanden."
  severity: major
  test: pre-discovery
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Bilderkegel: if two or more players are tied for last place (lowest bkTotal), a mandatory tiebreaker (Stechen) is triggered — cannot be skipped, loser must be determined because they pay the next day"
  status: failed
  reason: "User clarified: Stechen bei BK-Gleichstand ist Pflicht (nicht überspringbar) — der Verlierer muss am nächsten Tag bezahlen, daher muss ein Verlierer feststehen"
  severity: major
  test: pre-discovery
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "TV overlay (KDA winner / BK loser) always clears and returns to idle after 10 seconds without requiring a page reload"
  status: failed
  reason: "User reported: Overlay buggt manchmal — kommt nur durch TV-Reload raus; vermutlich mehrere simultane setTimeouts oder fehlender Cleanup beim erneuten Overlay-Aufruf"
  severity: major
  test: 4-5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "TV screen shows persistent highlights bar next to the green online dot: 'Letzter Abend KDA: [name]' and 'Loser Bilderkegeln: [name]'"
  status: failed
  reason: "User requested: Highlights-Info dauerhaft im TV-Header neben grünem Punkt anzeigen — aktuell keine Highlights im TV-Header vorhanden"
  severity: minor
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "After Viergewinnt game ends, idle/winner display shows the team name (e.g. 'Team X' or 'Team O'), not a single player name"
  status: failed
  reason: "User reported: bei Viergewinnt-Sieg wird in der Idle-Ansicht nur ein Spielername angezeigt statt des Teamnamens"
  severity: major
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "TV Viergewinnt layout shows actual Connect Four game board (grid with colored pieces) updating live — not a Team X vs Team O text layout"
  status: failed
  reason: "User reported: TV-Layout soll überarbeitet werden: 6 Spieler (alle Team-Mitglieder) plus das 9×9-Grid müssen gleichzeitig sichtbar sein. Referenz-Design: Downloads/kegel_app_viergewinnt_fix.html"
  severity: major
  test: 22
  root_cause: ""
  artifacts: ["Downloads/kegel_app_viergewinnt_fix.html"]
  missing: []
  debug_session: ""

- truth: "Fuchsjagd game ends automatically after 6 rounds"
  status: failed
  reason: "User reported: Fuchsjagd endet nicht nach 6 Runden — Spielende-Logik fehlt oder greift nicht"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Bilderkegel: for Kleeblatt/Hinterer Kranz/Damen/Bauern — if max score is reached with throw 1, no second throw is awarded. Volle always gets 2 throws (max 12 can only be reached across both throws)."
  status: failed
  reason: "User reported: bei Kleeblatt (max 6) nach Abräumen mit einem Wurf trotzdem zweiten Wurf bekommen. Regel: Volle=immer 2 Würfe (max 12 nur über 2 erreichbar); Kleeblatt=6, Hinterer Kranz=5, Damen=4, Bauern=2 — bei diesen kein 2. Wurf wenn Max in Wurf 1 erreicht."
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Bilderkegel has an undo button to reverse the last throw entry"
  status: failed
  reason: "User reported: kein Knopf um Wurfeinträge rückgängig zu machen — Feature fehlt komplett"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Bilderkegel Bild thumbnails in tablet view (non-TV) are fully visible, not clipped"
  status: failed
  reason: "User reported: Bilder sind etwas abgeschnitten in der App (nicht TV-Modus) — Screenshot TVmodus2.PNG zeigt Thumbnail-Row mit Volle/Kleeblatt/Hint. Kranz/Damen/Bauern"
  severity: minor
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "TV Bilderkegel layout shows the current Bild (pin formation image) so players know what to throw"
  status: failed
  reason: "User reported: Bilder nicht angezeigt im TV-Screen bei Bilderkegel — Spieler können nicht erkennen welches Bild sie werfen müssen"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "TV screen shows the game name for all game types"
  status: failed
  reason: "User reported: Spielname fehlt in der TV-Ansicht bei allen Spielen"
  severity: minor
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "When KDA or BK end overlay fires, a fitting audio track plays"
  status: failed
  reason: "User reported: Kein Ton zu hören bei KDA- oder BK-Spielende — Web Audio API-Töne werden nicht abgespielt (möglicherweise Autoplay-Block durch Browser oder Fehler in playGameEndTone)"
  severity: major
  test: 24
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "TV screen shows the game name for all game types including Große Hausnummer"
  status: failed
  reason: "User reported: Drei in die Vollen zeigt den Namen korrekt, aber Große Hausnummer zeigt keinen Spielnamen im TV-Layout — TV-Renderer für Große Hausnummer hat kein typeKey/name-Rendering"
  severity: minor
  test: 19
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "When a game is ended via the 'Spiel beenden' button, the game is marked finished in the database so that a page refresh (F5) does not cause it to reappear as active"
  status: failed
  reason: "User reported: Spiel via 'Spiel beenden' beendet → F5 → Spiel taucht wieder auf. Vermutlich fehlt der Backend-Aufruf zum Persistieren des Spielendes; nur Client-State wird geändert."
  severity: major
  test: ad-hoc
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "When a new game starts on the TV, any previous game-end overlay is cleared and does not reappear"
  status: failed
  reason: "User reported: Nach Bilderkegeln → TV idle → Große Hausnummer starten → altes BK-Verlierer-Overlay erscheint erneut. Overlay wird beim Start eines neuen Spiels nicht gecleart."
  severity: major
  test: ad-hoc
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Bilderkegel Kleeblatt pin formation: 3 center pins are white (front-center, mid-center, back-center)"
  status: failed
  reason: "User reported: hinterster Kegel fehlt — nur 2 statt 3 Kegel in der Mitte weiß; Kleeblatt-Formation falsch dargestellt"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "KDA double-elimination bracket with 4 players: the 2 Round-1 losers play each other in a Loser Bracket Final, and the WBF loser then plays the LBF winner in the Grand Final"
  status: failed
  reason: "User reported: currently only one loser bracket game exists; the two Round-1 losers don't play each other, and the WBF loser does not get a second chance against the LB winner. Affects all player counts — each count needs its own bracket shape verified."
  severity: major
  test: pre-discovery (found during Test 4 setup)
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
