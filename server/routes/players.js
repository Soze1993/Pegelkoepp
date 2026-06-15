'use strict';

const express = require('express');
const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const requireSession = require('../middleware/auth');
const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../public/uploads/profiles');
const rawUpload = express.raw({ type: ['image/jpeg', 'image/png'], limit: '5mb' });

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

// POST /api/players/:id/photo — upload profile photo (D-04, D-05, D-06, D-07)
router.post('/:id/photo', requireSession, rawUpload, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  // Verify player exists and is not archived
  const player = db.prepare('SELECT id FROM players WHERE id = ? AND archived = 0').get(id);
  if (!player) return res.status(404).json({ error: 'player not found' });

  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return res.status(400).json({ error: 'body must be image/jpeg or image/png' });
  }
  // Magic byte validation (D-05 security, RESEARCH.md Pattern 1)
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng  = buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
  if (!isJpeg && !isPng) {
    return res.status(400).json({ error: 'invalid image: not JPEG or PNG' });
  }
  // Always save as {id}.jpg regardless of input type (D-06)
  fs.writeFileSync(path.join(UPLOADS_DIR, id + '.jpg'), buf);
  res.json({ ok: true, url: '/uploads/profiles/' + id + '.jpg' });
});

module.exports = router;
