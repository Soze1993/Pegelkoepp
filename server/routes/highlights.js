'use strict';

const { Router } = require('express');
const db = require('../db');
const { reconstructState } = require('./games');

const router = Router();

// ---------------------------------------------------------------------------
// Private helper: getBKLoserId
// Returns the player id with the lowest bkTotal in the given BK game state,
// or null if state or state.players is falsy.
// bkTotal: sum of bildPts values, null entries count as 0.
// ---------------------------------------------------------------------------
function getBKLoserId(state) {
  if (!state || !state.players || state.players.length === 0) return null;
  const tots = state.players.map(p => ({
    id: p.id,
    total: (p.bildPts || []).reduce((a, b) => a + (b !== null ? b : 0), 0)
  }));
  const eligible = tots.filter(x => x.id !== (state.exemptPlayerId || null));
  const effTots = eligible.length > 0 ? eligible : tots;  // fallback: all players if somehow all exempt
  const minTot = Math.min(...effTots.map(t => t.total));
  const loser = effTots.find(t => t.total === minTot);
  return loser ? loser.id : null;
}

// ---------------------------------------------------------------------------
// GET /api/highlights/current — public (no auth guard, TV screen needs it)
// Returns:
//   { kda_champion: { id, name, emoji } | null,
//     bk_loser:     { id, name, emoji } | null }
// kda_champion = winner of the most recently finished KDA game
// bk_loser     = player with the lowest bkTotal in the most recently finished BK game
// ---------------------------------------------------------------------------
router.get('/current', (req, res) => {
  const result = { kda_champion: null, bk_loser: null };

  // --- KDA champion ---
  const kdaGame = db.prepare(
    "SELECT * FROM games WHERE type_key = 'kda' AND status = 'finished' ORDER BY finished_at DESC LIMIT 1"
  ).get();

  if (kdaGame) {
    try {
      const state = reconstructState(kdaGame);
      if (state && state.gewinner && state.gewinner.id != null) {
        const player = db.prepare(
          'SELECT id, name, emoji FROM players WHERE id = ?'
        ).get(state.gewinner.id);
        if (player) {
          result.kda_champion = { id: player.id, name: player.name, emoji: player.emoji };
        }
      }
    } catch (e) {
      // Non-fatal: skip this game if reconstruction fails (T-07-02-03)
    }
  }

  // --- BK loser ---
  const bkGame = db.prepare(
    "SELECT * FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' ORDER BY finished_at DESC LIMIT 1"
  ).get();

  if (bkGame) {
    try {
      const state = reconstructState(bkGame);
      const loserId = getBKLoserId(state);
      if (loserId != null) {
        const player = db.prepare(
          'SELECT id, name, emoji FROM players WHERE id = ?'
        ).get(loserId);
        if (player) {
          result.bk_loser = { id: player.id, name: player.name, emoji: player.emoji };
        }
      }
    } catch (e) {
      // Non-fatal: skip this game if reconstruction fails (T-07-02-03)
    }
  }

  res.json(result);
});

module.exports = router;
module.exports.getBKLoserId = getBKLoserId;
