# Phase 5: Production Deployment — Research

**Researched:** 2026-05-22
**Domain:** VPS deployment: PM2 + Nginx + Certbot + SQLite backup + crash recovery
**Confidence:** HIGH

---

## Summary

Phase 5 ships the finished Pegelköpp app to a VPS. Every technical component (PM2 5.x, Nginx 1.26.x, Certbot + Let's Encrypt, SQLite WAL backup) is a well-established production pattern with authoritative documentation. The two highest-risk items are both invisible on first deploy: (1) Express must call `app.set('trust proxy', 1)` before the session middleware or secure cookies will silently fail when Nginx terminates TLS — this is a one-line code fix that MUST happen in `server/app.js`; (2) the three Nginx WebSocket upgrade headers (`proxy_http_version 1.1`, `Upgrade`, `Connection "upgrade"`) must be present in the location block or Socket.io silently falls back to long-polling and throws no error on the server.

The crash-recovery path (`rebuildActiveGames`) is already implemented and tested. The only Phase 5 work for DEPLOY-02 is a verification step (start a game, reboot, confirm recovery) and adding a cron-based SQLite backup via `sqlite3 VACUUM INTO`. Everything else is infrastructure configuration.

**Primary recommendation:** Write `ecosystem.config.js` for a single `fork` instance. Run `pm2 startup` → copy/paste the generated `sudo env PATH=...` command → `pm2 save`. Configure Nginx with the 5-header proxy block (including `proxy_read_timeout 120s`). Run `certbot --nginx -d yourdomain.com`. Add `app.set('trust proxy', 1)` to `app.js` before session middleware.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TLS termination | Nginx (reverse proxy) | — | Certbot writes cert paths into nginx config; app never sees raw TLS |
| HTTP → HTTPS redirect | Nginx | — | Port-80 server block with `return 301` |
| WebSocket upgrade | Nginx | — | Nginx must relay Upgrade/Connection headers to upstream |
| Static file serving | Nginx | Express fallback | Nginx can serve `public/` directly for better performance; Express `static` middleware is backup |
| Process supervision / auto-restart | PM2 | systemd (via pm2 startup) | PM2 catches crashes; systemd restarts PM2 after reboots |
| Crash recovery (activeGames) | Node.js app (rebuildActiveGames) | — | Already implemented in server.js; fires at every startup |
| Env var management | dotenv + .env on VPS | — | `.env` never in git; must be created manually on VPS |
| Database backup | cron + sqlite3 CLI | — | VACUUM INTO for safe hot-copy; app DB_PATH is configurable |
| Firewall | ufw | — | Allow 22, 80, 443 only |
| Intrusion prevention | fail2ban (optional) | — | SSH brute-force protection; low overhead |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-01 | App deployed on VPS, accessible via HTTPS | Nginx + Certbot pattern confirmed; `certbot --nginx` auto-configures SSL |
| DEPLOY-02 | App survives server restarts without data loss; active games recoverable | `rebuildActiveGames` already implemented; PM2 startup systemd handles auto-start; SQLite WAL is durable; backup cron prevents data loss |
</phase_requirements>

---

## Standard Stack

### Core (pre-selected, no changes)

| Component | Version | Purpose | Source |
|-----------|---------|---------|--------|
| PM2 | 5.x | Process manager, log rotation, systemd startup hook | [CITED: pm2.keymetrics.io/docs/usage/startup] |
| Nginx | 1.26.x | Reverse proxy, TLS termination, WebSocket upgrade, static files | [CITED: nginx.org/en/docs/http/websocket.html] |
| Certbot (python3-certbot-nginx) | latest apt | Let's Encrypt certificate acquisition + auto-renewal | [CITED: digitalocean.com/community/tutorials/how-to-secure-nginx-with-lets-encrypt] |
| better-sqlite3 | 12.10.0 (already installed) | WAL-mode DB; VACUUM INTO for backups | [CITED: sqlite.org/wal.html] |
| dotenv | 17.4.2 (already installed) | .env file loading for PIN_HASH, SESSION_SECRET, PORT | [ASSUMED: already in package.json] |

### Supporting

| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| pm2-logrotate | latest (pm2 install) | Automatic log rotation with size/age limits | Install after pm2 startup; prevents disk fill |
| ufw | system package | Firewall: allow 22/80/443, deny all else | First thing after VPS access |
| fail2ban | system package | SSH brute-force protection | Recommended but not blocking for launch |
| sqlite3 CLI | system package (apt) | `VACUUM INTO` for hot backups in cron | Required for backup script |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PM2 fork mode (1 instance) | cluster mode (multiple) | Club app is single-writer SQLite — cluster is overkill and adds WAL contention |
| certbot --nginx plugin | standalone certbot | Plugin auto-edits nginx config; standalone requires manual cert paths — plugin is simpler |
| cron backup | Litestream (streaming replication) | Litestream is excellent but heavyweight for this use case; cron + VACUUM INTO is sufficient |

**Installation (VPS, one-time):**
```bash
# System packages
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx ufw sqlite3

# PM2 globally
sudo npm install -g pm2

# PM2 log rotation module
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## Package Legitimacy Audit

> This phase installs no new Node.js packages. All packages (pm2, certbot, nginx, ufw, sqlite3) are system packages installed via `apt` or globally via npm. No new entries in `package.json` are required.

| Package | Registry | Age | Source | slopcheck | Disposition |
|---------|----------|-----|--------|-----------|-------------|
| pm2 | npm (global) | ~11 yrs | github.com/Unitech/pm2 | [ASSUMED — slopcheck unavailable] | Approved: canonical Node.js process manager |
| pm2-logrotate | npm (pm2 module) | ~8 yrs | github.com/keymetrics/pm2-logrotate | [ASSUMED — slopcheck unavailable] | Approved: official keymetrics pm2 plugin |
| nginx | apt | ~25 yrs | nginx.org | N/A | System package |
| certbot | apt | ~10 yrs | certbot.eff.org | N/A | System package |

*slopcheck was unavailable at research time. Both npm packages above should be verified on npmjs.com before install.*

**Packages removed:** none
**Packages flagged:** none (all are canonical, decade-old packages in their respective ecosystems)

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (tablet/TV)
       |
       | HTTPS / WSS
       v
  [Nginx :443]  ←──── Let's Encrypt TLS cert (auto-renewed)
  - TLS termination
  - HTTP→HTTPS redirect (:80 → :443)
  - static files: /public → serve directly
  - proxy_pass: everything else → 127.0.0.1:3000
  - WebSocket upgrade headers
       |
       | HTTP/1.1 (internal, unencrypted, localhost only)
       v
  [Node.js :3000]  ←──── managed by PM2
  - Express + Socket.io
  - rebuildActiveGames fires at every startup
  - dotenv loads /app/.env (PIN_HASH, SESSION_SECRET)
       |
       v
  [SQLite WAL]   ←──── /app/data/kegelclub.db
       |
       | cron (daily)
       v
  [Backup: /backups/kegelclub-YYYY-MM-DD.db]
```

### Recommended Project Structure on VPS
```
/home/<user>/pegelkoepp/   (or /opt/pegelkoepp/)
├── Claude/                # git repo root
│   ├── server/
│   ├── public/
│   ├── data/              # SQLite files (gitignored, created by app)
│   ├── .env               # NOT in git — create manually on VPS
│   ├── ecosystem.config.js
│   └── package.json
└── backups/               # outside git, daily VACUUM INTO dumps
    └── kegelclub-2026-05-22.db
```

### Pattern 1: ecosystem.config.js

**What:** PM2 process declaration file — tells PM2 the entry script, env, restart policy, and log paths.
**When to use:** Always use this instead of `pm2 start server/server.js` on the command line; the file survives upgrades.

```javascript
// Source: pm2.keymetrics.io/docs/usage/application-declaration
// ecosystem.config.js — place in repo root (Claude/)
module.exports = {
  apps: [{
    name: 'pegelkoepp',
    script: './server/server.js',
    instances: 1,            // single instance: SQLite is single-writer
    exec_mode: 'fork',       // fork (not cluster) — no need for IPC with SQLite
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
      // Do NOT put PIN_HASH or SESSION_SECRET here — load from .env file via dotenv in app
    },
    max_memory_restart: '300M',
    max_restarts: 10,
    min_uptime: 2000,          // must be stable for 2s before restart counts as "healthy"
    exp_backoff_restart_delay: 100,
    error_file: '/home/<user>/.pm2/logs/pegelkoepp-error.log',
    out_file: '/home/<user>/.pm2/logs/pegelkoepp-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    watch: false               // NEVER watch in production — causes restart loops on log writes
  }]
};
```

**Start command:** `pm2 start ecosystem.config.js --env production`

### Pattern 2: PM2 Startup (systemd)

**What:** Registers PM2 as a systemd service so it auto-starts after reboot.
**Critical:** `pm2 save` MUST follow `pm2 startup` — without it, the process list is not persisted and PM2 starts empty after reboot.

```bash
# Source: pm2.keymetrics.io/docs/usage/startup
# Step 1 — generate the startup command (run WITHOUT sudo)
pm2 startup

# Step 2 — PM2 prints a command like the following; copy-paste and run it EXACTLY:
# sudo env PATH=$PATH:/home/<user>/.nvm/versions/node/v22.x.x/bin \
#   /home/<user>/.nvm/versions/node/v22.x.x/lib/node_modules/pm2/bin/pm2 \
#   startup systemd -u <user> --hp /home/<user>

# Step 3 — start your app
pm2 start ecosystem.config.js --env production

# Step 4 — persist the process list (REQUIRED)
pm2 save

# Verify
sudo systemctl status pm2-<user>
```

**Anti-pattern:** Running `pm2 startup` with `sudo` — the generated command must run as the app user, not root, so that PM2 knows the correct Node.js binary path (especially with nvm).

### Pattern 3: Nginx Site Configuration (complete)

**What:** Full production Nginx vhost: HTTP→HTTPS redirect + HTTPS with WebSocket upgrade + static file bypass + proxy headers for secure cookies.

```nginx
# Source: nginx.org/en/docs/http/websocket.html + socket.io/docs/v4/reverse-proxy
# /etc/nginx/sites-available/pegelkoepp

upstream pegelkoepp_upstream {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP: redirect all traffic to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS: proxy to Node.js + WebSocket support
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # Certbot fills these in automatically with --nginx plugin:
    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Static files served by Nginx directly (more efficient than proxying to Express)
    location /public/ {
        alias /home/<user>/pegelkoepp/Claude/public/;
        expires 1d;
        add_header Cache-Control "public";
    }

    # All other requests (including /socket.io/) proxy to Node.js
    location / {
        proxy_pass http://pegelkoepp_upstream;
        proxy_redirect off;

        # Required for WebSocket upgrades (Socket.io) — these 3 lines are mandatory
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Pass client IP and protocol for trust proxy / secure cookies
        proxy_set_header Host              $http_host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout: must exceed Socket.io pingInterval(25s) + pingTimeout(20s) = 45s
        # 120s is a safe margin; some guides use 86400s for long-lived connections
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
    }
}
```

**Enable and test:**
```bash
sudo ln -s /etc/nginx/sites-available/pegelkoepp /etc/nginx/sites-enabled/
sudo nginx -t          # ALWAYS test config before reload
sudo nginx -s reload
```

### Pattern 4: Certbot HTTPS (nginx plugin)

```bash
# Source: digitalocean.com/community/tutorials/how-to-secure-nginx-with-lets-encrypt
# Pre-requisites: Nginx running, port 80 open, DNS pointing to VPS IP

# Install certbot + nginx plugin (if not done yet)
sudo apt install certbot python3-certbot-nginx

# Acquire certificate — plugin auto-edits nginx config
sudo certbot --nginx -d yourdomain.com

# Test auto-renewal (dry-run — no actual certificate changed)
sudo certbot renew --dry-run

# Check the systemd timer that handles auto-renewal
sudo systemctl status certbot.timer
```

**How auto-renewal works:** certbot installs a systemd timer that runs twice daily. It renews certificates within 30 days of expiry. On successful renewal it reloads Nginx automatically. Let's Encrypt certs are valid for 90 days. No manual action needed after initial setup. [CITED: digitalocean.com/community/tutorials/how-to-secure-nginx-with-lets-encrypt]

### Pattern 5: app.js trust proxy fix (CODE CHANGE REQUIRED)

**What:** Single line that MUST be added to `server/app.js` before the session middleware. Without it, `cookie.secure` will prevent session cookies from being set when running behind Nginx TLS termination.

**Why:** The app currently sets `secure: process.env.NODE_ENV === 'production'`. In production, Nginx terminates TLS and forwards plain HTTP to port 3000. Express sees `req.protocol === 'http'` and refuses to set the `secure` cookie. `app.set('trust proxy', 1)` tells Express to read `X-Forwarded-Proto: https` from Nginx instead.

```javascript
// Source: expressjs.com/en/guide/behind-proxies.html (verified via multiple sources)
// server/app.js — ADD THIS LINE immediately after `const app = express();`
// Before: const app = express();
// After:
const app = express();
app.set('trust proxy', 1);  // Trust first proxy hop (Nginx) for req.secure + X-Forwarded-*
```

**Without this fix:** After deploying to HTTPS, the PIN login POST returns 200 but the session cookie is never sent to the browser (silent failure). The user is immediately logged out. The TV `/tv` route still works (no cookie needed) but all write routes return 401.

### Pattern 6: SQLite Backup (cron)

```bash
# Source: sqlite.org/lang_vacuum.html + slingacademy.com/article/best-practices-for-managing-sqlite-backups
# /etc/cron.daily/pegelkoepp-backup (or crontab -e)

#!/bin/bash
# Daily SQLite backup via VACUUM INTO (safe for WAL mode hot-copy)
DBPATH="/home/<user>/pegelkoepp/Claude/data/kegelclub.db"
BACKUPDIR="/home/<user>/pegelkoepp/backups"
DATE=$(date +%F)

mkdir -p "$BACKUPDIR"
# VACUUM INTO creates a fresh compacted copy in a single read-transaction
# Safe to run while the app is serving requests (WAL read-lock only)
sqlite3 "$DBPATH" "VACUUM INTO '${BACKUPDIR}/kegelclub-${DATE}.db'"

# Keep only the last 14 days
find "$BACKUPDIR" -name "kegelclub-*.db" -mtime +14 -delete
```

**Alternatives:** `sqlite3 $DB ".backup 'file.db'"` uses the online backup API (byte-faithful, includes unused pages); VACUUM INTO is slightly smaller. Either works safely in WAL mode.

### Anti-Patterns to Avoid

- **`pm2 start server/server.js` (no ecosystem.config.js):** Process list survives `pm2 save` but config is lost on PM2 upgrade; use the config file always.
- **`watch: true` in ecosystem.config.js production:** PM2 watches filesystem changes and restarts. Log writes trigger restarts. Restart loops ensue. Always `watch: false`.
- **Running `pm2 startup` with sudo:** The generated command must run as the app user so PM2 discovers the correct nvm Node binary path.
- **Skipping `pm2 save` after startup:** PM2 starts on boot but with an empty process list. App never starts. Looks like PM2 is broken.
- **Missing `proxy_http_version 1.1` in Nginx:** Socket.io falls back to HTTP long-polling silently. Throws still arrive but with 2-3x higher latency. No error appears in Nginx logs.
- **Setting `proxy_read_timeout` at 60s (Nginx default):** Socket.io's default `pingInterval + pingTimeout = 45s`. Nginx drops idle WebSocket connections at 60s, causing TV to reconnect every minute with a flash. Use `proxy_read_timeout 120s`.
- **`add_header` in a nested location block without `always`:** Headers only appear on 2xx/3xx responses; error pages lack security headers. Use `add_header ... always` for security headers.
- **Forgetting `app.set('trust proxy', 1)` in app.js:** Session login silently fails behind Nginx HTTPS. This is the single most common Express + Nginx deployment bug.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process auto-restart | Custom Node.js process watcher | PM2 | PM2 handles exponential backoff, max_restarts, log rotation, startup hooks |
| TLS certificate renewal | Manual cert download script | certbot systemd timer (already installed by certbot) | Auto-renews 30 days before expiry; reloads nginx on success |
| SQLite hot backup | Custom file copy with file-lock dance | `sqlite3 ... "VACUUM INTO ..."` | VACUUM INTO is a single read-transaction — safe while app serves requests |
| WebSocket keep-alive | Custom ping implementation | Socket.io built-in pingInterval/pingTimeout | Already configured; just set Nginx timeout > pingInterval + pingTimeout |
| Systemd service file | Write custom .service file | `pm2 startup` generated command | PM2 generates the correct systemd unit for the current Node.js binary |

**Key insight:** All five "don't hand-roll" items have a standard tool with edge-case handling that took years of production use to get right. The hand-rolled version would miss WAL checkpoint races, nvm binary path discovery, cert chain rotation, and WebSocket upgrade detection.

---

## Runtime State Inventory

> This phase has no rename/refactor concerns. The app is already implemented; this is infrastructure provisioning. Omitted per instructions for non-refactor phases.

---

## Environment Availability Audit

| Dependency | Required By | Available (dev machine) | Notes / VPS Action |
|------------|------------|------------------------|-------------------|
| Node.js 22+ | app runtime | Yes (v24.15.0 on dev) | VPS: install via NodeSource or nvm |
| npm | package install | Yes (v11.12.1) | comes with Node.js |
| PM2 | process manager | Not checked (VPS-only) | `sudo npm install -g pm2` on VPS |
| Nginx | reverse proxy | Not present on dev | `sudo apt install nginx` on VPS |
| Certbot | TLS certs | Not present on dev | `sudo apt install certbot python3-certbot-nginx` on VPS |
| sqlite3 CLI | backup script | Not checked | `sudo apt install sqlite3` on VPS |
| ufw | firewall | Not present on dev (Windows) | `sudo apt install ufw` + enable on VPS |
| fail2ban | SSH protection | Not present on dev | `sudo apt install fail2ban` (optional) |

**Missing dependencies with no fallback:** All items listed are VPS-only. Dev machine runs the app directly. None block development or test execution.

**Missing dependencies with fallback:** None needed.

---

## Common Pitfalls

### Pitfall 1: trust proxy omitted → session cookies silently fail on HTTPS
**What goes wrong:** After deploying to HTTPS, the PIN login POST returns 200 but the session cookie has `Secure` flag, and Express sees the request as HTTP (behind Nginx). The cookie is not sent to the browser. Every protected route returns 401. The TV route still works (no cookie). This is entirely silent — no error in PM2 logs.
**Why it happens:** `cookie.secure = true` in session config + Express not trusting the proxy. Express reads `req.secure` from the connection protocol, which is HTTP (from Nginx's perspective), not from the `X-Forwarded-Proto` header.
**How to avoid:** Add `app.set('trust proxy', 1)` to `server/app.js` immediately after `const app = express()`. Also add `proxy_set_header X-Forwarded-Proto $scheme;` in Nginx config.
**Warning signs:** Login POST returns 200. Subsequent request to `/api/auth/status` returns `{ authenticated: false }`. PIN overlay never dismisses.

### Pitfall 2: WebSocket upgrade headers missing → Socket.io long-poll fallback
**What goes wrong:** Socket.io connects successfully via HTTP long-polling. Throws appear on TV after ~2-3 seconds rather than sub-1-second. The app appears to work but the real-time core value is degraded. No error in server logs.
**Why it happens:** Without `proxy_http_version 1.1` + `Upgrade` + `Connection "upgrade"` headers in the Nginx location block, Nginx strips the HTTP Upgrade mechanism. Socket.io detects this and falls back to polling.
**How to avoid:** All three headers are required in the `location /` block. See Pattern 3 above.
**Warning signs:** Browser DevTools Network tab shows repeated XHR requests to `/socket.io/?EIO=4&transport=polling` rather than a single WS upgrade request. The `TRANSPORT_MISMATCH` error appears in Socket.io client debug logs.

### Pitfall 3: proxy_read_timeout too low → TV disconnects every ~60 seconds
**What goes wrong:** Nginx closes idle WebSocket connections after 60 seconds (default). The TV page reconnects but shows a brief flash or "connecting..." state every minute during a quiet game (no throws for 60s).
**Why it happens:** Nginx default `proxy_read_timeout` = 60s. Socket.io `pingInterval` (25s) + `pingTimeout` (20s) = 45s heartbeat cycle. An idle WebSocket with no data transfer triggers the Nginx timeout.
**How to avoid:** Set `proxy_read_timeout 120s` in the location block. Socket.io's built-in reconnect handles brief drops anyway, but preventing unnecessary disconnects is better UX.
**Warning signs:** TV connection dot briefly turns red then green on a regular ~60-second cycle.

### Pitfall 4: pm2 save not run → empty process list after reboot
**What goes wrong:** `pm2 startup` registers PM2 with systemd and PM2 starts on boot — but it starts empty because the process list was never saved. The app is not running after reboot.
**Why it happens:** `pm2 startup` only tells systemd to start PM2. `pm2 save` tells PM2 what to start. They are separate steps.
**How to avoid:** Always run `pm2 start ecosystem.config.js --env production` THEN `pm2 save` after any change to the running process list.
**Warning signs:** `sudo systemctl status pm2-<user>` shows Active but `pm2 list` shows no processes.

### Pitfall 5: pm2 startup run with sudo → wrong Node.js binary path
**What goes wrong:** `sudo pm2 startup` uses the root user's PATH, which may point to a different Node.js binary (system Node, not nvm Node). The generated service file hardcodes the wrong path. PM2 fails to start with "node: not found".
**Why it happens:** When Node.js is installed via nvm, the binary is at `~/.nvm/versions/node/...` — not on root's PATH.
**How to avoid:** Run `pm2 startup` WITHOUT sudo as the app user. PM2 detects the correct binary and outputs a `sudo env PATH=...` command with the full path embedded.
**Warning signs:** `sudo systemctl status pm2-<user>` shows failure. `journalctl -u pm2-<user>` shows "node: not found" or "pm2: command not found".

### Pitfall 6: VACUUM INTO backup fails if file exists
**What goes wrong:** Running the backup cron twice in the same day (or a script bug) writes the same filename, and VACUUM INTO throws "output file already exists".
**Why it happens:** Unlike `cp`, VACUUM INTO does not overwrite existing files.
**How to avoid:** Include the date in the backup filename (`kegelclub-$(date +%F).db`). Only one backup per calendar day will match. The cron runs daily so this is not a problem in practice.
**Warning signs:** Cron logs show `Error: SQLITE_CANTOPEN: unable to open database file`.

---

## Code Examples

### trust proxy one-liner (app.js)
```javascript
// Source: expressjs.com/en/guide/behind-proxies.html
// Insert immediately after `const app = express();` in server/app.js
app.set('trust proxy', 1);
```

### Full PM2 startup sequence
```bash
# Source: pm2.keymetrics.io/docs/usage/startup
# On VPS, as app user (not root):

pm2 startup
# >> Copy the printed `sudo env PATH=...` command and run it

pm2 start /home/<user>/pegelkoepp/Claude/ecosystem.config.js --env production
pm2 save

# Verify:
pm2 list                             # should show pegelkoepp as 'online'
sudo systemctl status pm2-<user>     # should show Active: active (running)
```

### Nginx WebSocket location block (minimum viable)
```nginx
# Source: nginx.org/en/docs/http/websocket.html
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;                          # required: HTTP/1.0 has no Upgrade
    proxy_set_header Upgrade $http_upgrade;          # required: relay the upgrade request
    proxy_set_header Connection "upgrade";           # required: signal keep-alive upgrade
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;      # required: so Express sees https
    proxy_read_timeout 120s;                         # required: > pingInterval + pingTimeout
}
```

### rebuildActiveGames verification test
```bash
# Source: [ASSUMED] — manual verification procedure, not an automated test

# 1. Start a game and submit a few throws
#    (via browser on tablet or curl)

# 2. Restart the app
pm2 restart pegelkoepp

# 3. Check PM2 logs for rebuild confirmation
pm2 logs pegelkoepp --lines 20
# Expected log line:
# "Pegelköpp server listening on port 3000 (1 active game(s) recovered)"

# 4. Open TV display in browser → should show the active game state (not idle)
# 5. Submit another throw → should appear on TV
```

### Firewall setup (ufw)
```bash
# Source: [CITED: digitalocean.com/community/tutorials/how-to-secure-nginx-with-lets-encrypt]
sudo ufw allow OpenSSH          # Keep SSH access first — do this before enabling ufw
sudo ufw allow 'Nginx Full'     # Opens ports 80 (HTTP) and 443 (HTTPS)
sudo ufw enable                 # Default-deny inbound
sudo ufw status                 # Verify: 22, 80, 443 allowed; everything else denied
```

### Daily backup cron (as root or app user via crontab)
```bash
# Source: [CITED: sqlite.org/lang_vacuum.html]
# /etc/cron.daily/pegelkoepp-backup
#!/bin/bash
set -e
DB="/home/<user>/pegelkoepp/Claude/data/kegelclub.db"
BACKUPS="/home/<user>/pegelkoepp/backups"
mkdir -p "$BACKUPS"
sqlite3 "$DB" "VACUUM INTO '${BACKUPS}/kegelclub-$(date +%F).db'"
find "$BACKUPS" -name "kegelclub-*.db" -mtime +14 -delete
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual crontab for cert renewal | systemd timer installed by certbot | Timer auto-renews; no manual action after first install |
| `pm2 start app.js` on command line | `ecosystem.config.js` + `pm2 start ecosystem.config.js` | Config survives PM2 upgrades; reproducible |
| `cp database.db backup.db` (raw copy) | `VACUUM INTO` (SQLite API) | Safe during writes; also defragments the DB |
| Socket.io polling fallback as default | WebSocket with HTTP polling fallback | Proper Nginx config keeps WS; polling is the fallback, not the mode |

**Deprecated/outdated:**
- `--experimental-https-reuse-session` Node.js flag: not needed; Nginx handles TLS
- `pm2-nginx` package: unnecessary; standard Nginx config handles everything
- `certbot-auto`: Replaced by distro-packaged `certbot`; certbot-auto is deprecated since 2021

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none — scripts in package.json |
| Quick run command | `node --test` (from Claude/) |
| Full suite command | `node --test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | App serves HTTPS at domain | smoke / manual | browser + `curl -I https://yourdomain.com` | N/A (VPS verification) |
| DEPLOY-01 | HTTP redirects to HTTPS | smoke / manual | `curl -I http://yourdomain.com` → 301 | N/A |
| DEPLOY-01 | Socket.io connects over WSS | manual | Browser DevTools Network → WS frame visible | N/A |
| DEPLOY-02 | `pm2 restart` recovers active game | manual | `pm2 restart pegelkoepp` + check logs for "1 active game(s) recovered" | N/A |
| DEPLOY-02 | `sudo reboot` recovers within 60s | manual | reboot VPS + timer + browser verify | N/A |
| DEPLOY-02 | No data loss after restart | manual | throw count before/after restart matches | N/A |

All DEPLOY-01/02 tests are manual smoke tests against the live VPS. No new automated tests are needed — `rebuildActiveGames` is already covered by the existing 194-test suite.

### Sampling Rate
- **Per task commit:** `node --test` (confirm existing tests stay green; no new automated tests in this phase)
- **Per wave merge:** Full manual smoke test checklist on VPS
- **Phase gate:** All 3 success criteria from ROADMAP.md verified manually before `/gsd:verify-work`

### Wave 0 Gaps
None — no new test files needed. This phase is VPS provisioning + one code change (`trust proxy`) + verification.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | express-session + bcryptjs already implemented |
| V3 Session Management | yes (cookie.secure now actually works) | `app.set('trust proxy', 1)` fix enables secure flag |
| V4 Access Control | no change | requireSession middleware already in place |
| V5 Input Validation | no change | existing routes already validated |
| V6 Cryptography | yes (TLS) | Certbot + Let's Encrypt — never hand-roll TLS |
| V14 Configuration | yes | .env not in git; NODE_ENV=production; secure cookie |

### Known Threat Patterns for Nginx + Node.js + PM2

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| HTTP traffic intercepted (no TLS) | Information Disclosure | Nginx HTTP→HTTPS redirect (`return 301`) + HSTS |
| Session cookie exposed over HTTP | Information Disclosure | `cookie.secure = true` + `trust proxy` fix |
| Directory traversal via static files | Tampering | Nginx serves only `public/` via `alias`; no `root /` |
| SSH brute-force | Elevation of Privilege | fail2ban + ufw deny default |
| Log file disk fill | Denial of Service | pm2-logrotate: max_size 10M, retain 7 days |
| WebSocket hijacking | Spoofing | Same-origin Socket.io (`cors: false` already set in server.js) |
| Clickjacking | Tampering | Helmet already sets X-Frame-Options (already in app.js) |

**Note on Helmet CSP in production:** The current Helmet CSP in `app.js` allows both `ws:` and `wss:` in `connect-src`. After deploying to HTTPS, `ws:` is no longer needed (all traffic is `wss:`). Tightening to `['self', 'wss:']` is a hardening option but not blocking for launch.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pm2-logrotate is the official keymetrics PM2 log rotation module | Package Legitimacy Audit | If wrong module name, planner installs wrong package — verify on npmjs.com |
| A2 | VPS runs Ubuntu 20.04+ or Debian 11+ with apt and systemd | Throughout | If different distro (CentOS/Alpine), pm2 startup init system and apt commands differ |
| A3 | VPS Node.js will be installed via nvm (not apt system node) | PM2 startup pattern | If system node via apt, the nvm PATH prefix in pm2 startup command is different |
| A4 | Domain DNS already points to VPS IP before Certbot runs | Certbot pattern | Certbot HTTP-01 challenge fails if DNS not propagated; certs not issued |
| A5 | SQLite CLI (sqlite3) is available on VPS via apt | Backup pattern | If not installed, VACUUM INTO backup script fails silently |

---

## Open Questions (RESOLVED)

1. **Domain name**
   - What we know: Phase 5 requires `https://` at "the club's domain" (ROADMAP.md)
   - What's unclear: Actual domain name not specified anywhere in planning artifacts
   - Recommendation: User must supply the domain when running certbot and writing Nginx `server_name`

2. **VPS OS and Node.js install method**
   - What we know: Node.js 22.x LTS required (CLAUDE.md); VPS is referenced in STATE.md
   - What's unclear: Whether Node.js is installed via nvm, NodeSource apt repo, or system package
   - Recommendation: The plan should include a Node.js version check step; if not 22+, install via NodeSource (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -`)

3. **Nginx static file serving: proxy all vs serve static directly**
   - What we know: The app currently serves `public/` via Express `static` middleware
   - What's unclear: Whether to let Nginx bypass Express for `/public/` files (performance gain) or proxy everything through Node.js (simpler config)
   - Recommendation: For an internal club app with low traffic, proxying everything through Node.js is simpler and sufficient. The Nginx pattern above shows the bypass option as optional.

---

## Sources

### Primary (HIGH confidence)
- [pm2.keymetrics.io/docs/usage/startup](https://pm2.keymetrics.io/docs/usage/startup/) — startup commands, pm2 save, unstartup
- [pm2.keymetrics.io/docs/usage/application-declaration](https://pm2.keymetrics.io/docs/usage/application-declaration/) — ecosystem.config.js format
- [nginx.org/en/docs/http/websocket.html](https://nginx.org/en/docs/http/websocket.html) — canonical WebSocket proxy configuration
- [socket.io/docs/v4/reverse-proxy](https://socket.io/docs/v4/reverse-proxy/) — Socket.io-specific Nginx guidance
- [socket.io/docs/v4/troubleshooting-connection-issues](https://socket.io/docs/v4/troubleshooting-connection-issues/) — TRANSPORT_MISMATCH, timeout diagnostics
- [digitalocean.com — Nginx + Let's Encrypt on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04) — certbot install + ufw commands
- [pm2.keymetrics.io/docs/tutorials/pm2-nginx-production-setup](https://pm2.keymetrics.io/docs/tutorials/pm2-nginx-production-setup) — combined upstream + SSL config
- [betterstack.com/community/guides/scaling-nodejs/pm2-guide](https://betterstack.com/community/guides/scaling-nodejs/pm2-guide/) — min_uptime, max_restarts, watch:false warning

### Secondary (MEDIUM confidence)
- [sqlite.org/wal.html](https://sqlite.org/wal.html) — WAL mode backup safety guarantees
- [slingacademy.com — SQLite backup best practices](https://www.slingacademy.com/article/best-practices-for-managing-sqlite-backups-in-production/) — VACUUM INTO vs .backup tradeoffs
- [medium.com/@faisal.decodes — trust proxy fix](https://medium.com/@faisal.decodes/fixing-https-sessions-behind-nginx-app-set-trust-3d01b839148d) — Express trust proxy explanation

### Tertiary (LOW confidence)
- WebSearch results for ufw/fail2ban patterns — general VPS hardening guidance; not verified against official ufw docs

---

## Metadata

**Confidence breakdown:**
- PM2 setup: HIGH — fetched from official pm2.keymetrics.io docs
- Nginx WebSocket config: HIGH — fetched from official nginx.org docs + socket.io official reverse-proxy docs
- Certbot: HIGH — fetched from digitalocean tutorial (canonical source for certbot + nginx + ubuntu)
- trust proxy bug: HIGH — confirmed from Express official docs direction + multiple credible sources
- SQLite backup: HIGH — VACUUM INTO documented at sqlite.org
- Security hardening: MEDIUM — ufw commands verified; fail2ban patterns from community sources

**Research date:** 2026-05-22
**Valid until:** 2026-08-22 (90 days; all components are stable/LTS)
