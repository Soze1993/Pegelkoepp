# Phase 11: Profilbilder — Discussion Log

**Date:** 2026-06-15
**Session:** Autonomous discuss-phase via /gsd-autonomous

## Areas Discussed

### 1. Upload-Trigger
**Question:** Wo kann man ein Profilbild hochladen?
**Options presented:** Im Spieler-Detail-Modal / Neuer 'Bearbeiten'-Button in Spielerliste
**Decision:** Im Spieler-Detail-Modal
**Notes:** Einfachster Weg, kein neuer Screen. Upload-Button erscheint im bestehenden Detail-Modal.

### 2. TV Idle Layout
**Question:** Was soll der TV Idle-Screen bei Profilbildern zeigen?
**Options presented:** Spieler-Grid unter Clubname / Nur im aktiven Spiel sichtbar
**Decision:** Spieler-Grid unter Clubname
**Notes:** Alle Spieler als Foto-Grid (oder Emoji wenn kein Foto) unter dem Pegelköpp-Titel. Macht den Idle-Screen lebendiger.

### 3. TV Spiel-Avatar
**Question:** Wie erscheint das Foto im laufenden Spiel auf dem TV?
**Options presented:** Kleines Foto links vom Namen / Nur Name, kein Foto im Spiel
**Decision:** Kleines Foto links vom Namen
**Notes:** ~40px Kreis-Avatar links jeder Spieler-Zeile im aktiven Spiel. Fallback: Emoji.

## Technical Decisions (Claude)
- express.raw() statt Multer — kein neues NPM-Package
- Kein has_photo DB-Flag — onerror-Pattern reicht
- photos in public/uploads/profiles/ — serviert durch bestehenden express.static
- Nur generischer TV-Renderer bekommt Avatar (spieltyp-spezifische Renderer deferred)
