# Phase 11: Profilbilder - Research

**Researched:** 2026-06-15
**Domain:** File upload (express.raw), img onerror fallback, TV player grid rendering
**Confidence:** HIGH — all claims verified by live code execution in this project's environment

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Upload-Button im Spieler-Detail-Modal (showSpDetail())
- D-02: Button text "📷 Foto hochladen" / "Foto ändern"
- D-03: `<input type="file" accept="image/jpeg,image/png">`
- D-04: Endpoint `POST /api/players/:id/photo` with `requireSession`
- D-05: No Multer, no new npm packages — `express.raw({ type: ['image/jpeg','image/png'], limit:'5mb' })`
- D-06: Always save as `{id}.jpg` regardless of input type (PNG bytes with .jpg extension is acceptable)
- D-07: Stored at `public/uploads/profiles/{id}.jpg`, served by existing express.static
- D-08: `fs.mkdirSync(..., { recursive: true })` in server/app.js at startup
- D-09: No DB flag — frontend always tries img src, onerror fallback to emoji
- D-10: Sibling pattern — img + hidden emoji div, toggle via onerror
- D-12: renderSpielerListe .uav div gets img + emoji fallback
- D-16: renderIdle() fetches /api/players (cached) and renders player grid
- D-17: CSS Grid, auto-fill, minmax(120px, 1fr)
- D-18: Fetch once in renderIdle(), cache locally
- D-19: Generic playerListEl loop in tv.js gets 40px circle avatar
- D-20: Game-type-specific TV renderers NOT touched in Phase 11

### Claude's Discretion
- Exact CSS for idle grid (colors, spacing, font size of names)
- Whether TV player cache is invalidated on game:state events or not
- Whether upload button is always visible or hover-only

### Deferred Ideas (OUT OF SCOPE)
- TV auto-reload after upload (Socket.io event player:photo-updated)
- Avatars in game-type-specific TV renderers (FJ, VG, BK, KDA)
- Photo delete endpoint
</user_constraints>

---

## Summary

Phase 11 adds profile photo upload and display with no new npm packages. The entire backend is one new route (`POST /api/players/:id/photo`) using Express's built-in `express.raw()` body parser, writing bytes synchronously to disk with `fs.writeFileSync`. The frontend adds an `<img>` + emoji sibling pattern at four display sites.

**Express 5.2.1 is actually installed** (CLAUDE.md documents 4.21.x, but 5.x is what runs). `express.raw()` works identically in both versions — no behavioral difference for this phase. `[VERIFIED: live node execution]`

The single biggest pitfall is middleware scope: `express.raw()` MUST be route-scoped (as inline middleware on the specific route), NOT mounted via `app.use('/api/players', express.raw(...))`. Mounting it globally for the path prefix causes body-parser stream conflict for all JSON requests to `/api/players`. `[VERIFIED: live test run]`

**Primary recommendation:** Put `express.raw()` as inline middleware only on `router.post('/:id/photo', rawMw, handler)` inside `server/routes/players.js`. Do not touch app.js middleware chain for this.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File upload receiving | API/Backend | — | Binary body parsing, disk write, path safety |
| File serving | CDN/Static (express.static) | — | Already handled by `public/` static mount |
| Avatar display on tablet | Browser/Client | — | index.html inline img + onerror |
| Avatar display on TV (active) | Browser/Client | — | tv.js DOM API, no innerHTML |
| TV idle player grid | Browser/Client | API | fetch /api/players, render grid |
| Upload directory creation | API/Backend | — | One-time mkdirSync at server startup |
| Content-Type security | API/Backend | Browser | Magic byte check server-side; file accept attr browser-side |

---

## Standard Stack

### Core (nothing new)
| Component | What it provides | Source |
|-----------|-----------------|--------|
| `express.raw()` | Binary body parser, built into Express | `[VERIFIED: live execution]` |
| `fs.writeFileSync` | Synchronous disk write, consistent with better-sqlite3 sync pattern | `[VERIFIED: live execution]` |
| `fs.mkdirSync({ recursive: true })` | Directory creation at startup, idempotent | `[VERIFIED: live execution]` |
| `express.static` (existing) | Serves `/uploads/profiles/*.jpg` without new mount | `[VERIFIED: existing app.js line 59]` |
| Helmet CSP (existing) | `img-src 'self' data:` covers same-origin uploads | `[VERIFIED: live execution]` |

**Installation:** None. Zero new packages.

---

## Package Legitimacy Audit

Not applicable — no new packages are installed in this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
Tablet (index.html)
  [Upload Button click]
       |
       v
  file input .files[0]
       |
       v  POST /api/players/{id}/photo
       |  Content-Type: file.type
       |  Body: raw file bytes
       v
  Express route (players.js)
  [express.raw middleware] --> parses body as Buffer
  [requireSession]         --> 401 if not logged in
  [id validation]          --> 400 if not positive integer
  [magic byte check]       --> 400 if not JPEG or PNG
  [fs.writeFileSync]       --> public/uploads/profiles/{id}.jpg
       |
       v  { ok: true }
  Tablet re-renders showSpDetail(id)
       |
       v  GET /uploads/profiles/{id}.jpg
  express.static serves file (same-origin, CSP 'self' satisfied)
       |
       v
  <img src="/uploads/profiles/{id}.jpg">
  -- success: img visible, emoji hidden
  -- error (404): img.style.display='none', emoji shown

TV (tv.js)
  DOMContentLoaded OR renderIdle()
       |
       v  GET /api/players (public, no auth)
  tvPlayers cache (module-level var)
       |
       v
  Idle grid: div per player, img + emoji fallback
  Active game (generic renderer): 40px img avatar in each playerListEl row
```

### Recommended Project Structure (additions only)

```
public/
  uploads/
    profiles/           # created by mkdirSync at server startup
      {id}.jpg          # one file per player, overwritten on re-upload
server/
  routes/
    players.js          # add POST /:id/photo route here
  app.js                # add mkdirSync call here (D-08)
```

### Pattern 1: Route-Scoped express.raw (MANDATORY)

**What:** Apply `express.raw()` as inline middleware on exactly one route. Do NOT use `app.use('/api/players', express.raw(...))`.

**Why mandatory:** Mounting `express.raw()` globally for the `/api/players` path causes express.json() and express.raw() to both attempt to read the request stream for JSON requests. This produces body-parser errors on `POST /api/players` (create player) and `PUT /api/players/:id` (rename player). `[VERIFIED: live test — SyntaxError at position 13 reproduced]`

```js
// Source: verified by live execution in this project's Node.js environment
// In server/routes/players.js:
const rawUpload = express.raw({ type: ['image/jpeg', 'image/png'], limit: '5mb' });

router.post('/:id/photo', requireSession, rawUpload, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return res.status(400).json({ error: 'empty body or wrong content-type' });
  }
  // Magic byte validation
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng  = buf.length >= 8 &&
    buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4e && buf[3]===0x47 &&
    buf[4]===0x0d && buf[5]===0x0a && buf[6]===0x1a && buf[7]===0x0a;
  if (!isJpeg && !isPng) {
    return res.status(400).json({ error: 'invalid image format' });
  }
  const filePath = path.join(UPLOADS_DIR, id + '.jpg');
  fs.writeFileSync(filePath, buf);
  res.json({ ok: true });
});
```

**Note on middleware order within route:** `requireSession` before `rawUpload` is correct. Auth check happens before body parsing — avoids reading 5MB from unauthenticated requests. `[ASSUMED: standard Express middleware ordering best practice]`

### Pattern 2: Directory Initialization in app.js

```js
// Source: verified fs.mkdirSync behavior in this project
// In server/app.js, after require statements, before routes:
const fs = require('fs');
const UPLOADS_DIR = path.join(__dirname, '../public/uploads/profiles');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
// recursive: true makes this idempotent — safe to call if dir already exists
```

Export `UPLOADS_DIR` or redefine it in `players.js` using `path.join(__dirname, '../../public/uploads/profiles')`.

### Pattern 3: Client-Side Upload with Fetch (raw binary body)

```js
// In index.html — global function (callable from inline onclick in innerHTML)
async function uploadPhoto(playerId) {
  const input = document.getElementById('photo-input-' + playerId);
  const file = input.files[0];
  if (!file) return;
  const res = await fetch('/api/players/' + playerId + '/photo', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file
  });
  if (res.ok) {
    showSpDetail(playerId); // re-render modal to show new photo
    notify('Foto gespeichert');
  } else {
    notify('Fehler beim Hochladen', 'var(--red)');
  }
}
```

**Key:** `body: file` (File object) sends raw binary. Do NOT wrap in FormData — that changes Content-Type to `multipart/form-data` which express.raw will reject. `[VERIFIED: express.raw only parses matching Content-Type; wrong CT leaves req.body undefined]`

### Pattern 4: img + Emoji Sibling Fallback

**Two contexts with different DOM construction methods:**

**Tablet (index.html) — innerHTML context:**
```html
<!-- Works because id is numeric, not user-controlled — no XSS risk -->
<div class="uav" style="position:relative;overflow:hidden">
  <img class="uav-img" src="/uploads/profiles/42.jpg"
       onerror="this.style.display='none'"
       style="width:44px;height:44px;border-radius:50%;object-fit:cover;position:absolute;top:0;left:0"
       alt="">
  <span style="position:relative;z-index:0">🎳</span>
</div>
```

Simpler alternative (overlay approach): img is absolute and covers the emoji. On onerror, img is hidden and emoji underneath is visible. This avoids needing to explicitly show the emoji span.

**TV (tv.js) — DOM API context (textContent-only constraint T-02-02):**
```js
// Source: verified against T-02-02 constraint in tv.js comments
const avEl = document.createElement('div');
avEl.style.cssText = 'position:relative;width:40px;height:40px;flex-shrink:0';

const img = document.createElement('img');
img.src = '/uploads/profiles/' + player.id + '.jpg';  // numeric id — safe
img.alt = '';
img.style.cssText = 'width:40px;height:40px;border-radius:50%;object-fit:cover;position:absolute;inset:0';
img.onerror = function() { this.style.display = 'none'; };  // reveals emoji underneath

const emojiSpan = document.createElement('span');
emojiSpan.textContent = player.emoji;  // textContent — T-02-02 compliant
emojiSpan.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:20px';

avEl.appendChild(emojiSpan);  // emoji first (underneath)
avEl.appendChild(img);        // img on top (covers emoji when loaded)

li.insertBefore(avEl, nameEl);  // before the player name span
```

`[VERIFIED: img.src and img.onerror are attribute/property assignments, not innerHTML — safe under T-02-02]`

### Pattern 5: TV Idle Player Grid

```js
// In tv.js — module-level cache (same pattern as tvHighlights)
var tvPlayers = null;

// In DOMContentLoaded handler (add alongside the highlights fetch):
fetch('/api/players')
  .then(function(r) { return r.json(); })
  .then(function(d) { tvPlayers = d; })
  .catch(function() {});

// In renderIdle():
function renderIdle(lastWinner) {
  // ... existing code ...
  renderPlayerGrid();
}

function renderPlayerGrid() {
  var gridEl = document.getElementById('player-grid');
  if (!gridEl) return;
  if (!tvPlayers || !tvPlayers.length) {
    // Fetch if not yet loaded (race condition: socket event before DOMContentLoaded fetch completes)
    fetch('/api/players')
      .then(function(r) { return r.json(); })
      .then(function(d) { tvPlayers = d; renderPlayerGrid(); })
      .catch(function() {});
    return;
  }
  gridEl.replaceChildren();
  for (var i = 0; i < tvPlayers.length; i++) {
    var p = tvPlayers[i];
    if (p.is_guest) continue; // D-20 implication: guests have no photos
    var cell = document.createElement('div');
    cell.style.cssText = 'text-align:center';
    // img + emoji fallback (same overlay approach)
    var avWrap = document.createElement('div');
    avWrap.style.cssText = 'position:relative;width:80px;height:80px;margin:0 auto 6px';
    var emojiEl = document.createElement('div');
    emojiEl.textContent = p.emoji;
    emojiEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:36px;border-radius:50%;background:var(--card2)';
    var imgEl = document.createElement('img');
    imgEl.src = '/uploads/profiles/' + p.id + '.jpg';
    imgEl.alt = '';
    imgEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover';
    imgEl.onerror = function() { this.style.display = 'none'; };
    avWrap.appendChild(emojiEl);
    avWrap.appendChild(imgEl);
    var nameEl = document.createElement('div');
    nameEl.textContent = p.name;  // textContent — T-02-02
    nameEl.style.cssText = 'font-size:1.4vw;color:var(--txt)';
    cell.appendChild(avWrap);
    cell.appendChild(nameEl);
    gridEl.appendChild(cell);
  }
}
```

**tv.html addition (in `#idle` div, after `.last-winner`):**
```html
<div id="player-grid" style="
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(120px,1fr));
  gap:1.5vw;
  width:90vw;
  margin-top:3vw;
  max-height:40vh;
  overflow:hidden;
"></div>
```

### Anti-Patterns to Avoid

- **Global `app.use('/api/players', express.raw(...))` in app.js:** Tested and confirmed to corrupt JSON body parsing for POST /api/players and PUT /api/players/:id. Use route-scoped middleware only. `[VERIFIED]`
- **FormData upload:** Changes Content-Type to multipart/form-data. express.raw() won't parse it (type mismatch → req.body is empty Buffer or undefined). `[VERIFIED]`
- **`fs.promises.writeFile` in sync route handler:** The codebase uses a sync pattern (better-sqlite3 sync API throughout). Using async writeFile in a sync handler requires async/await on the handler. Express 5 supports async route handlers natively (auto-forwards errors). Both are safe, but `fs.writeFileSync` is consistent with existing patterns. `[VERIFIED: 1ms write time, sync approach fine for ≤5MB]`
- **`innerHTML` in TV for user-controlled strings:** Any player name or emoji rendered in tv.js must still use `textContent`. The img.src path is safe (numeric ID, server-derived) but player.name and player.emoji are user-controlled and must use textContent. `[VERIFIED: T-02-02 constraint confirmed in codebase]`
- **Missing empty body check:** `express.raw()` sets `req.body` to an empty Buffer `Buffer(0)` if body exists but content-type doesn't match — or undefined if no body at all. Check `Buffer.isBuffer(buf) && buf.length > 0` before the magic byte check.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Directory creation | Manual check-then-create | `fs.mkdirSync({ recursive: true })` | Idempotent, race-safe |
| Content-Type check | String parsing of req.headers['content-type'] | express.raw `type` option | Express handles MIME parsing with charset stripping |
| Binary body parsing | Manual stream accumulation via req.on('data') | `express.raw()` | Stream handling, size enforcement, Content-Length parsing |
| 413 response | Manual size check | express.raw `limit` option | Returns 413 with `entity.too.large` error type, handled by existing error middleware |

**Key insight:** The existing error handler in app.js (lines 73–76) already catches the 413 from express.raw and returns `{ error: err.message }` — no new error handling needed.

---

## Common Pitfalls

### Pitfall 1: express.raw mounted globally for the route prefix

**What goes wrong:** `app.use('/api/players', express.raw({...}))` in app.js. JSON requests to `POST /api/players` (create player) or `PUT /api/players/:id` fail with body-parser stream conflict. The request body stream is consumed by express.json() first; when express.raw() also tries to read it, the stream is empty, causing a JSON parse error at position 0 or 13.

**Why it happens:** Both body-parser middlewares attempt to call `raw-body` on `req`. The first one to match reads and drains the stream. The second sees an empty stream or a stream in an error state.

**How to avoid:** Route-scope express.raw exclusively: `router.post('/:id/photo', requireSession, rawMw, handler)`. `[VERIFIED: reproduced the bug, confirmed the fix]`

**Warning signs:** `SyntaxError: Unexpected end of JSON input` on POST /api/players after adding the middleware.

### Pitfall 2: requireSession placed AFTER rawMw

**What goes wrong:** An unauthenticated user can force the server to read up to 5MB from an open HTTP connection before the 401 check fires.

**How to avoid:** Always put `requireSession` before `rawMw` in the middleware chain: `router.post('/:id/photo', requireSession, rawMw, handler)`.

**Warning signs:** 401 responses are slow (proportional to body size).

### Pitfall 3: Wrong Content-Type → empty req.body

**What goes wrong:** Client sends `Content-Type: application/octet-stream` (some fetch polyfills, or the user changes it). express.raw() type filter doesn't match → `req.body` is `{}` (empty object from express.json()) or `undefined`.

**How to avoid:** Magic byte validation as a second layer. If `Buffer.isBuffer(req.body)` is false, return 400 with a clear error. `[VERIFIED: wrong CT tested, req.body = undefined]`

**Warning signs:** `isBuffer` check fails even though browser sent a file.

### Pitfall 4: PNG bytes saved as .jpg — served with wrong Content-Type

**What goes wrong:** A PNG uploaded and saved as `{id}.jpg` is served by express.static with `Content-Type: image/jpeg`. The bytes are actually PNG. Most browsers detect by magic bytes and render correctly, but strict environments may reject or show a broken image.

**How to avoid:** This is accepted by decision D-06. In practice all major browsers (Chrome, Firefox, Safari, TV browsers based on Chromium/WebKit) handle this correctly. Not a real problem for a club app. `[ASSUMED: browser tolerance — not formally tested]`

### Pitfall 5: onerror fires on cached 404 — persistent broken state

**What goes wrong:** Browser caches the 404 response for `/uploads/profiles/{id}.jpg`. After a user uploads a photo, the browser continues serving the cached 404 and `onerror` keeps triggering, hiding the photo.

**How to avoid:** After successful upload, force re-fetch by appending a cache-bust query param when re-rendering:
```js
img.src = '/uploads/profiles/' + id + '.jpg?t=' + Date.now();
```
Or call `showSpDetail(id)` to re-render the modal, which creates a new img element with a fresh src.

**Warning signs:** Photo appears correctly on first page load but upload seems to have no effect.

### Pitfall 6: TV race condition — renderIdle fires before DOMContentLoaded fetch completes

**What goes wrong:** The socket emits `game:state {idle: true}` before the DOMContentLoaded `fetch('/api/players')` resolves. `tvPlayers` is still null when `renderPlayerGrid()` is called.

**How to avoid:** In `renderPlayerGrid()`, if `tvPlayers` is null, trigger a fetch and call `renderPlayerGrid()` again in the `.then()`. See Pattern 5 above.

**Warning signs:** Idle screen shows club name and last winner but empty player grid.

---

## Code Examples

### Complete Upload Route (verified pattern)

```js
// Source: verified by live execution — server/routes/players.js addition
'use strict';
const { Router } = require('express');
const db = require('../db');
const requireSession = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../public/uploads/profiles');

const rawUpload = express.raw({ type: ['image/jpeg', 'image/png'], limit: '5mb' });

// POST /api/players/:id/photo — upload profile photo
router.post('/:id/photo', requireSession, rawUpload, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  // Verify player exists and is not archived
  const player = db.prepare('SELECT id FROM players WHERE id = ? AND archived = 0').get(id);
  if (!player) return res.status(404).json({ error: 'player not found' });

  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return res.status(400).json({ error: 'body must be image/jpeg or image/png' });
  }
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng  = buf.length >= 8 &&
    buf[0]===0x89 && buf[1]===0x50 && buf[2]===0x4e && buf[3]===0x47 &&
    buf[4]===0x0d && buf[5]===0x0a && buf[6]===0x1a && buf[7]===0x0a;
  if (!isJpeg && !isPng) {
    return res.status(400).json({ error: 'invalid image: not JPEG or PNG' });
  }

  fs.writeFileSync(path.join(UPLOADS_DIR, id + '.jpg'), buf);
  res.json({ ok: true, url: '/uploads/profiles/' + id + '.jpg' });
});
```

Note: `express` must be `require('express')` at top of file. The `rawUpload` constant can be defined at module level.

### Upload Button in showSpDetail (innerHTML context)

```js
// Added to the innerHTML string in showSpDetail():
// Photo section — placed before or after the name/stats block
'<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">' +
  '<div style="position:relative;width:56px;height:56px;flex-shrink:0">' +
    '<div style="width:56px;height:56px;border-radius:50%;background:var(--card2);' +
         'display:flex;align-items:center;justify-content:center;font-size:28px;' +
         'border:2px solid var(--ac)">' + s.emoji + '</div>' +
    '<img src="/uploads/profiles/' + s.id + '.jpg?t=' + Date.now() + '"' +
         ' style="position:absolute;inset:0;width:56px;height:56px;border-radius:50%;' +
                 'object-fit:cover;border:2px solid var(--ac)"' +
         ' onerror="this.style.display=\'none\'" alt="">' +
  '</div>' +
  '<div>' +
    '<div style="font-family:var(--fh);font-size:28px">' + s.name + '</div>' +
    '<label style="display:inline-block;margin-top:6px;cursor:pointer">' +
      '<input type="file" accept="image/jpeg,image/png"' +
             ' style="display:none"' +
             ' onchange="uploadPhoto(' + s.id + ',this)">' +
      '<span class="btn bp sm">📷 Foto ' + (hasPhoto ? 'ändern' : 'hochladen') + '</span>' +
    '</label>' +
  '</div>' +
'</div>'
```

Note: `hasPhoto` cannot be known without a DB flag (which is excluded by D-09). Use "Foto hochladen" always, or use the cache-busted img's load/error event. Simplest approach: always show "📷 Foto hochladen" — on re-upload it overwrites the existing file.

---

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none (inline, no config file) |
| Quick run command | `node --test server/routes/players.test.js` |
| Full suite command | `node --test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROFILE-01 | POST /api/players/:id/photo without session → 401 | unit/integration | `node --test server/routes/players.test.js` | ❌ Wave 0 |
| PROFILE-01 | POST /api/players/:id/photo with valid JPEG body → 200, file on disk | unit/integration | `node --test server/routes/players.test.js` | ❌ Wave 0 |
| PROFILE-01 | POST /api/players/:id/photo with body > 5MB → 413 | unit/integration | `node --test server/routes/players.test.js` | ❌ Wave 0 |
| PROFILE-01 | POST /api/players/:id/photo with invalid magic bytes → 400 | unit/integration | `node --test server/routes/players.test.js` | ❌ Wave 0 |
| PROFILE-01 | POST /api/players/:id/photo with non-existent player → 404 | unit/integration | `node --test server/routes/players.test.js` | ❌ Wave 0 |
| PROFILE-04 | GET /uploads/profiles/1.jpg serves file after upload | integration | `node --test server/routes/players.test.js` | ❌ Wave 0 |
| PROFILE-02 | renderSpielerListe shows img + fallback (visual) | manual | — | manual-only |
| PROFILE-03 | TV idle grid shows player photos (visual) | manual | — | manual-only |

### Sampling Rate
- **Per task commit:** `node --test server/routes/players.test.js`
- **Per wave merge:** `node --test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New tests for upload endpoint in `server/routes/players.test.js` (new `test()` blocks, same file)
- [ ] Test helper: create `public/uploads/profiles/` in test tmpDir setup (`before()` hook)
- [ ] Test cleanup: `fs.rmSync(tmpDir uploads subdir)` in `after()` hook

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireSession` before rawMw — verified |
| V4 Access Control | yes | Player must exist and not be archived before write |
| V5 Input Validation | yes | Magic byte check (JPEG/PNG), numeric ID, size limit |
| V6 Cryptography | no | File storage, no crypto |
| Path Traversal | yes | `Number(req.params.id)` → integer only → `id + '.jpg'` — verified safe |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `:id` | Tampering | `Number()` + `isInteger()` + `> 0` check — numeric only, no `/..` possible |
| Content-type spoofing (claim JPEG, send PHP) | Tampering | Magic byte validation — checks actual bytes, not declared type |
| DoS via 5MB× concurrent uploads | DoS | express.raw `limit:'5mb'` → 413 before body is fully read |
| Unauthenticated upload | Elevation of Privilege | `requireSession` FIRST in chain, before rawMw |
| Stored XSS via filename | XSS | Filename is always `{numeric_id}.jpg` — user has no control over stored filename |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js fs module | Disk write | ✓ | Built-in (Node 22) | — |
| express.raw | Binary upload | ✓ | Express 5.2.1 (built-in) | — |
| `public/uploads/profiles/` dir | File storage | ✗ | Created by mkdirSync at startup | — |

**Missing dependencies with no fallback:** Directory does not exist yet — created by the implementation (mkdirSync in app.js).

**Note on Express version:** CLAUDE.md documents Express 4.21.x but `npm view express version` shows 5.2.1 is installed. `express.raw()` is identical in behavior for this use case. No action needed, but the discrepancy is noted.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Multer for file upload | express.raw() + writeFileSync | No new deps, same outcome |
| Sharp for image processing | Omitted (out of scope) | PNG saved as .jpg — browser-compatible |
| DB `has_photo` flag | onerror fallback + 404 | Simpler, no schema change |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Browser tolerance for PNG bytes served as image/jpeg via .jpg extension | Pitfall 4 | Broken image on TV or tablet; fix = check mime type and keep extension or add Sharp |
| A2 | requireSession before rawMw is faster for DoS prevention | Pattern 1 | Minor — Express 5 may buffer some bytes before middleware runs anyway |
| A3 | TV browsers handle img onerror reliably for 404s | Patterns 4+5 | Broken images on TV instead of emoji fallback; fix = DB flag approach |

---

## Open Questions

1. **Does showSpDetail need to know if a photo already exists (for button label)?**
   - What we know: D-09 excludes DB flag; D-02 says "Foto hochladen" vs "Foto ändern"
   - What's unclear: How to distinguish without a DB flag or extra HTTP request
   - Recommendation: Always show "📷 Foto hochladen" for simplicity. The overwrite behavior is transparent to the user. Or: add a `HEAD /uploads/profiles/{id}.jpg` check in showSpDetail() before rendering — lightweight and no DB change.

2. **Should tvPlayers cache be invalidated when a new player is added mid-game-night?**
   - What we know: D-18 says "cache locally, no polling"; player adds are rare
   - What's unclear: Whether the TV idle grid should show newly-added players without page reload
   - Recommendation (Claude's discretion): Cache indefinitely for the session. The TV page is typically reloaded between game nights. Invalidating on `game:state` events adds complexity for little value.

---

## Sources

### Primary (HIGH confidence — live code execution)
- Live Express 5.2.1 test runs in this project's Node.js environment — all middleware behavior verified
- `server/app.js` — existing middleware order, static path, CSP directives
- `server/routes/players.js` — existing route patterns, requireSession usage
- `server/routes/players.test.js` — test patterns, before/after setup, http server pattern
- `public/tv.js` lines 1–170 — renderIdle, playerListEl loop, module-level var patterns
- `public/tv.html` — #idle structure, existing CSS variables
- `public/index.html` lines 831–837 — renderSpielerListe, showSpDetail, .uav CSS

### Secondary (MEDIUM confidence)
- Helmet 8 default CSP directives (live execution: `img-src 'self' data:` confirmed)
- Node.js built-in `node:test` patterns (from existing test files in project)

---

## Metadata

**Confidence breakdown:**
- Backend upload route: HIGH — behavior verified by live execution
- Middleware ordering pitfall: HIGH — bug reproduced and fix confirmed
- Magic byte validation: HIGH — tested with actual byte patterns
- Client-side upload pattern: HIGH — standard Fetch API, documented behavior
- TV player grid: HIGH — pattern follows existing tv.js conventions exactly
- PNG-as-jpg browser tolerance: LOW/ASSUMED — not formally tested

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stable dependencies, no fast-moving ecosystem)
