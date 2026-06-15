'use strict';

const { Router } = require('express');
const db = require('../db');
const requireSession = require('../middleware/auth');
const gameTypes = require('../game-types');
const { reconstructState } = require('./games');
const { getBKLoserId } = require('./highlights');

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
// GET /api/abende/last-summary — public
// Returns the most recently closed Kegelabend (ended_at IS NOT NULL) with its
// KDA champion, BK loser, and a per-game summary list.
// Must be defined BEFORE any GET /:id route to avoid 'last-summary' being
// treated as an id param.
// ---------------------------------------------------------------------------
router.get('/last-summary', (req, res) => {
  const lastAbend = db.prepare(
    'SELECT * FROM abende WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1'
  ).get();
  if (!lastAbend) return res.json(null);

  const abendGames = db.prepare(
    "SELECT * FROM games WHERE abend_id = ? AND status = 'finished' ORDER BY id ASC"
  ).all(lastAbend.id);
  // ORDER BY id ASC — not finished_at — to match BK exemption chain order

  let kda_champion = null;
  let bk_loser = null;
  const gamesSummary = [];
  const playerStatsMap = {};

  for (const game of abendGames) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) continue;
    let state, results;
    try {
      state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) { continue; }

    if (game.type_key === 'kda' && state.gewinner && state.gewinner.id != null) {
      const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(state.gewinner.id);
      if (p) kda_champion = { id: p.id, name: p.name, emoji: p.emoji };
    }

    if (game.type_key === 'bilderkegel') {
      const loserId = getBKLoserId(state);
      if (loserId != null) {
        const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(loserId);
        if (p) bk_loser = { id: p.id, name: p.name, emoji: p.emoji };
      }
    }

    const winners = results.filter(r => r.winner);
    const isDraw = winners.length === 0;
    const winnerEntry = !isDraw ? winners[0] : null;
    let winner_name = null;
    if (winnerEntry) {
      const wp = db.prepare('SELECT name FROM players WHERE id = ?').get(winnerEntry.playerId);
      if (wp) winner_name = wp.name;
    }
    gamesSummary.push({
      id: game.id,
      type_key: game.type_key,
      finished_at: game.finished_at,
      winner_name,
      player_count: results.length
    });

    // Accumulate per-player evening stats
    for (const r of results) {
      if (!playerStatsMap[r.playerId]) {
        const p = db.prepare('SELECT id, name, emoji FROM players WHERE id = ?').get(r.playerId);
        if (!p) continue;
        playerStatsMap[r.playerId] = { id: p.id, name: p.name, emoji: p.emoji, games_played: 0, wins: 0 };
      }
      playerStatsMap[r.playerId].games_played++;
      if (!isDraw && r.winner) playerStatsMap[r.playerId].wins++;
    }
  }

  const players = Object.values(playerStatsMap).sort((a, b) => b.wins - a.wins || b.games_played - a.games_played);

  res.json({
    abend: { id: lastAbend.id, name: lastAbend.name, started_at: lastAbend.started_at, ended_at: lastAbend.ended_at },
    kda_champion,
    bk_loser,
    games: gamesSummary,
    players
  });
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

  const result = db.prepare("INSERT INTO abende (name, started_at) VALUES (?, datetime('now','localtime'))").run(name);
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
    "UPDATE abende SET ended_at = datetime('now','localtime') WHERE id = ?"
  ).run(id);
  if (!info.changes) return res.status(404).json({ error: 'Abend not found' });
  // Archive all guest players when abend ends (D-12, GUEST-04)
  db.prepare('UPDATE players SET archived = 1 WHERE is_guest = 1 AND archived = 0').run();
  res.json({ ok: true });
});

module.exports = router;
