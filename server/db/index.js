'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/kegelclub.db');

// Create data directory if it does not exist (must run before new Database())
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// CRITICAL: WAL mode must be set as the very first pragma (CONTEXT.md C5, RESEARCH.md Pitfall 1)
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// Run schema on startup — idempotent via CREATE TABLE IF NOT EXISTS (D5)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Phase 2 migrations (D-12, D-13): idempotent via try/catch on duplicate-column error
// SQLite does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS — try/catch is the approved pattern.
// Phase 4 migrations (D-02): abende table + abend_id column on games.
const migrations = [
  'ALTER TABLE throws ADD COLUMN meta TEXT NULL',
  'ALTER TABLE game_players ADD COLUMN role TEXT NULL',
  "CREATE TABLE IF NOT EXISTS abende (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, started_at TEXT NOT NULL DEFAULT (datetime('now')), ended_at TEXT NULL)",
  'ALTER TABLE games ADD COLUMN abend_id INTEGER NULL REFERENCES abende(id)',
  "CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
    // Column already exists — idempotent, safe to continue
  }
}

module.exports = db;
