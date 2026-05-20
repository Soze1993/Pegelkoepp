'use strict';

const { Router } = require('express');
const db = require('../db');
const router = Router();

// GET /api/players — public, returns active players only, ordered by id ASC
router.get('/', (req, res) => {
  const players = db.prepare(
    'SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id ASC'
  ).all();
  res.json(players);
});

module.exports = router;
