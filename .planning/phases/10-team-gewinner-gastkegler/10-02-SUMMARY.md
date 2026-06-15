---
phase: 10-team-gewinner-gastkegler
plan: "02"
subsystem: gastkegler
tags:
  - guests
  - players
  - frontend
  - migration
dependency_graph:
  requires:
    - "10-01 (Stats-Ausschluss is_guest = 0 in stats.js — already complete)"
  provides:
    - "is_guest column in players table"
    - "GET /api/players returns is_guest field"
    - "POST /api/players accepts is_guest"
    - "POST /api/abende/:id/end archives guests"
    - "Frontend: Gast checkbox + async addSpieler + (Gast) label in 4 render points"
  affects:
    - "10-03 (TV layouts — Gast-Label may be visible on TV if desired)"
tech_stack:
  added: []
  patterns:
    - "SQLite idempotent migration via try/catch on duplicate column name"
    - "better-sqlite3 sequential synchronous .run() calls (no explicit transaction needed)"
    - "async/await fetch with same-origin session cookie"
    - "is_guest ? 1 : 0 coercion for truthy/falsy body values"
key_files:
  created: []
  modified:
    - server/db/index.js
    - server/routes/players.js
    - server/routes/abende.js
    - public/index.html
decisions:
  - "is_guest stored as INTEGER 0/1 (SQL convention); coerced from body boolean via ternary"
  - "Guest archive on abend-end runs sequentially (not in transaction) — safe because better-sqlite3 is synchronous and single-writer"
  - "No ID filter on guest archive UPDATE — only one open abend exists at a time (existing guard in POST /api/abende)"
  - "addSpieler() converted from sync local-only to async API-backed — server assigns authoritative id"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-15"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 10 Plan 02: Gastkegler End-to-End Implementation Summary

**One-liner:** DB migration `is_guest` + players API extension + guest auto-archive on abend-end + async frontend with Gast checkbox and (Gast) label in 4 render functions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DB-Migration + Players-API | 2de8abe | server/db/index.js, server/routes/players.js |
| 2 | Gast-Auto-Archivierung in POST /api/abende/:id/end | 75bde06 | server/routes/abende.js |
| 3 | Frontend Gast-Checkbox, async addSpieler(), (Gast)-Label | 43f22cd | public/index.html |

## Diff Snapshots

### server/db/index.js — migrations-Array addition (Task 1)

```diff
   'ALTER TABLE games ADD COLUMN payer_player_id INTEGER NULL',
+  'ALTER TABLE players ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0'
 ];
```

The existing try/catch loop handles idempotency — no other change needed.

### server/routes/players.js — GET + POST handlers (Task 1)

**GET handler:**
```diff
-    'SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id ASC'
+    'SELECT id, name, emoji, is_guest FROM players WHERE archived = 0 ORDER BY id ASC'
```

**POST handler:**
```diff
-  const { name, emoji } = req.body || {};
+  const { name, emoji, is_guest } = req.body || {};
   ...
+  const guestFlag = is_guest ? 1 : 0;
-  const result = db.prepare(
-    'INSERT INTO players (name, emoji) VALUES (?, ?)'
-  ).run(cleanName, cleanEmoji);
+  const result = db.prepare(
+    'INSERT INTO players (name, emoji, is_guest) VALUES (?, ?, ?)'
+  ).run(cleanName, cleanEmoji, guestFlag);
   res.status(201).json({
     id: result.lastInsertRowid,
     name: cleanName,
     emoji: cleanEmoji,
+    is_guest: guestFlag
   });
```

### server/routes/abende.js — POST /:id/end handler (Task 2)

```diff
   if (!info.changes) return res.status(404).json({ error: 'Abend not found' });
+  // Archive all guest players when abend ends (D-12, GUEST-04)
+  db.prepare('UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0').run();
   res.json({ ok: true });
```

The guest archive UPDATE only executes after the abend UPDATE succeeds (info.changes > 0). The 400/404 early returns prevent it from running on invalid requests.

### public/index.html — 4 Frontend Edits (Task 3)

**Edit 1 — Gast checkbox in dialog (after emoji grid):**
```diff
   <div class="fg"><label>Emoji</label><div class="egrid" id="m-sp-emoji"></div></div>
+  <div class="fg" style="display:flex;align-items:center;gap:10px;margin-top:8px">
+    <input type="checkbox" id="m-sp-gast" style="width:18px;height:18px;cursor:pointer">
+    <label for="m-sp-gast" style="cursor:pointer;font-size:14px">Gast? (wird nach Abend archiviert)</label>
+  </div>
   <div style="display:flex;gap:10px;margin-top:18px">
```

**Edit 2 — addSpieler() converted to async API-backed:**
```diff
-function addSpieler(){
-  var name=document.getElementById('m-sp-name').value.trim();
-  if(!name){notify('Name eingeben','var(--red)');return;}
-  S.spieler.push(mkSp(Date.now(),name,selEmo));
-  closeM('m-neu-sp');
-  document.getElementById('m-sp-name').value='';
-  notify('Spieler hinzugefuegt!');
-  renderAll();
-}
+async function addSpieler(){
+  var name=document.getElementById('m-sp-name').value.trim();
+  if(!name){notify('Name eingeben','var(--red)');return;}
+  var isGast=document.getElementById('m-sp-gast').checked;
+  var res=await fetch('/api/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,emoji:selEmo,is_guest:isGast})});
+  if(!res.ok){notify('Fehler beim Speichern','var(--red)');return;}
+  var p=await res.json();
+  S.spieler.push(p);
+  closeM('m-neu-sp');
+  document.getElementById('m-sp-name').value='';
+  document.getElementById('m-sp-gast').checked=false;
+  notify('Spieler hinzugefuegt!');
+  renderAll();
+}
```

**Edit 3 — renderSpielerListe() (Gast) suffix:**
```diff
-'<div class="nm">'+s.name+'</div>'
+'<div class="nm">'+(s.is_guest?s.name+' (Gast)':s.name)+'</div>'
```

**Edit 4 — renderBKWahl(), renderVGWahl(), renderFJWahl() (x2) (Gast) suffix:**
```diff
-'+s.emoji+' '+s.name+'</div>'
+'+s.emoji+' '+(s.is_guest?s.name+' (Gast)':s.name)+'</div>'
```
Applied to: BK selection grid, VG team grids (forEach loop covers both X/O), FJ-fuchs grid, FJ-jaeger grid — 4 locations, 5 total ternaries.

## Verification Outputs

### Syntax checks
```
node -c server/db/index.js     → OK
node -c server/routes/players.js → OK
node -c server/routes/abende.js  → OK
```

### DB migration verification
```
PRAGMA table_info(players) columns: id, name, emoji, archived, created_at, is_guest
Second migration run: duplicate column name error suppressed (idempotent confirmed)
```

### API source assertions
```
GET SELECT: 'SELECT id, name, emoji, is_guest FROM players WHERE archived = 0 ORDER BY id ASC' ✓
POST INSERT: 'INSERT INTO players (name, emoji, is_guest) VALUES (?, ?, ?)' ✓
POST coercion: is_guest ? 1 : 0 ✓
Abend-end guest archive: UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0 ✓
```

### Frontend assertions
```
#m-sp-gast checkbox: present ✓
async function addSpieler: present ✓
fetch('/api/players'): present ✓
is_guest:isGast in body: present ✓
Legacy mkSp(Date.now()) push: ABSENT ✓
(Gast) ternary count: 5 (>= 5 required) ✓
```

## Deviations from Plan

None — plan executed exactly as written. All 4 edits applied per plan's exact action specifications.

## Known Stubs

None — all data is wired end-to-end. The `is_guest` field flows from DB → API → frontend state → render.

## Threat Surface Scan

No new security-relevant surface beyond what is documented in the plan's threat model:
- T-10-05: is_guest coercion via `is_guest ? 1 : 0` applied (parameterized INSERT prevents SQLi)
- T-10-06: POST /api/players remains behind `requireSession` (unchanged)
- T-10-07: `(Gast)` string is hardcoded literal, no new XSS surface
- T-10-09: WHERE is_guest = 1 AND archived = 0 ensures only guests are archived

## Self-Check: PASSED

- server/db/index.js: modified, is_guest migration present
- server/routes/players.js: modified, is_guest in GET + POST
- server/routes/abende.js: modified, guest archive UPDATE present
- public/index.html: modified, all 4 edits applied
- Commits: 2de8abe, 75bde06, 43f22cd — all in git log
