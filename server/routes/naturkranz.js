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

// 'YYYY-MM-DD' that round-trips as a real calendar date
function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

// POST /api/naturkranz — record a Naturkranz { player_id, game_id? | date? }
router.post('/', requireSession, (req, res) => {
  const { player_id, game_id, date } = req.body || {};

  if (!isPositiveInt(player_id)) {
    return res.status(400).json({ error: 'player_id must be a positive integer' });
  }
  const player = db.prepare('SELECT id, name, emoji FROM players WHERE id = ? AND archived = 0').get(player_id);
  if (!player) return res.status(404).json({ error: 'player not found' });

  const hasGame = game_id !== undefined && game_id !== null;
  const hasDate = date !== undefined && date !== null;

  if (hasGame && hasDate) {
    return res.status(400).json({ error: 'game_id and date are mutually exclusive' });
  }

  let gameId = null;
  let abendId = null;
  let createdAt = null; // null -> column default (now, local time)

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
  } else if (hasDate) {
    if (!isValidDate(date)) return res.status(400).json({ error: 'invalid date' });
    createdAt = date + ' 00:00:00';
    const ab = db.prepare('SELECT id FROM abende WHERE date(started_at) = ? ORDER BY id DESC LIMIT 1').get(date);
    abendId = ab ? ab.id : null;
  } else {
    const open = db.prepare('SELECT id FROM abende WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get();
    abendId = open ? open.id : null;
  }

  const info = createdAt
    ? db.prepare('INSERT INTO naturkranz (player_id, game_id, abend_id, created_at) VALUES (?, ?, ?, ?)').run(player.id, gameId, abendId, createdAt)
    : db.prepare('INSERT INTO naturkranz (player_id, game_id, abend_id) VALUES (?, ?, ?)').run(player.id, gameId, abendId);
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

// GET /api/naturkranz?player_id=&game_id= — list events, newest first
router.get('/', requireSession, (req, res) => {
  const where = [];
  const params = [];

  if (req.query.player_id !== undefined) {
    const p = Number(req.query.player_id);
    if (!isPositiveInt(p)) return res.status(400).json({ error: 'invalid player_id' });
    where.push('n.player_id = ?');
    params.push(p);
  }
  if (req.query.game_id !== undefined) {
    const g = Number(req.query.game_id);
    if (!isPositiveInt(g)) return res.status(400).json({ error: 'invalid game_id' });
    where.push('n.game_id = ?');
    params.push(g);
  }

  const sql =
    'SELECT n.id, n.player_id, p.name AS player_name, p.emoji AS player_emoji, ' +
    'n.game_id, g.type_key, n.abend_id, a.name AS abend_name, n.created_at ' +
    'FROM naturkranz n ' +
    'JOIN players p ON p.id = n.player_id ' +
    'LEFT JOIN games g ON g.id = n.game_id ' +
    'LEFT JOIN abende a ON a.id = n.abend_id ' +
    (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
    'ORDER BY n.id DESC LIMIT 500';

  res.json(db.prepare(sql).all(...params));
});

// DELETE /api/naturkranz/:id — remove a (mis-)recorded Naturkranz
router.delete('/:id', requireSession, (req, res) => {
  const id = Number(req.params.id);
  if (!isPositiveInt(id)) return res.status(400).json({ error: 'invalid id' });

  const row = db.prepare('SELECT id, player_id, game_id, abend_id FROM naturkranz WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM naturkranz WHERE id = ?').run(id);

  const io = req.app.locals.io;
  if (io) {
    io.emit('naturkranz:changed', {
      action: 'removed',
      id: row.id,
      player_id: row.player_id,
      game_id: row.game_id,
      abend_id: row.abend_id
    });
  }

  res.json({ ok: true });
});

module.exports = router;
