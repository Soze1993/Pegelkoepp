'use strict';

const { Router } = require('express');
const db = require('../db');
const requireSession = require('../middleware/auth');

const router = Router();

// POST /api/feedback — public (no PIN needed; members report bugs freely)
router.post('/', (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message required' });
  }
  const trimmed = message.trim().slice(0, 2000);
  db.prepare('INSERT INTO feedback (message) VALUES (?)').run(trimmed);
  res.json({ ok: true });
});

// GET /api/feedback — requires session (admin view)
router.get('/', requireSession, (req, res) => {
  const rows = db.prepare(
    'SELECT id, message, created_at FROM feedback ORDER BY id DESC'
  ).all();
  res.json(rows);
});

module.exports = router;
