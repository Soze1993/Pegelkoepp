'use strict';

const { Router } = require('express');
const db = require('../db');
const gameTypes = require('../game-types');
const { reconstructState } = require('./games');

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/stats — public
// Returns per-player win/loss/draw statistics and personal best scores.
// Computed at query time from the throws + game_players tables (D-09, STAT-01, STAT-02, STAT-03).
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  // Step 1: Get all non-archived players
  const players = db.prepare(
    'SELECT id, name, emoji FROM players WHERE archived = 0 ORDER BY id ASC'
  ).all();

  // Build stats map keyed by player id
  const statsMap = {};
  for (const p of players) {
    statsMap[p.id] = {
      player_id: p.id,
      name: p.name,
      emoji: p.emoji,
      wins: 0,
      losses: 0,
      draws: 0,
      bests: {} // type_key → best score (max or min depending on type)
    };
  }

  // Step 2: Iterate all finished games
  const finishedGames = db.prepare(
    "SELECT id, type_key FROM games WHERE status = 'finished'"
  ).all();

  for (const game of finishedGames) {
    const gameModule = gameTypes[game.type_key];
    // Skip if unknown type_key (custom types, future types) — ST20
    if (!gameModule) continue;

    let state;
    let results;
    try {
      state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) {
      // Skip games that fail to reconstruct (ST20)
      continue;
    }

    // isDraw = winners.length !== 1
    // Handles: VG draw (0 winners) AND multi-winner ties (2+ winners) — ST12, ST13
    const winners = results.filter(r => r.winner);
    const isDraw = winners.length !== 1;

    for (const r of results) {
      const entry = statsMap[r.playerId];
      if (!entry) continue; // player archived or not in active list

      // Win/loss/draw attribution (D-05)
      if (isDraw) {
        entry.draws++;
      } else if (r.winner) {
        entry.wins++;
      } else {
        entry.losses++;
      }

      // Personal best tracking (D-06, STAT-02)
      // Skip score=0 (VG/FJ-jaeger placeholder scores)
      if (r.score === 0) continue;

      const prev = entry.bests[game.type_key];
      if (game.type_key === 'kleineHaus') {
        // kleineHaus: best = winner's minimum score (lower is better for kleineHaus winner)
        // Only record for the winner (canonical "best" is the winner's score)
        if (r.winner) {
          if (prev === undefined || r.score < prev) {
            entry.bests[game.type_key] = r.score;
          }
        }
      } else {
        // All other types: personal best = maximum score achieved by any player
        // Recorded for all players (not just winners) so a player can see their own best
        if (prev === undefined || r.score > prev) {
          entry.bests[game.type_key] = r.score;
        }
      }
    }
  }

  // Step 3: Pudel counts from throws.meta
  // json_extract(t.meta, '$.pudel') = 1 (integer 1, not boolean true — SQLite JSON)
  const pudelRows = db.prepare(`
    SELECT t.player_id,
           COUNT(*) AS total_throws,
           SUM(CASE WHEN json_extract(t.meta, '$.pudel') = 1 THEN 1 ELSE 0 END) AS pudel_count
    FROM throws t
    JOIN games g ON t.game_id = g.id
    WHERE g.status = 'finished'
    GROUP BY t.player_id
  `).all();

  const pudelMap = {};
  for (const row of pudelRows) {
    pudelMap[row.player_id] = {
      total_throws: row.total_throws,
      pudel_count: row.pudel_count || 0
    };
  }

  // Step 4: Build response array
  const response = players.map(p => {
    const entry = statsMap[p.id];
    const pudel = pudelMap[p.id] || { total_throws: 0, pudel_count: 0 };
    const { total_throws, pudel_count } = pudel;
    const pudel_pct = total_throws > 0
      ? Math.round(pudel_count / total_throws * 1000) / 10
      : 0;

    const personal_bests = Object.entries(entry.bests).map(([type_key, score]) => ({ type_key, score }));

    return {
      player_id: p.id,
      name: p.name,
      emoji: p.emoji,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      pudel_count,
      total_throws,
      pudel_pct,
      personal_bests
    };
  });

  // Tournament record: Drei in die Vollen top6Sum
  let dvBestSum = null;
  let dvBestGameId = null;
  const dvGames = finishedGames.filter(g => g.type_key === 'dreiVollen');
  for (const g of dvGames) {
    try {
      const dvState = reconstructState(g);
      const dvResults = gameTypes['dreiVollen'].getFinalResults(dvState);
      if (dvResults.length > 0 && dvResults[0].top6Sum != null) {
        if (dvBestSum === null || dvResults[0].top6Sum > dvBestSum) {
          dvBestSum = dvResults[0].top6Sum;
          dvBestGameId = g.id;
        }
      }
    } catch (e) { continue; }
  }
  const tournament_records = {
    dreiVollen: dvBestSum !== null ? { best_sum: dvBestSum, game_id: dvBestGameId } : null
  };

  res.json({ players: response, tournament_records });
});

module.exports = router;
