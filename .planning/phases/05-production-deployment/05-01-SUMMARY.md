---
phase: "05"
plan: "01"
subsystem: "infrastructure"
tags: [trust-proxy, pm2, nginx, deploy, runbook]
dependency_graph:
  requires: []
  provides: [ecosystem.config.js, DEPLOY.md, trust-proxy-fix]
  affects: [server/app.js]
tech_stack:
  added: []
  patterns: [pm2-fork-mode, nginx-websocket-proxy, express-trust-proxy]
key_files:
  created:
    - ecosystem.config.js
    - DEPLOY.md
  modified:
    - server/app.js
decisions:
  - "trust proxy set to 1 (single hop) — trusts only the first proxy, which is Nginx on the same host"
  - "ecosystem.config.js uses fork mode (not cluster) — SQLite is single-writer; cluster adds WAL contention"
  - "DEPLOY.md log paths use literal USER placeholder — user must run sed substitution per Section 6"
  - "PIN_HASH and SESSION_SECRET excluded from env_production — loaded by dotenv from .env on VPS"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-22"
  tasks_completed: 3
  files_changed: 3
---

# Phase 05 Plan 01: Trust Proxy Fix, ecosystem.config.js, DEPLOY.md Runbook — Summary

**One-liner:** Express trust proxy enabled for Nginx HTTPS, PM2 ecosystem config created, and 13-section VPS deployment runbook written.

## What Was Done

Three Wave 1 (autonomous, no VPS access required) preparation tasks completed:

### Task 1 — Trust proxy fix (server/app.js)
Added `app.set('trust proxy', 1)` at line 14 of `server/app.js`, immediately after `const app = express()` and before the Helmet middleware. This is the critical one-liner that enables session cookies with the `secure` flag to work correctly when Express runs behind Nginx (which terminates TLS). Without this fix, the PIN login POST succeeds (HTTP 200) but the session cookie is never sent to the browser because Express sees the connection as HTTP, not HTTPS.

### Task 2 — ecosystem.config.js
Created `ecosystem.config.js` in the repo root with:
- `name: 'pegelkoepp'`, `script: './server/server.js'`
- `exec_mode: 'fork'`, `instances: 1` (SQLite single-writer)
- `env_production: { NODE_ENV: 'production', PORT: 3000 }` — no secrets
- `max_memory_restart: '300M'`, `max_restarts: 10`, `min_uptime: 2000`, `exp_backoff_restart_delay: 100`
- `watch: false` (prevents restart loops on log writes)
- Log paths with `USER` placeholder and explicit comment to replace via sed
- Comment making clear PIN_HASH and SESSION_SECRET are NOT in env_production — loaded by dotenv

### Task 3 — DEPLOY.md
Created 13-section deployment runbook covering the complete VPS setup flow:
1. Prerequisites (Node.js 22, DNS)
2. System packages (nginx, certbot, ufw, sqlite3)
3. Firewall — ufw with critical OpenSSH-first ordering warning
4. Clone and npm install
5. Create .env on VPS with PIN_HASH and SESSION_SECRET generation commands
6. Update ecosystem.config.js log paths (sed command)
7. PM2 install and startup — exact a/b/c/d/e/f sequence with pm2 startup without sudo warning
8. Nginx config with WebSocket upgrade headers and static file bypass
9. Certbot HTTPS with dry-run verification
10. Smoke test HTTPS (curl + browser PIN test + WS DevTools check)
11. Crash recovery test (DEPLOY-02)
12. Reboot test (DEPLOY-02, 60s timer)
13. Daily backup cron (sqlite3 VACUUM INTO with 30-day retention)

## Verification Results

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| `grep -n "trust proxy" server/app.js` | line 14 | line 14 | YES |
| `node --test` | 194 pass, 0 fail | 194 pass, 0 fail | YES |
| `node -e "...ecosystem..."` | `false fork 1 ./server/server.js` | `false fork 1 ./server/server.js` | YES |
| DEPLOY.md section check (node -e) | "structure ok" | "structure ok" | YES |
| `grep "\.env" .gitignore` | `.env` | `.env` | YES |
| `grep "data/" .gitignore` | `data/` | `data/` | YES |

## Commit

`e1ada98` — feat(05-01): trust proxy fix, ecosystem.config.js, DEPLOY.md runbook

Files staged: `server/app.js`, `ecosystem.config.js`, `DEPLOY.md`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All three files are complete and wired. DEPLOY.md contains placeholder values (`yourdomain.com`, `USER`, `YOUR_USERNAME`, `YOUR_PIN`) that are intentional — they are instructions for the human operator to fill in during VPS provisioning (Wave 2). These are not code stubs; they are documented substitution points in a runbook.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced in this plan.
- `trust proxy` improves security (enables `Secure` cookie flag in production)
- `ecosystem.config.js` is configuration only; no secrets present
- `DEPLOY.md` is documentation only

## Wave 2 Note

Wave 2 (Plan 05-02) requires human VPS access and cannot be automated. It covers:
- SSH into VPS, run ufw, clone repo, create .env
- pm2 startup + systemd hook (copy/paste step)
- Nginx site config + certbot certificate acquisition
- Browser smoke test (PIN login, WebSocket DevTools verification)
- Crash recovery test and reboot test

Wave 2 will be presented as a series of `checkpoint:human-action` tasks.

## Self-Check: PASSED

- [x] `server/app.js` exists and contains trust proxy at line 14
- [x] `ecosystem.config.js` exists and passes node require test
- [x] `DEPLOY.md` exists (7404 bytes, 13 sections)
- [x] Commit `e1ada98` exists in git log
- [x] 194 tests pass after change
