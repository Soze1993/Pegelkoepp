# Requirements: Pegelköpp v3.0

**Defined:** 2026-06-15
**Core Value:** Ein Tablet tippt, der Fernseher zeigt es sofort — live, ohne Reload.

## v3.0 Requirements

### PROFILE — Profilbilder

- [ ] **PROFILE-01:** Benutzer kann für jeden Spieler ein Profilbild hochladen (JPEG/PNG, max 5 MB)
- [ ] **PROFILE-02:** Profilbild wird in der Spielerliste und im Spielerprofil (Tablet) angezeigt
- [ ] **PROFILE-03:** Profilbild erscheint auf dem TV-Screen (Idle-Screen + neben aktivem Spieler im laufenden Spiel)
- [ ] **PROFILE-04:** Kein Profilbild → Emoji-Fallback (kein leeres Feld, kein broken image icon)

### GUEST — Gastkegler

- [ ] **GUEST-01:** Benutzer kann einen Gastkegler (Name + Emoji) für eine Spielsitzung erstellen
- [ ] **GUEST-02:** Gastkegler ist in der Spielerauswahl mit "(Gast)"-Kennzeichnung sichtbar und spielbar wie ein regulärer Spieler
- [ ] **GUEST-03:** Gastkegler werden aus allen Statistiken und dem Leaderboard ausgeschlossen
- [ ] **GUEST-04:** Gastkegler werden beim Beenden eines Kegelabends automatisch archiviert (nicht gelöscht — historische Spieldaten bleiben erhalten)

### STATS — Team-Gewinner

- [ ] **STATS-01:** Viergewinnt- und Fuchsjagd-Siege werden als individuelle Siege für alle Teammitglieder gezählt (statt fälschlicherweise als Unentschieden)
- [ ] **STATS-02:** Historische VG/FJ-Spiele werden rückwirkend korrekt gewertet (Stats sind recomputed — keine manuelle Datenmigration nötig)

### TVFIX — TV Layout Fixes

- [ ] **TVFIX-01:** Fuchsjagd TV skaliert korrekt für bis zu 11 Jäger — keine Spielernamen abgeschnitten, keine Überlappung durch Wurf-Werte
- [ ] **TVFIX-02:** KDA TV: Der Großes-Finale-Slot wird erst eingeblendet wenn beide Finalisten feststehen (vorher kein leerer Slot sichtbar)

## Future Requirements (post-v3.0)

- Monatliches Leaderboard (zusätzlich zum Jahres-Leaderboard)
- Spieler-Detailseite: Verlaufsgraph der Siege über Zeit
- Push-Benachrichtigung nach Kegelabend-Ende

## Out of Scope

| Feature | Reason |
|---------|--------|
| Profilbild-Größenänderung (sharp) | 12 Spieler × 5 MB = 60 MB max — VPS-Disk reicht; native Binary-Dependency unerwünscht auf stabilem VPS |
| Cloud-Storage für Bilder (S3/Cloudinary) | Single-VPS ohne CDN-Bedarf; lokale Disk ist korrekt |
| Gastkegler mit persistenten Statistiken über mehrere Abende | Gäste sind Einzel-Abend-Gäste; persistent stats würden Leaderboard verzerren |
| Team-Leaderboard (Team X vs. Team O all-time) | VG-Teams wechseln jeden Abend; kein Persistenz-Nutzen |
| Anker/BK als Team-Spiele klassifizieren | Anker und BK sind Einzel-Spiele mit individuellem Gewinner |
| Profilbild-Galerie (mehrere Fotos pro Spieler) | Ein Avatar pro Spieler reicht |
| In-Browser Foto-Zuschnitt | Spieler schneiden Fotos auf dem Handy zu |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STATS-01 | Phase 10 | Pending |
| STATS-02 | Phase 10 | Pending |
| GUEST-01 | Phase 10 | Pending |
| GUEST-02 | Phase 10 | Pending |
| GUEST-03 | Phase 10 | Pending |
| GUEST-04 | Phase 10 | Pending |
| PROFILE-01 | Phase 11 | Pending |
| PROFILE-02 | Phase 11 | Pending |
| PROFILE-03 | Phase 11 | Pending |
| PROFILE-04 | Phase 11 | Pending |
| TVFIX-01 | Phase 12 | Pending |
| TVFIX-02 | Phase 12 | Pending |

**Coverage:**
- v3.0 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-15*
*Last updated: 2026-06-15 after v3.0 milestone definition*
