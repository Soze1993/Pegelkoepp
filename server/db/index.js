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

module.exports = db;
