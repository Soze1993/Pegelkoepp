---
quick_id: 261114-vem
slug: pudel-bezahlt-button-fix
status: complete
commit: ed30b53
---

# Summary: Pudel-bezahlt-Button repariert

- `init()` setzt jetzt `pudel_paid` / `pudel_offen` aus `/api/stats` (fehlte, nur `refreshPlayerStats()` hatte es).
- `pudelBezahlt()` berechnet offene Pudel als `max(0, pudel - pudel_paid)`, also gleiche Logik wie die Detailansicht, statt stumm an `undefined` zu scheitern.
- `refreshStats()` (existiert nicht) → `refreshPlayerStats()`.

Backend-Route `POST /api/players/:id/pudel-bezahlt` war korrekt, keine Änderung.
Verifikation: JS-Syntax-Check OK; manueller Test im Browser steht aus.
