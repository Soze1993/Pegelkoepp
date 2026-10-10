'use strict';

const { Router } = require('express');
const db = require('../db');
const { reconstructState } = require('./games');
const bilderkegel = require('../game-types/bilderkegel');

const router = Router();

// ---------------------------------------------------------------------------
// Helper: getBKLoserId
// Returns the BK loser (payer) of the given game state, or null if state or
// state.players is falsy. Delegates to the game module: the Stechen loser when
// last place was tied, else the lowest eligible total. Replays of states that
// never reached a decision fall back to the old minimum rule inside the module.
// ---------------------------------------------------------------------------
function getBKLoserId(state) {
  return bilderkegel.getLoserId(state);
}

// ---------------------------------------------------------------------------
// GET /api/highlights/current — public (no auth guard, TV screen needs it)
// Returns:
//   { kda_champion: { id, name, emoji } | null,
//     bk_loser:     { id, name, emoji } | null }
// kda_champion = winner of the most recently finished KDA game
// bk_loser     = payer of the most recently finished BK game (Stechen loser when last place was tied)
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
