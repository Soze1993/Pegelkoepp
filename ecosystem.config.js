module.exports = {
  apps: [{
    name: 'pegelkoepp',
    script: './server/server.js',
    instances: 1,           // single instance: SQLite is single-writer
    exec_mode: 'fork',      // fork (not cluster) — no need for IPC with SQLite
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
      // PIN_HASH and SESSION_SECRET are NOT set here — they are loaded by dotenv from .env
      // Never put secrets in ecosystem.config.js (it is committed to git)
    },
    max_memory_restart: '300M',
    max_restarts: 10,
    min_uptime: 2000,           // must be stable for 2s before restart counts as "healthy"
    exp_backoff_restart_delay: 100,
    // Replace USER with your VPS username (e.g. /home/ubuntu/.pm2/logs/pegelkoepp-error.log)
    error_file: '/home/USER/.pm2/logs/pegelkoepp-error.log',
    out_file: '/home/USER/.pm2/logs/pegelkoepp-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    watch: false              // NEVER watch in production — causes restart loops on log writes
  }]
};
