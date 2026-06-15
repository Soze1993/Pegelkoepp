# Phase 10: Team-Gewinner & Gastkegler - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 5 (4 backend, 1 frontend)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/routes/stats.js` | route/service | request-response, batch-compute | self (4 endpoints within file) | self-fix |
| `server/db/index.js` | config/migration | batch | self (existing migrations array lines 26-42) | self-extension |
| `server/routes/players.js` | route | CRUD | self (existing GET/POST handlers lines 9-33) | self-extension |
| `server/routes/abende.js` | route | request-response | `server/routes/players.js` archive pattern | role-match |
| `public/index.html` | component/UI | request-response | self (existing dialog + renderSpielerListe lines 170-178, 833) | self-extension |

---

## Pattern Assignments

### `server/routes/stats.js` (route, batch-compute) — STATS-01/02

**Change:** Fix `isDraw` logic in all 4 endpoints. No structural changes.

**Current buggy pattern** (lines 58-59, 206-207, 265-266, 320-321 — same in all 4):
```javascript
const winners = results.filter(r => r.winner);
const isDraw = winners.length !== 1;
```

**Fixed pattern — drop-in replacement for all 4 occurrences:**
```javascript
const winners = results.filter(r => r.winner);
const isDraw = winners.length === 0;
```

**Year-leaderboard additional fix** (lines 206-210) — current single-winner-only logic:
```javascript
const isDraw = winners.length !== 1;
if (isDraw) continue;
const winnerId = winners[0].playerId;
winsMap[winnerId] = (winsMap[winnerId] || 0) + 1;
```

**Replacement — iterate all winners:**
```javascript
const isDraw = winners.length === 0;
if (isDraw) continue;
for (const w of winners) {
  winsMap[w.playerId] = (winsMap[w.playerId] || 0) + 1;
}
```

**H2H additional fix** (lines 320-329) — current single-winner check:
```javascript
const isDraw = winners.length !== 1;
if (isDraw) {
  draws++;
} else if (winners[0].playerId === a) {
  winsA++;
} else if (winners[0].playerId === b) {
  winsB++;
}
```

**Replacement — use `.some()` for multi-winner support:**
```javascript
const isDraw = winners.length === 0;
if (isDraw) {
  draws++;
} else {
  if (winners.some(w => w.playerId === a)) winsA++;
  if (winners.some(w => w.playerId === b)) winsB++;
}
```

**Stats endpoint `/api/stats` player query** (line 19) — also needs `is_guest = 0` guard (D-11):
```javascript
// CURRENT:
'SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id ASC'
// CHANGE TO:
'SELECT id, name, emoji FROM players WHERE archived = 0 AND is_guest = 0 ORDER BY id ASC'
```

**Year endpoint player query** (line 213) — same guard:
```javascript
// CURRENT:
'SELECT id, name, emoji FROM players WHERE archived = 0'
// CHANGE TO:
'SELECT id, name, emoji FROM players WHERE archived = 0 AND is_guest = 0'
```

---

### `server/db/index.js` (config/migration) — GUEST-01

**Analog:** Existing migrations array pattern lines 26-42 (self-extension).

**Existing migration pattern** (lines 26-42):
```javascript
const migrations = [
  'ALTER TABLE throws ADD COLUMN meta TEXT NULL',
  'ALTER TABLE game_players ADD COLUMN role TEXT NULL',
  "CREATE TABLE IF NOT EXISTS abende ...",
  'ALTER TABLE games ADD COLUMN abend_id INTEGER NULL REFERENCES abende(id)',
  // ...
  'ALTER TABLE games ADD COLUMN payer_player_id INTEGER NULL'
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
    // Column already exists — idempotent, safe to continue
  }
}
```

**New entry to append to the migrations array** (after line 32, before closing `]`):
```javascript
'ALTER TABLE players ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0'
```

The try/catch loop already handles this idempotently — no other changes needed.

---

### `server/routes/players.js` (route, CRUD) — GUEST-02/03

**Analog:** Self (lines 9-33). Two targeted changes.

**GET handler — current** (lines 9-13):
```javascript
router.get('/', (req, res) => {
  const players = db.prepare(
    'SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id ASC'
  ).all();
  res.json(players);
});
```

**GET handler — change SELECT to include `is_guest`:**
```javascript
router.get('/', (req, res) => {
  const players = db.prepare(
    'SELECT id, name, emoji, is_guest FROM players WHERE archived = 0 ORDER BY id ASC'
  ).all();
  res.json(players);
});
```

**POST handler — current** (lines 17-33):
```javascript
router.post('/', requireSession, (req, res) => {
  const { name, emoji } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name required' });
  }
  const cleanName = name.trim();
  if (!cleanName) return res.status(400).json({ error: 'name required' });
  const cleanEmoji = (typeof emoji === 'string' && emoji.trim()) ? emoji.trim() : '🎳';
  const result = db.prepare(
    'INSERT INTO players (name, emoji) VALUES (?, ?)'
  ).run(cleanName, cleanEmoji);
  res.status(201).json({
    id: result.lastInsertRowid,
    name: cleanName,
    emoji: cleanEmoji
  });
});
```

**POST handler — add `is_guest` support:**
```javascript
router.post('/', requireSession, (req, res) => {
  const { name, emoji, is_guest } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name required' });
  }
  const cleanName = name.trim();
  if (!cleanName) return res.status(400).json({ error: 'name required' });
  const cleanEmoji = (typeof emoji === 'string' && emoji.trim()) ? emoji.trim() : '🎳';
  const guestFlag = is_guest ? 1 : 0;
  const result = db.prepare(
    'INSERT INTO players (name, emoji, is_guest) VALUES (?, ?, ?)'
  ).run(cleanName, cleanEmoji, guestFlag);
  res.status(201).json({
    id: result.lastInsertRowid,
    name: cleanName,
    emoji: cleanEmoji,
    is_guest: guestFlag
  });
});
```

**Archive pattern (for reference — analog for guest bulk-archive)** (lines 52-63):
```javascript
router.put('/:id/archive', requireSession, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const info = db.prepare(
    'UPDATE players SET archived = 1 WHERE id = ? AND archived = 0'
  ).run(id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});
```

---

### `server/routes/abende.js` (route, request-response) — GUEST-04

**Analog:** `server/routes/players.js` archive pattern (lines 52-63) — same `UPDATE players SET archived = 1` pattern without ID filter.

**Current end-abend handler** (lines 150-160):
```javascript
router.post('/:id/end', requireSession, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const info = db.prepare(
    "UPDATE abende SET ended_at = datetime('now','localtime') WHERE id = ?"
  ).run(id);
  if (!info.changes) return res.status(404).json({ error: 'Abend not found' });
  res.json({ ok: true });
});
```

**Modified handler — add guest archive after abend UPDATE:**
```javascript
router.post('/:id/end', requireSession, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const info = db.prepare(
    "UPDATE abende SET ended_at = datetime('now','localtime') WHERE id = ?"
  ).run(id);
  if (!info.changes) return res.status(404).json({ error: 'Abend not found' });
  // Archive all guest players when abend ends (D-12)
  // No ID filter needed — only one open abend exists at a time
  db.prepare(
    'UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0'
  ).run();
  res.json({ ok: true });
});
```

Note: `better-sqlite3` is synchronous — both `.run()` calls execute sequentially without needing an explicit transaction. If atomic rollback is desired, wrap both in `db.transaction(...)()`.

---

### `public/index.html` (component/UI) — GUEST-01/02

Two change points in this file.

#### Change Point 1: "Neuer Spieler" dialog HTML (lines 170-178)

**Current dialog:**
```html
<div class="mo" id="m-neu-sp"><div class="md">
  <h2>Neuer Spieler</h2>
  <div class="fg"><label>Name</label><input type="text" id="m-sp-name" placeholder="Name..."></div>
  <div class="fg"><label>Emoji</label><div class="egrid" id="m-sp-emoji"></div></div>
  <div style="display:flex;gap:10px;margin-top:18px">
    <button class="btn bp" style="flex:1" onclick="addSpieler()">Hinzufügen</button>
    <button class="btn bg" onclick="closeM('m-neu-sp')">Abbrechen</button>
  </div>
</div></div>
```

**Add checkbox before the button row** (after the emoji fg div):
```html
<div class="fg" style="display:flex;align-items:center;gap:10px;margin-top:8px">
  <input type="checkbox" id="m-sp-gast" style="width:18px;height:18px;cursor:pointer">
  <label for="m-sp-gast" style="cursor:pointer;font-size:14px">Gast? (wird nach Abend archiviert)</label>
</div>
```

#### Change Point 2: `addSpieler()` function (line 832)

**Current function** — local-only, no API call:
```javascript
function addSpieler(){
  var name=document.getElementById('m-sp-name').value.trim();
  if(!name){notify('Name eingeben','var(--red)');return;}
  S.spieler.push(mkSp(Date.now(),name,selEmo));
  closeM('m-neu-sp');
  document.getElementById('m-sp-name').value='';
  notify('Spieler hinzugefuegt!');
  renderAll();
}
```

**Note:** Current `addSpieler` pushes locally without a real API call. The new implementation must POST to `/api/players`. Pattern for async fetch with session auth comes from `init()` (line 372-387) and the auth check (line 343-348). The session cookie is sent automatically via `fetch` (same-origin).

**New async `addSpieler()` — POST to API, then refresh:**
```javascript
async function addSpieler(){
  var name=document.getElementById('m-sp-name').value.trim();
  if(!name){notify('Name eingeben','var(--red)');return;}
  var isGast=document.getElementById('m-sp-gast').checked;
  var res=await fetch('/api/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,emoji:selEmo,is_guest:isGast})});
  if(!res.ok){notify('Fehler beim Speichern','var(--red)');return;}
  var p=await res.json();
  S.spieler.push(p);
  closeM('m-neu-sp');
  document.getElementById('m-sp-name').value='';
  document.getElementById('m-sp-gast').checked=false;
  notify('Spieler hinzugefuegt!');
  renderAll();
}
```

#### Change Point 3: `renderSpielerListe()` — add "(Gast)" label (line 833)

**Current name rendering inside `.map()` (extract from minified line 833):**
```javascript
'<div class="nm">'+s.name+'</div>'
```

**Change to show "(Gast)" suffix via string concatenation (textContent-safe, D-10/D-15):**
```javascript
'<div class="nm">'+(s.is_guest ? s.name+' (Gast)' : s.name)+'</div>'
```

**XSS note:** This is injected via `.innerHTML` in a template literal. Since `s.name` comes from the DB (server-validated), this is the existing project pattern. The `(Gast)` suffix is a hardcoded string literal — no additional XSS surface. If the project ever switches to DOM-based rendering, use `textContent` per CLAUDE.md convention.

#### Change Point 4: Player selection modals — also show "(Gast)" label

The player selection grids in `renderBKWahl()` (line 1262), `renderVGWahl()` (line 1385), and `renderFJWahl()` also render `s.name` directly. Apply same `(s.is_guest ? s.name+' (Gast)' : s.name)` substitution to each so guests are identifiable during game setup.

---

## Shared Patterns

### Session auth (requireSession)
**Source:** `server/middleware/auth.js` — imported as `requireSession` in all route files.
**Apply to:** All mutating endpoints (POST, PUT). Already present in `players.js` and `abende.js` — no new usage needed for this phase.

### try/catch idempotent migration
**Source:** `server/db/index.js` lines 35-42
**Apply to:** `is_guest` column migration — append to existing migrations array, existing loop handles it.
```javascript
for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }
}
```

### `archived = 0` WHERE guard
**Source:** All existing stats/player queries (e.g., `stats.js` line 19, `players.js` line 11).
**Apply to:** All 4 stats endpoints player queries — extend with `AND is_guest = 0` (D-11).

### Frontend notify pattern
**Source:** `public/index.html` line 336 — `notify(msg, color)` for success/error feedback.
**Apply to:** `addSpieler()` error path and success path.
```javascript
notify('Fehler beim Speichern', 'var(--red)'); // error
notify('Spieler hinzugefuegt!');               // success (default green)
```

---

## No Analog Found

None — all files have strong self-analogs or role-match analogs.

---

## Metadata

**Analog search scope:** `server/routes/`, `server/db/`, `public/`
**Files scanned:** 5 primary files read in full
**Pattern extraction date:** 2026-06-15
