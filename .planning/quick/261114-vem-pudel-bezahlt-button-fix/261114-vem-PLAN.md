---
quick_id: 261114-vem
slug: pudel-bezahlt-button-fix
date: 2026-11-14
---

# Quick: Pudel "Als bezahlt markieren" Button reparieren

Button in der Spieler-Detailansicht tut nichts (lokal + VPS).

## Ursache
1. `init()` in `public/index.html` übernimmt `pudel_paid` / `pudel_offen` nicht aus `/api/stats`
   → `s.pudel_offen` ist `undefined` → `pudelBezahlt()` bricht stumm ab.
2. `pudelBezahlt()` ruft nach Erfolg `refreshStats()` auf, das nicht existiert (heißt `refreshPlayerStats()`).

## Tasks
1. `init()`: `p.pudel_paid` und `p.pudel_offen` setzen wie in `refreshPlayerStats()`.
2. `pudelBezahlt()`: offen = max(0, pudel - pudel_paid) berechnen statt nur `s.pudel_offen` (gleiche Logik wie Detailansicht).
3. `pudelBezahlt()`: `refreshStats()` → `refreshPlayerStats()`.

## Verify
- Spieler mit offenen Pudeln öffnen → Button → Confirm → "Pudel bezahlt!", Offen = 0.
