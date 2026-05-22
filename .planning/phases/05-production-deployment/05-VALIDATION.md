---
phase: 5
slug: production-deployment
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none — scripts in package.json |
| **Quick run command** | `node --test` |
| **Full suite command** | `node --test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test` (confirm existing suite stays green)
- **After every plan wave:** Full manual smoke test checklist on VPS
- **Before `/gsd:verify-work`:** All 3 ROADMAP success criteria verified manually on VPS
- **Max feedback latency:** 15 seconds (automated) / manual smoke test per wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DEPLOY-01 | T-05-01 | `app.set('trust proxy', 1)` present before session middleware | source assertion | `grep -n "trust proxy" server/app.js` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | DEPLOY-01 | — | ecosystem.config.js present with watch:false | source assertion | `grep "watch" Claude/ecosystem.config.js` | ❌ W1 | ⬜ pending |
| 05-01-03 | 01 | 1 | DEPLOY-01 | — | PM2 startup + save complete | manual | `pm2 list` shows pegelkoepp online | N/A VPS | ⬜ pending |
| 05-01-04 | 01 | 1 | DEPLOY-01 | T-05-02 | Nginx config passes nginx -t | manual | `sudo nginx -t` exits 0 | N/A VPS | ⬜ pending |
| 05-01-05 | 01 | 1 | DEPLOY-01 | — | Certbot issues cert, HTTPS reachable | manual | `curl -I https://domain` → 200 | N/A VPS | ⬜ pending |
| 05-01-06 | 01 | 1 | DEPLOY-01 | — | HTTP redirects to HTTPS | manual | `curl -I http://domain` → 301 | N/A VPS | ⬜ pending |
| 05-01-07 | 01 | 1 | DEPLOY-01 | T-05-03 | WebSocket connects over wss:// | manual | Browser DevTools → WS frame visible | N/A VPS | ⬜ pending |
| 05-02-01 | 02 | 2 | DEPLOY-02 | — | pm2 restart recovers active game | manual | PM2 logs show "N active game(s) recovered" | N/A VPS | ⬜ pending |
| 05-02-02 | 02 | 2 | DEPLOY-02 | — | sudo reboot: app auto-starts within 60s | manual | Timer + browser verify | N/A VPS | ⬜ pending |
| 05-02-03 | 02 | 2 | DEPLOY-02 | — | Backup cron produces valid SQLite file | manual | `sqlite3 backup.db ".tables"` lists tables | N/A VPS | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no new test stubs required. All phase behaviors are VPS-level smoke tests. The existing 194-test suite (`node --test`) covers all app logic including `rebuildActiveGames`.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App reachable via HTTPS | DEPLOY-01 | Requires live VPS + DNS + cert | `curl -I https://yourdomain.com` → 200; check cert via browser lock icon |
| HTTP → HTTPS redirect | DEPLOY-01 | Requires live VPS | `curl -I http://yourdomain.com` → 301 Location: https:// |
| WebSocket over wss:// | DEPLOY-01 | Requires live VPS + Nginx | Browser DevTools Network tab → filter WS → one upgrade request visible |
| Active game survives pm2 restart | DEPLOY-02 | Requires VPS + game state | Start game → `pm2 restart pegelkoepp` → check PM2 logs → TV shows game |
| App auto-starts after reboot | DEPLOY-02 | Requires VPS reboot | `sudo reboot` → start timer → in <60s `pm2 list` shows online |
| SQLite backup runs correctly | DEPLOY-02 | Requires VPS cron | Trigger cron manually → `ls backups/` → open backup with `sqlite3` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (automated)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
