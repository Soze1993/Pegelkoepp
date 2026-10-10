'use strict';

const { Router } = require('express');
const db = require('../db');
const requireSession = require('../middleware/auth');

const router = Router();

// A Naturkranz is independent of scoring: this router never reads or writes
// throws, activeGames or any game state.

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}

// POST /api/naturkranz — record a Naturkranz { player_id, game_id? }
router.post('/', requireSession, (req, res) => {
  const { player_id, game_id } = req.body || {};

  if (!isPositiveInt(player_id)) {
    return res.status(400).json({ error: 'player_id must be a positive integer' });
  }
  const player = db.prepare('SELECT id, name, emoji FROM players WHERE id = ? AND archived = 0').get(player_id);
  if (!player) return res.status(404).json({ error: 'player not found' });

  const hasGame = game_id !== undefined && game_id !== null;

  let gameId = null;
  let abendId = null;

  if (hasGame) {
    if (!isPositiveInt(game_id)) {
      return res.status(400).json({ error: 'game_id must be a positive integer' });
    }
    const game = db.prepare('SELECT id, abend_id FROM games WHERE id = ?').get(game_id);
    if (!game) return res.status(404).json({ error: 'game not found' });
    const member = db.prepare('SELECT 1 AS x FROM game_players WHERE game_id = ? AND player_id = ?').get(game_id, player_id);
    if (!member) return res.status(400).json({ error: 'player not in game' });
    gameId = game.id;
    abendId = game.abend_id || null;
  } else {
    const open = db.prepare('SELECT id FROM abende WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get();
    abendId = open ? open.id : null;
  }

  const info = db.prepare('INSERT INTO naturkranz (player_id, game_id, abend_id) VALUES (?, ?, ?)').run(player.id, gameId, abendId);
  const row = db.prepare(
    'SELECT id, player_id, game_id, abend_id, created_at FROM naturkranz WHERE id = ?'
  ).get(Number(info.lastInsertRowid));

  const io = req.app.locals.io;
  if (io) {
    io.emit('naturkranz:changed', {
      action: 'added',
      id: row.id,
      player_id: row.player_id,
      player_name: player.name,
      game_id: row.game_id,
      abend_id: row.abend_id,
      created_at: row.created_at
    });
  }

  res.status(201).json(row);
});

module.exports = router;
