# Phase 11: Profilbilder - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 liefert Profilbilder für Spieler — hochladen, speichern, und an vier Stellen anzeigen:
1. **Spielerliste (Tablet):** Foto als Avatar statt Emoji
2. **Spieler-Detail-Modal (Tablet):** Foto in 56px Kreis-Avatar + Upload-Button
3. **TV Idle-Screen:** Spieler-Grid mit Fotos/Emoji-Fallback unter dem Clubnamen
4. **TV Aktives Spiel:** Kleiner ~40px Kreis-Avatar links vom Spielernamen in jeder Zeile

**Was NICHT in Scope ist:**
- Profilbild-Resize/Cropping (kein Sharp)
- Cloud Storage (lokale Disk reicht)
- Mehrere Fotos pro Spieler
- TV auto-reload bei neuem Upload (TV-Seitenreload reicht)
- Profilbilder für Gastkegler (temporäre Spieler, kein Bedarf)

</domain>

<decisions>
## Implementation Decisions

### Upload-Trigger (PROFILE-01)
- **D-01:** Upload-Button im **Spieler-Detail-Modal** — Spieler antippen → Detail-Modal → Upload-Button dort. Kein separater Bearbeitungs-Screen.
- **D-02:** Upload-Button Text: "📷 Foto hochladen" (oder "Foto ändern" wenn Foto schon vorhanden)
- **D-03:** Input: `<input type="file" accept="image/jpeg,image/png">` — Browser-nativer File-Picker

### Backend — Upload-Endpoint (PROFILE-01, PROFILE-04)
- **D-04:** Endpoint: `POST /api/players/:id/photo` mit `requireSession`
- **D-05:** Kein Multer, kein neues NPM-Package — stattdessen `express.raw({ type: ['image/jpeg', 'image/png'], limit: '5mb' })` Middleware. Client sendet File direkt als Binary Body mit `Content-Type: image/jpeg` oder `image/png`.
- **D-06:** Server-seitige Dateinamen-Normalisierung: immer `{id}.jpg` speichern — unabhängig vom Original-Content-Type (PNG wird auch als `.jpg` gespeichert, Browser zeigt es korrekt an solange Inhalt valid ist)
- **D-07:** Speicherort: `public/uploads/profiles/{id}.jpg` — von bestehendem `express.static` aus `public/` automatisch serviert als `/uploads/profiles/{id}.jpg`
- **D-08:** Verzeichnis `public/uploads/profiles/` beim Server-Start anlegen (falls nicht vorhanden): `fs.mkdirSync(..., { recursive: true })` in `server/app.js`
- **D-09:** Kein DB-Flag nötig (`has_photo`-Spalte unnötig) — Frontend versucht immer `<img src="/uploads/profiles/{id}.jpg">` mit `onerror`-Fallback auf Emoji. 404 für fehlende Fotos ist akzeptabel (12 Spieler max).

### Emoji-Fallback (PROFILE-04)
- **D-10:** Überall wo Spieler angezeigt werden: `<img src="/uploads/profiles/{id}.jpg" onerror="this.style.display='none'; this.nextSibling.style.display='flex'" alt="">` + verstecktes Emoji-Div daneben. Beide im DOM, jeweils mit `display` gesteuert.
- **D-11:** Alternative (einfacher): Emoji immer sichtbar, Foto als absolut positioniertes Overlay — wird durch onerror entfernt wenn kein Foto vorhanden. Je nach Einfachheit in der Implementierung entscheiden.

### Tablet — Spielerliste (PROFILE-02)
- **D-12:** In `renderSpielerListe()`: `.uav` div bekommt `<img>` + Emoji-Fallback statt nur Emoji-Text. `<img class="uav-img" src="/uploads/profiles/{id}.jpg" onerror="...">` + `<span class="uav-emoji">{emoji}</span>` (zunächst versteckt, sichtbar on error).
- **D-13:** `textContent`-only XSS-Guard bleibt — Bildpfad ist immer `/uploads/profiles/{numeric_id}.jpg` (keine User-Strings im Pfad, numeric ID aus DB).

### Tablet — Spieler-Detail-Modal (PROFILE-02)
- **D-14:** Bestehender 56px Kreis-Avatar in `showSpDetail()` bekommt `<img>` statt Emoji-div. Upload-Button darunter oder daneben.
- **D-15:** Upload-Flow: Button-Click → hidden `<input type="file">` öffnen → `change`-Event → `fetch('/api/players/{id}/photo', { method:'POST', headers:{'Content-Type': file.type}, body: file })` → bei Erfolg Modal neu rendern (zeigt neues Foto).

### TV Idle-Screen (PROFILE-03)
- **D-16:** `renderIdle()` in `tv.js` fetcht `/api/players` (falls noch nicht gecached) und rendert einen Spieler-Grid unter dem Clubnamen in `#idle`.
- **D-17:** Grid-Layout: CSS Grid mit ~4-6 Spalten (je nach Spielerzahl, auto-fill), jede Zelle: Foto-Avatar + Spielername darunter. Responsive via `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))`.
- **D-18:** TV Idle fetcht Spieler einmalig beim `renderIdle()`-Call und cached sie lokal — kein permanentes Polling.

### TV Aktives Spiel (PROFILE-03)
- **D-19:** In `tv.js` — generischer Renderer (playerListEl-Loop): jede Spieler-Zeile bekommt 40px Kreis-Avatar links vom Namen-Element.
- **D-20:** Für spieltyp-spezifische TV-Renderer (FJ, VG, BK etc.): Avatar nur wenn verfügbar — kein Breaking Change an bestehenden Renderern außer dem generischen. Spieltyp-spezifische Renderer können als Follow-up erweitert werden.

### Claude's Discretion
- Exaktes CSS für den Idle-Grid (Farben, Spacing, Font-Size der Namen)
- Ob TV-Spieler-Cache bei `game:state`-Events invalidiert wird oder nicht
- Ob Upload-Button im Detail-Modal immer sichtbar ist oder nur bei Mouse-Hover

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Anforderungen
- `.planning/REQUIREMENTS.md` — PROFILE-01, PROFILE-02, PROFILE-03, PROFILE-04 (vollständige Anforderungstexte)
- `.planning/ROADMAP.md` — Phase 11 Goal + 6 Success Criteria

### Backend — Upload-Endpoint
- `server/routes/players.js` — hier neuen POST /:id/photo Endpoint hinzufügen; bestehende requireSession und db-Pattern übernehmen
- `server/app.js` — hier `express.raw()` Middleware registrieren UND `fs.mkdirSync` für uploads/profiles beim Start
- `server/middleware/auth.js` — requireSession (bereits vorhanden, nur importieren)

### Frontend Tablet
- `public/index.html` — `renderSpielerListe()` (Zeile ~834) und `showSpDetail()` (Zeile ~835): bestehende Avatar-Divs (.uav) ersetzen/erweitern mit Img+Fallback; Upload-Button in Detail-Modal

### TV
- `public/tv.html` — `#idle` Struktur (aktuell: .club-name + .last-winner), Grid-Div hinzufügen
- `public/tv.js` — `renderIdle()` (Zeile ~92): fetch /api/players + Grid rendern; generischer playerListEl-Loop (~Zeile 129): Avatar-Element einfügen

### Konventionen (PFLICHT)
- `CLAUDE.md` — textContent-only XSS-Guard: Bildpfad `/uploads/profiles/{numeric_id}.jpg` ist sicher (keine User-Strings), aber Namen weiterhin nur via textContent
- Kein neues NPM-Package: express.raw() ist in Express 4.x built-in (kein multer nötig)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`requireSession` Middleware** (`server/middleware/auth.js`): direkt für Upload-Endpoint importieren
- **`express.static(path.join(__dirname, '../public'))`** in `server/app.js`: `/uploads/profiles/` wird automatisch als `/uploads/profiles/` URL serviert — kein neuer static-Mount nötig
- **`.uav` CSS-Klasse** in `public/index.html`: bestehender Avatar-Container (Emoji-div), wird zu Foto+Fallback erweitert
- **Socket-Event `game:state`** in `tv.js`: liefert bereits `idle`-Flag — `renderIdle()` ist der richtige Hook für Spieler-Grid-Fetch

### Etablierte Patterns
- **`onerror` auf `<img>`**: Standard-Browser-Pattern für Bild-Fallback — kein State-Management nötig
- **Numeric ID im Pfad**: `/uploads/profiles/${s.id}.jpg` — Player-ID ist immer integer aus DB, kein XSS-Risiko
- **`fs.mkdirSync(path, { recursive: true })`**: bereits in anderen Node.js-Projekten, für uploads/profiles beim Start

### Integration Points
- `server/app.js` Zeile ~59: nach `express.static` — `express.raw()` Middleware für `/api/players/:id/photo` Route registrieren
- `public/index.html renderSpielerListe` Zeile ~834: `.uav` div um `<img>`+Emoji-Fallback erweitern
- `public/index.html showSpDetail` Zeile ~835: 56px Avatar-div um `<img>`+Fallback+Upload-Button erweitern
- `public/tv.html #idle` Zeile ~143: neuen `<div id="player-grid">` unter `.last-winner` hinzufügen
- `public/tv.js renderIdle()` Zeile ~92: fetch + Grid-Rendering nach dem bestehenden `lastWinnerEl.textContent`-Set

</code_context>

<specifics>
## Specific Ideas

- **express.raw() Setup:**
  ```js
  app.use('/api/players', express.raw({ type: ['image/jpeg', 'image/png'], limit: '5mb' }));
  // WICHTIG: express.json() muss nach express.raw() für /api/players registriert werden
  // ODER: express.raw() nur für /:id/photo route registrieren, nicht global
  ```
- **Upload-Fetch im Frontend:**
  ```js
  const file = input.files[0];
  await fetch('/api/players/' + id + '/photo', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file
  });
  ```
- **Img+Fallback Pattern:**
  ```html
  <img src="/uploads/profiles/42.jpg" class="uav-img" 
       onerror="this.style.display='none'" alt="">
  <span class="uav-emoji">🎳</span>
  ```
  (Wenn img lädt, ist emoji im Hintergrund — img überdeckt es via position:absolute oder emoji bekommt display:none via img:not([style*="none"])~span)
- **TV Grid (renderIdle):**
  ```js
  const players = await fetch('/api/players').then(r => r.json());
  gridEl.replaceChildren();
  for (const p of players) {
    const cell = document.createElement('div');
    // img + name via textContent
    gridEl.appendChild(cell);
  }
  ```
- **Server-Start Verzeichnis:**
  ```js
  const fs = require('fs');
  const uploadDir = path.join(__dirname, '../public/uploads/profiles');
  fs.mkdirSync(uploadDir, { recursive: true });
  ```

</specifics>

<deferred>
## Deferred Ideas

- **TV auto-reload nach Upload** — Socket.io-Event `player:photo-updated` → TV rerendert Grid. Einfacher: TV-Seite manuell neu laden.
- **Avatare in spieltyp-spezifischen TV-Renderern** (FJ, VG, BK, KDA) — Phase 12 oder spätere Quick-Task. Nur generischer Renderer bekommt Avatar in Phase 11.
- **Foto löschen** — kein Use-Case definiert, kann als Quick-Task nachgeliefert werden.

</deferred>

---

*Phase: 11-Profilbilder*
*Context gathered: 2026-06-15*
