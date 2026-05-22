# Requirements: Pegelköpp v2.0

**Defined:** 2026-05-22
**Core Value:** Ein Tablet tippt, der Fernseher zeigt es sofort — live, ohne Reload.

## v2.0 Requirements

### Statistiken (STATS)

- [ ] **STATS-01:** User kann Jahres-Leaderboard aufrufen (Top-Spieler nach Siegen pro Kalenderjahr)
- [ ] **STATS-02:** User sieht aktuellen Win-Streak und längsten Win-Streak im Spielerprofil
- [ ] **STATS-03:** User kann Head-to-Head-Vergleich zwischen zwei Spielern aufrufen (Siege/Niederlagen direkt gegeneinander)
- [ ] **STATS-04:** User sieht im Spielerprofil wie oft er "Kegler des Abends" wurde (historisch, alle Abende)
- [ ] **STATS-05:** User sieht im Spielerprofil wie oft er Bilderkegeln verloren hat (historisch, alle Abende)

### Abend-Rückblick (RECAP)

- [ ] **RECAP-01:** Startseite zeigt Zusammenfassung des letzten Kegelabends (Datum, Kegler des Abends, Bilderkegeln-Verlierer)
- [ ] **RECAP-02:** User kann alle Spiele des letzten Kegelabends durchblättern (Ergebnisse und Gewinner je Spiel)

### Highlights (HIGHLIGHT)

- [ ] **HIGHLIGHT-01:** App zeigt Kegler-des-Abends-Symbol in der Spielertabelle nach Spielende
- [ ] **HIGHLIGHT-02:** TV zeigt End-Overlay wenn Kegler des Abends feststeht
- [ ] **HIGHLIGHT-03:** App zeigt Bilderkegeln-Verlierer-Symbol in der Spielertabelle nach Spielende (wer wenigste Punkte hat)
- [ ] **HIGHLIGHT-04:** TV zeigt End-Overlay wenn Bilderkegeln-Verlierer feststeht

### Turnierbaum (TOURNAMENT)

- [ ] **TOURNAMENT-01:** User kann "Kegler des Abends"-Spieltyp mit Loser Bracket (Double-Elimination, variabel 4–12 Spieler) starten
- [ ] **TOURNAMENT-02:** Bracket-Baum (Winner Bracket + Loser Bracket) wird in der App angezeigt und nach jedem Match aktualisiert
- [ ] **TOURNAMENT-03:** Bracket-Fortschritt wird live auf dem TV angezeigt (Socket.io sync)

### TV-Layouts (TV)

- [ ] **TV-01:** TV zeigt spieltypspezifisches Layout (Darstellung je nach aktivem Spieltyp angepasst)

### Teilen (SHARE)

- [ ] **SHARE-01:** User kann abgeschlossenes Spielergebnis per WhatsApp-Link teilen (generierter Link mit Ergebnis-Zusammenfassung)

### Offline & Performance (OFFLINE)

- [ ] **OFFLINE-01:** App lädt Bebas Neue und DM Sans vom eigenen Server (kein Google Fonts CDN erforderlich, funktioniert ohne Internet)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Individuelle Accounts pro Mitglied | PIN für alle reicht, spart Komplexität |
| Push-Notifications | Kein Bedarf aktuell |
| PDF-Export | WhatsApp-Share-Link deckt den Bedarf |
| Öffentliche Vereins-Homepage | Rein intern |
| Multi-Club / Multi-Tenant | Single-Club-App |
| Docker | PM2 + systemd ist das richtige Tool für Single-VPS |
| Bowling (10 Pin) | Ausschließlich 9-Kegel |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STATS-01 | — | Pending |
| STATS-02 | — | Pending |
| STATS-03 | — | Pending |
| STATS-04 | — | Pending |
| STATS-05 | — | Pending |
| RECAP-01 | — | Pending |
| RECAP-02 | — | Pending |
| HIGHLIGHT-01 | — | Pending |
| HIGHLIGHT-02 | — | Pending |
| HIGHLIGHT-03 | — | Pending |
| HIGHLIGHT-04 | — | Pending |
| TOURNAMENT-01 | — | Pending |
| TOURNAMENT-02 | — | Pending |
| TOURNAMENT-03 | — | Pending |
| TV-01 | — | Pending |
| SHARE-01 | — | Pending |
| OFFLINE-01 | — | Pending |

**Coverage:**
- v2.0 requirements: 18 total
- Mapped to phases: 0 (filled by roadmapper)
- Unmapped: 18

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 — initial v2.0 definition*
