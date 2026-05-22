---
phase: "05"
plan: "02"
subsystem: "infrastructure"
tags: [vps, nginx, certbot, pm2, https, websocket, backup, crash-recovery]
dependency_graph:
  requires: [05-01]
  provides: [live-production-deployment, https, crash-recovery, backup-cron]
  affects: [DEPLOY.md]
key_files:
  verified:
    - /etc/nginx/sites-available/pegelkoepp
    - /etc/systemd/system/pm2-root.service
    - /etc/cron.daily/pegelkoepp-backup
    - ~/pegelkoepp/Claude/.env
    - ~/pegelkoepp/Claude/ecosystem.config.js
decisions:
  - "Deployed to Netcup VPS (Debian 12) at kegel.pegelkoepp.de"
  - "Running as root user — pm2-root.service (not pm2-ubuntu)"
  - "Log paths use /root/.pm2/logs/ (not /home/USER/)"
  - "Domain pegelkoepp.de purchased at Netcup; subdomain kegel.pegelkoepp.de → 94.16.108.174"
  - "certbot.timer active — auto-renews twice daily"
metrics:
  completed: "2026-05-22"
  tasks_completed: 3
  domain: "kegel.pegelkoepp.de"
  vps_ip: "94.16.108.174"
---

# Plan 05-02 Summary — VPS Deployment

## What Was Done

Deployed Pegelköpp to production on a Netcup VPS running Debian 12 (Bookworm).

### Task 1 — VPS Provisioning (Sections 1–9)

- **Debian 12** confirmed; Node.js 22, git, nginx, certbot, ufw, sqlite3 installed
- **DNS:** A-record `kegel.pegelkoepp.de` → `94.16.108.174` created in Netcup DNS panel
- **Firewall (ufw):** OpenSSH + Nginx Full allowed; enabled — ports 22, 80, 443 open
- **Git clone:** Repo pushed to GitHub (Soze1993/Pegelkoepp, public), cloned to `~/pegelkoepp/Claude`
- **npm install --omit=dev:** 221 packages installed
- **.env created:** PIN_HASH, SESSION_SECRET, NODE_ENV=production, CORS_ORIGIN set; chmod 600
- **ecosystem.config.js log paths:** Updated USER → root (`/root/.pm2/logs/`)
- **PM2:** Installed globally, pm2-logrotate configured (10M/7 days), pm2 startup → systemd, app started with `--env production`, pm2 save
- **Nginx:** Config written for `kegel.pegelkoepp.de` with WebSocket upgrade headers (proxy_http_version 1.1, Upgrade, Connection "upgrade", proxy_read_timeout 120s); symlinked to sites-enabled; nginx -t passed
- **Certbot:** `sudo certbot --nginx -d kegel.pegelkoepp.de` — certificate issued; certbot.timer active (auto-renews twice daily)

### Task 2 — Smoke Tests

All 3 checks passed:
- **CHECK A:** PIN login works; `connect.sid` cookie present with Secure flag (trust proxy fix confirmed)
- **CHECK B:** Socket.io connects via WebSocket (`transport=websocket`), not XHR polling — Nginx WebSocket headers confirmed
- **CHECK C:** `/tv` route loads without PIN prompt

### Task 3 — Crash Recovery + Reboot + Backup

- **TEST A (crash recovery):** After `pm2 restart pegelkoepp`, logs show `active game(s) recovered` — rebuildActiveGames works
- **TEST B (reboot):** After `sudo reboot`, app back online within 60 seconds via pm2-root.service
- **TEST C (backup):** `/etc/cron.daily/pegelkoepp-backup` created; manual run produced valid SQLite backup; `.tables` lists: abende, game_type_defs, players (+ full schema)

## Phase 5 Success Criteria — All Met

| Criterion | Status |
|-----------|--------|
| App reachable at https://kegel.pegelkoepp.de | ✓ |
| HTTP → HTTPS redirect (301) | ✓ |
| Socket.io over wss:// (WebSocket, not polling) | ✓ |
| rebuildActiveGames recovers active game after crash | ✓ |
| App auto-starts within 60s after reboot | ✓ |
| Daily SQLite backup cron produces valid backup | ✓ |

## Production Details

| Item | Value |
|------|-------|
| URL | https://kegel.pegelkoepp.de |
| VPS IP | 94.16.108.174 |
| OS | Debian 12 (Bookworm) |
| Node.js | v22.22.2 |
| PM2 | v7.0.1 |
| Nginx | 1.22.1 |
| Process manager | pm2-root.service (systemd) |
| Backup location | /root/pegelkoepp/backups/ |
| Log location | /root/.pm2/logs/ |
