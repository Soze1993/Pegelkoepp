---
phase: 11-profilbilder
plan: "02"
subsystem: frontend
tags: [avatar, photo-upload, spielerliste, modal, frontend]
dependency_graph:
  requires: [11-01]
  provides: [player-photo-display, photo-upload-ui]
  affects: [public/index.html]
tech_stack:
  added: []
  patterns: [img-emoji-overlay, raw-binary-fetch, cache-bust-on-upload]
key_files:
  modified:
    - public/index.html
decisions:
  - "img+emoji overlay: emoji is base content, img absolutely covers it; onerror hides img to reveal emoji — no JS show/hide logic needed"
  - "body: file (raw binary) not FormData — express.raw() on server requires Content-Type: image/jpeg|png"
  - "showSpDetail(playerId) called after upload to re-render with fresh Date.now() cache-buster"
  - "uploadPhoto at global scope (before renderSpielerListe) — required for inline onchange= attribute"
metrics:
  duration: "8 minutes"
  completed: "2026-06-15"
  tasks_completed: 3
  files_modified: 1
---

# Phase 11 Plan 02: Tablet UI — Player Avatars + Photo Upload Summary

**One-liner:** img+emoji overlay in Spielerliste and detail modal with raw-binary uploadPhoto() global function wired to POST /api/players/:id/photo.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | renderSpielerListe: uav div gets img overlay with onerror emoji fallback | efd9df3 |
| 2 | showSpDetail: 56px round avatar + 📷 Foto hochladen button with file input | efd9df3 |
| 3 | uploadPhoto() global function — raw binary fetch, notify, modal re-render | efd9df3 |

## What Was Built

**renderSpielerListe** — the `.uav` div now contains an absolutely-positioned `<img class="uav-img">` that covers the emoji. When the photo 404s, `onerror="this.style.display='none'"` reveals the emoji underneath. No JS logic required — CSS handles the stacking.

**showSpDetail** — the 56px emoji circle is now wrapped in a relative-positioned container with an overlaid `<img>` (same onerror pattern). Below the name/count info, a hidden `<input type="file" accept="image/jpeg,image/png">` is wrapped in a `<label>` styled as a button ("📷 Foto hochladen"). `onchange="uploadPhoto(s.id, this)"` calls the global function.

**uploadPhoto(playerId, inputEl)** — async global function placed before renderSpielerListe in the // Spieler block. Sends `fetch` with `method:'POST'`, `headers:{'Content-Type':file.type}`, `body:file` (raw binary). Handles: success (notify + re-render), 413 (size error), other errors (server message or fallback), network error (catch). After success calls `showSpDetail(playerId)` which re-builds the modal innerHTML with a fresh `?t=Date.now()` cache-buster on the img src.

## Verification

```
node -e "const fs=require('fs');const src=fs.readFileSync('public/index.html','utf8');['uav-img','uploadPhoto','photo-input-','accept=\"image/jpeg,image/png\"','onerror'].forEach(t=>{if(!src.includes(t))throw new Error('Missing: '+t)});console.log('all ok')"
```
Result: `all ok`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three display sites (Spielerliste avatar, modal avatar, upload button) are fully wired to live endpoints from plan 11-01.

## Threat Flags

None — no new network endpoints or auth paths introduced. All threats per plan threat model accepted (T-11-07, T-11-08, T-11-09, T-11-SC).

## Self-Check: PASSED

- public/index.html exists and contains all required strings: uav-img, uploadPhoto, photo-input-, accept="image/jpeg,image/png", onerror
- Commit efd9df3 exists in git log
