# Roadmap: Pegelköpp Kegelclub App

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-05-22) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Statistiken, Highlights & Turnierbaum** — Phases 6–9 (shipped 2026-05-27) — [Archive](milestones/v2.0-ROADMAP.md)
- 🚧 **v3.0 Spielerprofile, Gastkegler & Realabend-Fixes** — Phases 10–12 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-05-22</summary>

- [x] Phase 1: Backend Foundation (4/4 plans) — completed 2026-05-20
- [x] Phase 2: Real-Time & TV (4/4 plans) — completed 2026-05-20
- [x] Phase 3: Frontend Wiring (3/3 plans) — completed 2026-05-21
- [x] Phase 4: Club Features (2/2 plans) — completed 2026-05-22
- [x] Phase 5: Production Deployment (2/2 plans) — completed 2026-05-22

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Statistiken, Highlights & Turnierbaum (Phases 6–9) — SHIPPED 2026-05-27</summary>

- [x] Phase 6: Turnierbaum (4/4 plans) — completed 2026-05-27
- [x] Phase 7: Highlights & TV-Layouts (10/10 plans) — completed 2026-05-27
- [x] Phase 8: Statistiken & Rückblick (4/4 plans) — completed 2026-05-27
- [x] Phase 9: Polish (2/2 plans) — completed 2026-05-27

Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

## v3.0 Spielerprofile, Gastkegler & Realabend-Fixes (Phases 10–12)

### Phase 10: Team-Gewinner & Gastkegler

**Goal:** Statistiken korrekt machen und Gastkegler ermöglichen — beides reines Backend/DB, kein neues Package, höchste Priorität für den nächsten Abend.

**Requirements:** STATS-01, STATS-02, GUEST-01, GUEST-02, GUEST-03, GUEST-04

**Success Criteria:**
1. Viergewinnt-Sieg zählt als Sieg für beide Team-Mitglieder im Leaderboard (nicht mehr als Unentschieden)
2. Fuchsjagd-Sieg zählt als Sieg für alle Jäger im Leaderboard
3. Historische VG/FJ-Spiele zeigen korrekte Siege nach Server-Neustart (Stats recomputed)
4. Gastkegler kann erstellt und in ein Spiel aufgenommen werden; erscheint mit "(Gast)"-Label
5. Gastkegler erscheint nicht im Leaderboard oder in Streak-Statistiken
6. Gastkegler wird beim Beenden des Kegelabends automatisch archiviert

**Plans:** 2 plans

Plans:
- [ ] 10-01-PLAN.md — Stats-Fix: isDraw-Semantik + Guest-Ausschluss in /api/stats & /api/stats/year
- [ ] 10-02-PLAN.md — Gastkegler: DB-Migration + Players-API + Auto-Archivierung + Frontend (Checkbox/Label)

---

### Phase 11: Profilbilder

**Goal:** Spieler können ein Foto hochladen, das in der App und auf dem TV angezeigt wird.

**Requirements:** PROFILE-01, PROFILE-02, PROFILE-03, PROFILE-04

**Success Criteria:**
1. Spieler kann JPEG/PNG bis 5 MB hochladen; Foto wird unter `/uploads/profiles/` gespeichert
2. Profilbild erscheint in der Spielerliste und im Spielerprofil auf dem Tablet
3. TV Idle-Screen zeigt Profilbilder der Spieler
4. TV zeigt Profilbild neben dem aktiven Spieler während des Spiels
5. Spieler ohne Foto zeigt Emoji-Fallback (kein broken image)
6. Upload-Endpunkt ist hinter requireSession gesichert; Dateiname wird server-seitig zu `{id}.jpg` umbenannt (kein XSS/Path-Traversal)

---

### Phase 12: TV Layout Polish

**Goal:** TV-Layouts funktionieren bei voller Spieleranzahl — Fuchsjagd mit 11 Jägern, KDA-Bracket ohne leeren Finale-Slot.

**Requirements:** TVFIX-01, TVFIX-02

**Success Criteria:**
1. Fuchsjagd TV zeigt alle 11 Jäger gleichzeitig ohne Abschneiden
2. Wurf-Werte der Jäger überlagern keine Spielernamen
3. KDA TV: Großes-Finale-Slot erscheint nicht wenn noch kein Finalist feststeht
4. Beide Layouts auf echtem TV-Hardware getestet (UAT-Pflicht)

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Foundation | v1.0 | 4/4 | Complete | 2026-05-20 |
| 2. Real-Time & TV | v1.0 | 4/4 | Complete | 2026-05-20 |
| 3. Frontend Wiring | v1.0 | 3/3 | Complete | 2026-05-21 |
| 4. Club Features | v1.0 | 2/2 | Complete | 2026-05-22 |
| 5. Production Deployment | v1.0 | 2/2 | Complete | 2026-05-22 |
| 6. Turnierbaum | v2.0 | 4/4 | Complete | 2026-05-27 |
| 7. Highlights & TV-Layouts | v2.0 | 10/10 | Complete | 2026-05-27 |
| 8. Statistiken & Rückblick | v2.0 | 4/4 | Complete | 2026-05-27 |
| 9. Polish | v2.0 | 2/2 | Complete | 2026-05-27 |
| 10. Team-Gewinner & Gastkegler | v3.0 | 2/2 | Complete | 2026-06-15 |
| 11. Profilbilder | v3.0 | 0/? | Pending | — |
| 12. TV Layout Polish | v3.0 | 0/? | Pending | — |
