---
status: complete
phase: 12-tv-layout-polish
started: 2026-06-15
updated: 2026-06-17
result: pass
---

## Current Test

### Test 1: Fuchsjagd TV — 7+ Jäger

## Tests

### 1. Fuchsjagd TV — 7+ Jäger (adaptive Layout)
expected: Bei 7–9 Jägern: Avatar 56px, kleinere Schrift — alle Jäger sichtbar ohne Clipping
result: pass

### 2. Fuchsjagd TV — 10+ Jäger (compact Layout)
expected: Bei 10–11 Jägern: Avatar 40px, Schrift lesbar aus 8m/42"
result: pass
note: Schriftgröße nach UAT-Feedback angepasst: 32px (≥10), 36px (7–9), 40px (≤6) — commit 7ab376e

### 3. Fuchsjagd TV — Fuchs-Avatar immer 80px
expected: Fuchs-Avatar bleibt immer 80px unabhängig von der Jäger-Anzahl
result: pass

### 4. KDA Bracket TV — W oben / L unten
expected: Winner Bracket erscheint oben (volle Breite), Loser Bracket darunter (volle Breite); keine geteilte Ansicht mehr
result: pass
note: commit 55357f4 — side-by-side entfernt, immer gestapelt

### 5. KDA Bracket TV — Großes Finale erst bei Finalisten
expected: GF-Slot ist NICHT sichtbar wenn noch kein Finalist feststeht; erscheint erst wenn gfSlot.p1 && gfSlot.p2 beide gesetzt
result: pass

### 6. KDA Bracket TV — Loser Bracket Label rot
expected: "Loser Bracket" Label erscheint in var(--red), nicht in var(--ac) (gelb)
result: pass

### 7. Lesbarkeit aus 8m / 45 Zoll
expected: Alle relevanten Spielernamen und Scores auf FJ- und KDA-TV-Screen aus ca. 8m Distanz lesbar
result: pass

### 8. Kleine Hausnummer TV
expected: Layout passt auf Bildschirm, alle Spieler sichtbar
result: pass

### 9. Plus Minus TV
expected: Layout passt auf Bildschirm, alle Spieler sichtbar
result: pass

### 10. Anker TV
expected: Layout passt auf Bildschirm, alle Spieler sichtbar
result: pass
