---
phase: 12-tv-layout-polish
plan: "01"
subsystem: tv-renderers
tags: [tv, layout, position-fixed, samsung, kda, fuchsjagd, hausnummer, plus-minus, anker]
dependency_graph:
  requires: [11-01, 11-02, 11-03]
  provides: [all-tv-layouts-fixed]
  affects: [public/tv.js, public/tv.html]
tech_stack:
  added: []
  patterns:
    - "position:fixed;top:0;left:0 auf allen TV-Renderer-Containern — umgeht #game{padding} Verschiebung"
    - "topPad = max(pad, vh*0.065) — adaptiver Puffer für TV-Overscan"
    - "align-content:stretch für Grid-Renderer — Rows verteilen sich gleichmäßig ohne Overflow"
    - "isCompact (vh<600) für Samsung TV DPR=2 — kleinere Schrift/Slots ohne side-by-side"
key_files:
  modified:
    - public/tv.js
    - public/tv.html
decisions:
  - "Fix-Pattern: position:fixed;top:0;left:0 für alle TV-Renderer (#game padding verschiebt sonst Container)"
  - "Grid-Renderer: align-content:stretch statt align-content:start (Rows füllen volle Höhe)"
  - "KDA: immer gestapelt (W oben, L unten) — side-by-side Compact-Pfad nach Realabend-Test revertiert"
  - "Samsung TV DPR=2 (vh≈480): isCompact-Flag für kleinere Slots/Schrift, aber gleiches Stacking-Layout"
  - "viewport width=1920 statt device-width — Samsung TV DPR=2 liefert sonst halbe CSS-Breite"
metrics:
  completed: 2026-06-17
  commits: 16
  files_modified: 2
---

# Phase 12: TV Layout Polish — Summary

**One-liner:** Alle 9 Spieltyp-TV-Renderer auf `position:fixed` + adaptiver topPad umgestellt — kein Abschneiden mehr bei voller Spieleranzahl; Fuchsjagd skaliert bis 11 Jäger, KDA-Bracket immer gestapelt (W oben, L unten).

## Was gebaut wurde

### Fix-Pattern (alle Renderer)
- Container: `position:fixed;top:0;left:0;width:100%;height:100%` — umgeht `#game{padding}` Verschiebung
- `topPad = Math.max(pad, Math.round(vh * 0.065))` — adaptiver Puffer für TV-Overscan

### Pro Spieltyp
- **Idle:** `max-height` 40vh→55vh (mehr Spieler sichtbar im Player-Grid)
- **Viergewinnt:** Adaptive Avatar-Größe pro Teamgröße
- **Bilderkegeln:** `position:fixed` + `flex:1` rows
- **Fuchsjagd:** `position:fixed` + `flex:1` rows; adaptives 3-stufiges Scaling (≤6 / 7–9 / ≥10 Jäger); Fuchs-Avatar immer 80px
- **DreiVollen:** `position:fixed` + `align-content:stretch`
- **Grosse/Kleine Hausnummer:** `position:fixed` + `align-content:stretch`
- **Plus Minus:** `position:fixed` + `align-content:stretch` + Namen/Zeichen auf 2.2vw/2vw vergrößert
- **Anker:** `position:fixed` + `align-content:stretch` + Legende/Namen/Chips vergrößert
- **KDA:** `position:fixed` + `overflow:hidden` auf Slots; immer gestapelt (W oben / L unten); Samsung TV isCompact-Sizing

### Samsung TV Fix (DPR=2)
- `viewport width=1920` statt `device-width` — TV mit DPR=2 renderte mit halber CSS-Breite
- `isCompact = vh < 600` Flag für kleinere Slot-Größen bei 480px CSS-Höhe
- KDA behält gestapeltes Layout auch im Compact-Modus (side-by-side nach Realabend-Test revertiert)

## UAT-Ergebnisse (alle pass)

| Test | Ergebnis |
|------|----------|
| FJ TV ≤6 Jäger | pass |
| FJ TV 7–9 Jäger (56px Avatar) | pass |
| FJ TV ≥10 Jäger (40px Avatar) | pass |
| KDA W oben / L unten | pass |
| KDA GF erst bei Finalisten | pass |
| KDA Loser Bracket Label rot | pass |
| Lesbarkeit 8m / 45 Zoll | pass |
| Hausnummer TV | pass |
| Plus Minus TV | pass |
| Anker TV | pass |

## Commits

Erste Fixes: `cf4c65e` (BK), `9690578` (FJ), `7910456` (Drei), `baa5a97` (HN), `8aba6c0` (PM), `c8c34ed` (Anker), `9961ed7` (KDA)  
Samsung TV fixes: `dfc74d5` (viewport), `66158a4`–`55357f4` (KDA adaptive sizing + stacked)

---
*Phase: 12-tv-layout-polish*
*Completed: 2026-06-17*
