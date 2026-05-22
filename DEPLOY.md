# Pegelköpp — VPS Deployment Runbook

Step-by-step guide to deploying Pegelköpp on a fresh Ubuntu VPS behind Nginx with HTTPS.

---

## Prerequisites

Before starting, confirm:

- VPS running Ubuntu 20.04 or later
- Domain DNS A record pointing to the VPS IP (must propagate before Certbot step)
- SSH access to the VPS as a non-root user with sudo

Check Node.js version:
```bash
node --version
```

If Node.js 22 is not installed:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should show v22.x.x
```

---

## Section 2 — System Packages

Install all required system packages in one step:
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx ufw sqlite3
```

---

## Section 3 — Firewall (ufw)

**Critical: allow OpenSSH BEFORE enabling ufw — otherwise you lock yourself out of the VPS.**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Expected output from `ufw status`: ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) shown as ALLOW.

---

## Section 4 — Clone and Install

Clone the repository (or pull if already cloned):
```bash
# First time:
git clone <repo-url> ~/pegelkoepp/Claude
cd ~/pegelkoepp/Claude
npm install --omit=dev

# If already cloned:
cd ~/pegelkoepp/Claude
git pull
npm install --omit=dev
```

---

## Section 5 — Create .env on VPS

Create the environment file (never commit this file):
```bash
nano ~/pegelkoepp/Claude/.env
```

Contents:
```
PIN_HASH=<generated below>
SESSION_SECRET=<generated below>
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

Generate PIN_HASH (replace YOUR_PIN with the actual club PIN):
```bash
node -e "require('bcryptjs').hash('YOUR_PIN',10).then(console.log)"
```

Generate SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set restrictive permissions:
```bash
chmod 600 ~/pegelkoepp/Claude/.env
```

**Never commit this file.** It is excluded by .gitignore.

---

## Section 6 — Update ecosystem.config.js Log Paths

Replace the `USER` placeholder in ecosystem.config.js with your actual VPS username:
```bash
cd ~/pegelkoepp/Claude
sed -i 's|/home/USER/|/home/YOUR_USERNAME/|g' ecosystem.config.js
```

Replace `YOUR_USERNAME` with your actual username (e.g. `ubuntu`).

Verify:
```bash
grep "pm2/logs" ecosystem.config.js
```

---

## Section 7 — PM2 Install and Startup

Follow this exact sequence — order matters:

```bash
# a) Install PM2 globally
sudo npm install -g pm2

# b) Install log rotation module and configure it
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# c) Generate the systemd startup hook — run WITHOUT sudo, then copy and run the printed sudo command
pm2 startup

# d) Start the app using the ecosystem config
pm2 start ~/pegelkoepp/Claude/ecosystem.config.js --env production

# e) Save the process list so it survives reboots
pm2 save

# f) Verify the app is running
pm2 list
```

After step f: `pegelkoepp` should show `status=online`.

Check startup log:
```bash
pm2 logs pegelkoepp --lines 5
```

Expected log line:
```
Pegelköpp server listening on port 3000 (0 active game(s) recovered)
```

---

## Section 8 — Nginx Configuration

Create the Nginx site config:
```bash
sudo nano /etc/nginx/sites-available/pegelkoepp
```

Paste the following (replace `yourdomain.com` and `USER` with your values):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    location /public/ {
        alias /home/USER/pegelkoepp/Claude/public/;
        expires 1h;
    }
}
```

Enable the site, test config, and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/pegelkoepp /etc/nginx/sites-enabled/
sudo nginx -t    # must show "syntax is ok" and "test is successful"
sudo nginx -s reload
```

---

## Section 9 — Certbot HTTPS

DNS must already point to the VPS IP before running Certbot (allow up to 24h for propagation).

```bash
sudo certbot --nginx -d yourdomain.com
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
```

Certbot automatically edits the Nginx config to add SSL, installs the certificate, and sets up a systemd timer for auto-renewal. Certificates renew automatically 30 days before expiry.

---

## Section 10 — Smoke Test HTTPS

Verify HTTP redirects to HTTPS and the app responds:
```bash
curl -I http://yourdomain.com    # expect: HTTP/1.1 301 Moved Permanently
curl -I https://yourdomain.com   # expect: HTTP/1.1 200 OK
```

Browser checks:
1. Open tablet browser, navigate to `https://yourdomain.com`
2. Enter PIN — the PIN overlay should dismiss (confirms session cookie works with trust proxy)
3. Browser DevTools → Network tab → filter by "WS" — one WebSocket connection should appear (not repeated XHR polling)

---

## Section 11 — Crash Recovery Test (DEPLOY-02)

Verify that active game state survives an app restart:

1. Open the tablet, start a game, submit a few throws
2. Restart the app:
```bash
pm2 restart pegelkoepp
pm2 logs pegelkoepp --lines 20
```

Expected log line:
```
Pegelköpp server listening on port 3000 (1 active game(s) recovered)
```

3. Open the TV display in a browser and confirm the active game state is shown (not the idle screen)

---

## Section 12 — Reboot Test (DEPLOY-02)

Verify the app auto-starts after a full server reboot:
```bash
sudo reboot
```

Start a timer. Within 60 seconds, SSH back into the VPS:
```bash
pm2 list   # pegelkoepp should show status=online
```

Open a browser and verify the app loads at `https://yourdomain.com`.

---

## Section 13 — Daily Backup Cron

Create the backup script:
```bash
sudo nano /etc/cron.daily/pegelkoepp-backup
```

Paste (replace `<user>` with your VPS username):
```bash
#!/bin/bash
BACKUP_DIR=/home/<user>/pegelkoepp/backups
DB=/home/<user>/pegelkoepp/Claude/data/kegelclub.db
mkdir -p "$BACKUP_DIR"
sqlite3 "$DB" "VACUUM INTO '$BACKUP_DIR/kegelclub-$(date +%F).db'"
find "$BACKUP_DIR" -name "kegelclub-*.db" -mtime +30 -delete
```

Make it executable and run it once to verify:
```bash
chmod +x /etc/cron.daily/pegelkoepp-backup
sudo /etc/cron.daily/pegelkoepp-backup
ls ~/pegelkoepp/backups/
sqlite3 ~/pegelkoepp/backups/kegelclub-$(date +%F).db ".tables"
```

Expected: the `kegelclub-YYYY-MM-DD.db` file exists and `.tables` lists the database tables.

The cron runs daily automatically. Backups older than 30 days are deleted.

---

## Quick Reference

| Action | Command |
|--------|---------|
| View app status | `pm2 list` |
| View app logs | `pm2 logs pegelkoepp --lines 50` |
| Restart app | `pm2 restart pegelkoepp` |
| Stop app | `pm2 stop pegelkoepp` |
| Deploy update | `git pull && npm install --omit=dev && pm2 restart pegelkoepp` |
| Test Nginx config | `sudo nginx -t` |
| Reload Nginx | `sudo nginx -s reload` |
| Check cert expiry | `sudo certbot certificates` |
