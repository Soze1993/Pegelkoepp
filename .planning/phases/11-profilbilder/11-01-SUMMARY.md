---
phase: 11-profilbilder
plan: "01"
subsystem: backend/players
tags: [upload, photo, express-raw, magic-bytes, tdd]
dependency_graph:
  requires: []
  provides: [POST /api/players/:id/photo, public/uploads/profiles/]
  affects: [server/routes/players.js, server/app.js]
tech_stack:
  added: []
  patterns: [route-scoped express.raw middleware, magic byte validation, idempotent mkdirSync]
key_files:
  created: []
  modified:
    - server/app.js
    - server/routes/players.js
    - server/routes/players.test.js
decisions:
  - "express.raw() applied inline on upload route only — not globally — to prevent JSON parsing breakage on other player routes"
  - "Always save file as {id}.jpg regardless of whether input is JPEG or PNG (D-06)"
  - "requireSession placed BEFORE rawUpload in middleware chain so 401 fires before body is read (T-11-01)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-15"
  tasks: 3
  files_changed: 3
---

# Phase 11 Plan 01: Photo Upload Backend Summary

JWT auth with refresh rotation using jose library — N/A. **Backend photo upload endpoint with route-scoped express.raw, magic byte validation, and idempotent directory creation at server start.**

## What Was Built

- `server/app.js`: Added `fs.mkdirSync(UPLOADS_DIR, { recursive: true })` at server start to create `public/uploads/profiles/` idempotently.
- `server/routes/players.js`: New `POST /:id/photo` route with:
  - `requireSession` first (auth gate fires before body is read)
  - `rawUpload = express.raw({ type: ['image/jpeg', 'image/png'], limit: '5mb' })` as inline route middleware
  - Player existence check (404 for non-existent/archived)
  - Magic byte validation: JPEG (3 bytes: `0xFF 0xD8 0xFF`) and PNG (8 bytes: full signature)
  - Writes to `public/uploads/profiles/{id}.jpg` via `fs.writeFileSync`
  - Returns `{ ok: true, url: '/uploads/profiles/{id}.jpg' }`
- `server/routes/players.test.js`: 6 new tests PHOTO-01 through PHOTO-06 appended.

## Commits

- `e95879a`: `feat(11-01): add photo upload endpoint + mkdirSync + tests (PROFILE-01)`

## Test Results

All 24 tests pass (0 failures):
- Tests 1-7: GET/TV route tests — pass
- Tests P1-P11: Player CRUD auth tests — pass
- PHOTO-01: No cookie → 401 — PASS
- PHOTO-02: Valid JPEG magic bytes + session → 200 `{ ok: true }`, file written — PASS
- PHOTO-03: Valid PNG magic bytes + session → 200 `{ ok: true }` — PASS
- PHOTO-04: Invalid magic bytes → 400 — PASS
- PHOTO-05: Non-existent player (id 999999) → 404 — PASS
- PHOTO-06: POST /api/players (JSON create) still returns 201 after upload route added — PASS

## Validation Gates

- `node --check server/routes/players.js` — exits 0
- `grep -c "mkdirSync" server/app.js` — returns 1
- `grep "rawUpload" server/routes/players.js` — confirms inline definition and route usage
- `public/uploads/profiles/` directory created at server start
- Full test suite: 24/24 pass, 0 failures

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The endpoint is fully wired: receives binary body, validates magic bytes, writes to disk, returns URL.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-11-01 through T-11-SC, all mitigated or accepted).

## Self-Check: PASSED

- `server/app.js` modified with mkdirSync — confirmed
- `server/routes/players.js` contains rawUpload inline definition and route — confirmed
- `server/routes/players.test.js` contains PHOTO-01..PHOTO-06 — confirmed
- Commit `e95879a` exists — confirmed
- 24/24 tests pass — confirmed
