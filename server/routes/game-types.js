'use strict';

const { Router } = require('express');
const db = require('../db');
const requireSession = require('../middleware/auth');

const router = Router();

// ---------------------------------------------------------------------------
// slugify — convert a display name into a URL-safe key (D-08)
// Examples: "Mein Spiel!" → "mein-spiel", "Über-Spiel" → "ueber-spiel"
// ---------------------------------------------------------------------------
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[äöü]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// GET /api/game-types — public
// Returns only custom (is_builtin=0) game type definitions.
// Built-in types are code modules, not rows in this table (D-08).
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const types = db.prepare(
    'SELECT * FROM game_type_defs WHERE is_builtin = 0 ORDER BY id ASC'
  ).all();
  res.json(types);
});

// ---------------------------------------------------------------------------
// POST /api/game-types — requireSession (T-04-03)
// Creates a custom game type. The key is auto-generated via slugify.
// Returns 409 on duplicate key (T-04-06), 400 if name is blank.
// ---------------------------------------------------------------------------
router.post('/', requireSession, (req, res) => {
  const rawName = (req.body && typeof req.body.name === 'string') ? req.body.name.trim() : '';
  if (!rawName) {
    return res.status(400).json({ error: 'name required' });
  }

  const key = slugify(rawName);
  if (!key) {
    return res.status(400).json({ error: 'name produces empty key after slugify' });
  }

  const description = (req.body && typeof req.body.description === 'string') ? req.body.description.trim() : null;

  try {
    const result = db.prepare(
      'INSERT INTO game_type_defs (key, name, description, is_builtin) VALUES (?, ?, ?, 0)'
    ).run(key, rawName, description);
    res.status(201).json({
      id: result.lastInsertRowid,
      key,
      name: rawName,
      description: description || null
    });
  } catch (e) {
    if (e.message && (e.message.includes('UNIQUE') || e.message.includes('SQLITE_CONSTRAINT'))) {
      return res.status(409).json({ error: 'Ein Spieltyp mit diesem Namen existiert bereits' });
    }
    throw e;
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/game-types/:id — requireSession (T-04-01, T-04-03)
// Removes a custom game type. Returns 403 if it is a built-in type.
// ---------------------------------------------------------------------------
router.delete('/:id', requireSession, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }

  const row = db.prepare('SELECT is_builtin FROM game_type_defs WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Game type not found' });

  if (row.is_builtin) {
    return res.status(403).json({ error: 'Standard-Spieltypen können nicht gelöscht werden' });
  }

  db.prepare('DELETE FROM game_type_defs WHERE id = ? AND is_builtin = 0').run(id);
  res.json({ ok: true });
});

module.exports = router;
