'use strict';

const { Router } = require('express');
const db = require('../db');
const requireSession = require('../middleware/auth');
const router = Router();

// GET /api/players — public, returns active players only, ordered by id ASC
router.get('/', (req, res) => {
  const players = db.prepare(
    'SELECT id, name, emoji, is_guest FROM players WHERE archived = 0 ORDER BY id ASC'
  ).all();
  res.json(players);
});

// POST /api/players — requires session
router.post('/', requireSession, (req, res) => {
  const { name, emoji, is_guest } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name required' });
  }
  const cleanName = name.trim();
  if (!cleanName) return res.status(400).json({ error: 'name required' });
  const cleanEmoji = (typeof emoji === 'string' && emoji.trim()) ? emoji.trim() : '🎳';
  const guestFlag = is_guest ? 1 : 0;
  const result = db.prepare(
    'INSERT INTO players (name, emoji, is_guest) VALUES (?, ?, ?)'
  ).run(cleanName, cleanEmoji, guestFlag);
  res.status(201).json({
    id: result.lastInsertRowid,
    name: cleanName,
    emoji: cleanEmoji,
    is_guest: guestFlag
  });
});

// PUT /api/players/:id — requires session
router.put('/:id', requireSession, (req, res) => {
  const { name, emoji } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name required' });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const info = db.prepare(
    'UPDATE players SET name = ?, emoji = ? WHERE id = ? AND archived = 0'
  ).run(name.trim(), emoji || '🎳', id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// PUT /api/players/:id/archive — requires session (no hard delete; BACK-01)
router.put('/:id/archive', requireSession, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  const info = db.prepare(
    'UPDATE players SET archived = 1 WHERE id = ? AND archived = 0'
  ).run(id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
