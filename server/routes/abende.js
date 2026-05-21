'use strict';

const { Router } = require('express');
const db = require('../db');
const requireSession = require('../middleware/auth');

const router = Router();

// German weekday abbreviations for default abend name (D-03)
const DAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

function defaultAbendName() {
  const d = new Date();
  return DAYS[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.';
}

// ---------------------------------------------------------------------------
// GET /api/abende/active — public
// Returns the currently open Kegelabend (ended_at IS NULL), or null if none.
// Must be defined BEFORE GET /:id to avoid 'active' being treated as an id param.
// ---------------------------------------------------------------------------
router.get('/active', (req, res) => {
  const abend = db.prepare(
    'SELECT id, name, started_at FROM abende WHERE ended_at IS NULL LIMIT 1'
  ).get();
  res.json(abend || null);
});

// ---------------------------------------------------------------------------
// GET /api/abende — public
// Returns all Kegelabende, newest first.
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const abende = db.prepare(
    'SELECT id, name, started_at, ended_at FROM abende ORDER BY id DESC'
  ).all();
  res.json(abende);
});

// ---------------------------------------------------------------------------
// POST /api/abende — requireSession
// Creates a new Kegelabend. Name defaults to German weekday+date if blank.
// Returns 409 if an abend is already open (D-02, T-04-02).
// ---------------------------------------------------------------------------
router.post('/', requireSession, (req, res) => {
  // Guard: only one open abend at a time (T-04-02)
  const existing = db.prepare('SELECT id FROM abende WHERE ended_at IS NULL LIMIT 1').get();
  if (existing) {
    return res.status(409).json({ error: 'Es läuft bereits ein Abend' });
  }

  const rawName = (req.body && typeof req.body.name === 'string') ? req.body.name.trim() : '';
  const name = rawName || defaultAbendName();

  const result = db.prepare('INSERT INTO abende (name) VALUES (?)').run(name);
  res.status(201).json({ id: result.lastInsertRowid, name });
});

// ---------------------------------------------------------------------------
// POST /api/abende/:id/end — requireSession
// Closes an abend by setting ended_at = now.
// ---------------------------------------------------------------------------
router.post('/:id/end', requireSession, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const info = db.prepare(
    "UPDATE abende SET ended_at = datetime('now') WHERE id = ?"
  ).run(id);
  if (!info.changes) return res.status(404).json({ error: 'Abend not found' });
  res.json({ ok: true });
});

module.exports = router;
