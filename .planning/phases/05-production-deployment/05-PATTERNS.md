# Phase 5: Production Deployment — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 6 (1 code change + 5 new infrastructure files)
**Analogs found:** 2 / 6 (code change has exact analog; infrastructure files have no codebase analogs — use RESEARCH.md patterns)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/app.js` (modify) | middleware config | request-response | `server/app.js` itself (lines 13-14) | exact — insert at known location |
| `ecosystem.config.js` (new) | config | batch (startup) | none in codebase | no analog — use RESEARCH.md Pattern 1 |
| `/etc/nginx/sites-available/pegelkoepp` (new) | config | request-response + streaming | none in codebase | no analog — use RESEARCH.md Pattern 3 |
| `/etc/cron.daily/pegelkoepp-backup` (new) | utility script | batch (file I/O) | none in codebase | no analog — use RESEARCH.md Pattern 6 |
| `.env` on VPS (new, manual) | config | — | `.env.example` (lines 1-15) | template match |
| VPS firewall + PM2 startup (ops, no file) | ops procedure | — | none | no analog — use RESEARCH.md Patterns 2 + 4 |

---

## Pattern Assignments

### `server/app.js` — trust proxy fix (modify, 1 line)

**Analog:** `server/app.js` (the file being modified)

**Insertion target — `const app = express()` declaration** (lines 13-14):
```javascript
// server/app.js lines 13-14 — CURRENT STATE
const app = express();

// --- Middleware (order matters) ---
```

**Required change — insert immediately after line 13:**
```javascript
const app = express();
app.set('trust proxy', 1);  // Trust first proxy hop (Nginx) for req.secure + X-Forwarded-*

// --- Middleware (order matters) ---
```

**Why this exact position matters:** The session middleware at lines 39-50 reads `cookie.secure: process.env.NODE_ENV === 'production'`. Express evaluates `req.secure` from the raw connection protocol (HTTP from Nginx's perspective), not from the `X-Forwarded-Proto` header, unless `trust proxy` is set. Setting it after `const app = express()` and before the first `app.use(...)` call at line 20 is the correct placement per Express docs.

**Session middleware being fixed** (lines 39-50):
```javascript
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: sessionDir }),
  secret: process.env.SESSION_SECRET || 'dev-only-secret-replace-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',  // <-- this flag is what trust proxy enables
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
```

**Failure mode without this fix (from RESEARCH.md Pitfall 1):** POST `/api/auth/login` returns 200 but no `Set-Cookie` header is sent. `GET /api/auth/status` immediately returns `{ authenticated: false }`. PIN overlay never dismisses. No error in PM2 logs.

**Verification after deploy:** `curl -v -X POST https://yourdomain.com/api/auth/login -H 'Content-Type: application/json' -d '{"pin":"YOUR_PIN"}' 2>&1 | grep -i 'set-cookie'` — should show a `connect.sid` cookie with `Secure` flag.

---

### `ecosystem.config.js` (new, repo root `Claude/`)

**Analog:** none in codebase

**Pattern source:** RESEARCH.md Pattern 1 (pm2.keymetrics.io/docs/usage/application-declaration)

**Entry point anchor from `package.json` line 5:**
```json
"main": "server/server.js"
```
The `script` field in ecosystem.config.js must match this: `'./server/server.js'`.

**Complete file content (from RESEARCH.md Pattern 1):**
```javascript
// ecosystem.config.js — repo root (Claude/)
module.exports = {
  apps: [{
    name: 'pegelkoepp',
    script: './server/server.js',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '300M',
    max_restarts: 10,
    min_uptime: 2000,
    exp_backoff_restart_delay: 100,
    error_file: '/home/<user>/.pm2/logs/pegelkoepp-error.log',
    out_file: '/home/<user>/.pm2/logs/pegelkoepp-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    watch: false
  }]
};
```

**Key decisions:**
- `instances: 1` + `exec_mode: 'fork'` — SQLite is single-writer; cluster mode adds WAL contention with no benefit
- `watch: false` — log writes would trigger restart loops in production
- `NODE_ENV` and `PORT` only — `PIN_HASH` and `SESSION_SECRET` are loaded by `dotenv` from `.env` (see `server/server.js` line 3: `require('dotenv').config()`)

---

### `/etc/nginx/sites-available/pegelkoepp` (new, VPS)

**Analog:** none in codebase

**Pattern source:** RESEARCH.md Pattern 3 (nginx.org/en/docs/http/websocket.html + socket.io/docs/v4/reverse-proxy)

**Socket.io constraint anchor — `server/server.js` lines 26-27:**
```javascript
const io = new Server(server, { cors: { origin: false } });
app.locals.io = io;
```
Socket.io has `cors: false` (same-origin). The Nginx config must not introduce cross-origin issues — the `proxy_set_header Host $http_host;` line preserves the original host header so same-origin checks pass.

**Helmet CSP constraint anchor — `server/app.js` lines 23-25:**
```javascript
'connect-src': ["'self'", 'ws:', 'wss:'],
```
Both `ws:` and `wss:` are allowed, so the Nginx WSS proxy does not break the CSP.

**WebSocket upgrade block (the 3 mandatory headers):**
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

**Trust proxy headers (required to match `app.set('trust proxy', 1)`):**
```nginx
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
```

**Timeout constraint:** Socket.io default `pingInterval(25s) + pingTimeout(20s) = 45s`. Nginx default `proxy_read_timeout` = 60s would cause reconnects. Use `proxy_read_timeout 120s`.

---

### `/etc/cron.daily/pegelkoepp-backup` (new, VPS)

**Analog:** none in codebase

**Pattern source:** RESEARCH.md Pattern 6 (sqlite.org/lang_vacuum.html)

**DB path anchor — `server/server.js` lines 8-9:**
```javascript
fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
```
The `data/` directory is relative to `server/`, so the absolute DB path on VPS will be:
`/home/<user>/pegelkoepp/Claude/data/kegelclub.db`

**`dotenv` DB path override — `server/db/index.js` (implied):** The app uses `process.env.DB_PATH` or defaults to `./data/kegelclub.db`. The backup script must use the same resolved path.

**Script pattern:**
```bash
#!/bin/bash
set -e
DB="/home/<user>/pegelkoepp/Claude/data/kegelclub.db"
BACKUPS="/home/<user>/pegelkoepp/backups"
mkdir -p "$BACKUPS"
sqlite3 "$DB" "VACUUM INTO '${BACKUPS}/kegelclub-$(date +%F).db'"
find "$BACKUPS" -name "kegelclub-*.db" -mtime +14 -delete
```

**VACUUM INTO vs file copy:** WAL mode means a raw `cp` can capture an inconsistent checkpoint state. `VACUUM INTO` uses a single read-transaction — safe while the app is serving requests.

**Pitfall:** VACUUM INTO fails if the output file already exists. The `$(date +%F)` date suffix (e.g., `kegelclub-2026-05-22.db`) ensures uniqueness across calendar days when run once daily.

---

### `.env` on VPS (new, manual — never in git)

**Template analog:** `.env.example` (lines 1-15) — full file:
```bash
# PIN hash — generate via: node -e "require('bcryptjs').hash('your-pin-here',10).then(console.log)"
PIN_HASH=$2a$10$REPLACE_ME_WITH_BCRYPT_HASH_OF_YOUR_PIN

# Session signing secret — generate via: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=REPLACE_ME_WITH_32_BYTE_HEX_STRING

# HTTP port (default 3000)
PORT=3000

# Set to 'production' on the VPS; 'development' locally
NODE_ENV=development

# CORS origin — leave empty for same-origin (recommended)
CORS_ORIGIN=
```

**VPS overrides needed:**
- `NODE_ENV=production` (activates `cookie.secure: true` in `app.js` line 47)
- `PIN_HASH` — run generation command on VPS
- `SESSION_SECRET` — run generation command on VPS
- `PORT=3000` — keep default (Nginx proxies to this)
- `CORS_ORIGIN` — leave empty (same-origin, confirmed by `server/server.js` line 26: `cors: { origin: false }`)

---

## Shared Patterns

### `'use strict'` file header
**Source:** `server/app.js` line 1, `server/server.js` line 1, all route files
**Apply to:** `ecosystem.config.js` does NOT use `'use strict'` — it is a CommonJS module.exports config file, not a runtime module. All other new `.js` files would follow the `'use strict'` convention if they were Node.js modules.

### `require('dotenv').config()` placement
**Source:** `server/server.js` line 3 (also `server/app.js` line 3)
**Critical note:** `dotenv` is called in `server/server.js` before any other require. The `ecosystem.config.js` `env_production` block only sets `NODE_ENV` and `PORT` — it does NOT replace dotenv. Both must coexist: PM2 sets `NODE_ENV=production`; dotenv reads `PIN_HASH` and `SESSION_SECRET` from the `.env` file.

### Error handling in `server.js` startup
**Source:** `server/server.js` lines 49-75 (try/catch around `lastWinner` computation)
**Pattern:** Startup errors are caught and logged as warnings, not crashes. `rebuildActiveGames` already follows this. The PM2 `max_restarts: 10` + `exp_backoff_restart_delay: 100` in ecosystem.config.js provides the outer crash-recovery wrapper.

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `ecosystem.config.js` | config | batch | No PM2 config exists anywhere in repo |
| `/etc/nginx/sites-available/pegelkoepp` | config | request-response + streaming | No Nginx config in repo (VPS-only infrastructure) |
| `/etc/cron.daily/pegelkoepp-backup` | utility script | batch, file I/O | No shell scripts or cron files exist in repo |
| VPS firewall + PM2 startup | ops procedure | — | Pure VPS operations; no file artifact in repo |

---

## Metadata

**Analog search scope:** `C:/Users/tobia/Claude/server/` (all .js files), repo root
**Files scanned:** `server/app.js`, `server/server.js`, `server/middleware/auth.js`, `server/routes/auth.js`, `package.json`, `.env.example`
**Pattern extraction date:** 2026-05-22
