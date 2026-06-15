'use strict';

const { Router } = require('express');
const db = require('../db');
const gameTypes = require('../game-types');
const { reconstructState } = require('./games');
const { getBKLoserId } = require('./highlights');

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/stats — public
// Returns per-player win/loss/draw statistics and personal best scores.
// Computed at query time from the throws + game_players tables (D-09, STAT-01, STAT-02, STAT-03).
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  // Step 1: Get all non-archived players
  const players = db.prepare(
    'SELECT id, name, emoji FROM players WHERE archived = 0 AND is_guest = 0 ORDER BY id ASC'
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
      bests: {}
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

    // isDraw = winners.length === 0 (genuine draws only: VG full-grid with no 4-in-a-row)
    // Multi-winner games (VG team win, FJ hunter win) are wins for all winners — ST12, ST13
    const winners = results.filter(r => r.winner);
    const isDraw = winners.length === 0;

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
      // Skip score <= 0: KDA returns -1 for non-winners, VG/FJ return 0 as placeholder
      if (r.score == null || r.score <= 0) continue;

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

  // Step 3: Pudel counts from throws.
  // Pudel = value=0 AND meta.keinPudel is not set.
  // "kein Pudel" button sends meta={keinPudel:true} for intentional 0-value throws.
  const pudelRows = db.prepare(`
    SELECT t.player_id,
           COUNT(*) AS total_throws,
           SUM(CASE WHEN t.value = 0 AND (t.meta IS NULL OR json_extract(t.meta, '$.keinPudel') IS NULL) THEN 1 ELSE 0 END) AS pudel_count,
           SUM(CASE WHEN t.value = 9 THEN 1 ELSE 0 END) AS neun_count,
           SUM(COALESCE(t.value, 0)) AS total_value
    FROM throws t
    JOIN games g ON t.game_id = g.id
    WHERE g.status = 'finished'
    GROUP BY t.player_id
  `).all();

  const pudelMap = {};
  for (const row of pudelRows) {
    pudelMap[row.player_id] = {
      total_throws: row.total_throws,
      pudel_count: row.pudel_count || 0,
      neun_count: row.neun_count || 0,
      total_value: row.total_value || 0
    };
  }

  // Step 4: Build response array
  const response = players.map(p => {
    const entry = statsMap[p.id];
    const pudel = pudelMap[p.id] || { total_throws: 0, pudel_count: 0, total_value: 0 };
    const { total_throws, pudel_count, neun_count, total_value } = pudel;
    const pudel_pct = total_throws > 0
      ? Math.round(pudel_count / total_throws * 1000) / 10
      : 0;
    const avg_score = total_throws > 0
      ? Math.round(total_value / total_throws * 10) / 10
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
      neun_count,
      avg_score,
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

// Sub-routes must precede any future router.get('/:id') to avoid param capture (RESEARCH.md Pitfall 4)

// ---------------------------------------------------------------------------
// GET /api/stats/year — public
// Returns per-player win leaderboard for a given year.
// Query param: year (4-digit string). Defaults to current year.
// ---------------------------------------------------------------------------
router.get('/year', (req, res) => {
  const year = String(req.query.year || new Date().getFullYear());
  if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: 'Invalid year' });

  const games = db.prepare(
    "SELECT * FROM games WHERE status = 'finished' AND strftime('%Y', finished_at) = ?"
  ).all(year);

  const winsMap = {};
  for (const game of games) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) continue;

    let state;
    let results;
    try {
      state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) {
      continue;
    }

    const winners = results.filter(r => r.winner);
    const isDraw = winners.length === 0;
    if (isDraw) continue;

    for (const w of winners) {
      winsMap[w.playerId] = (winsMap[w.playerId] || 0) + 1;
    }
  }

  const players = db.prepare(
    'SELECT id, name, emoji FROM players WHERE archived = 0 AND is_guest = 0'
  ).all();

  // Participation = distinct Kegelabende a player played at least one finished game in
  const teilnahmenRows = db.prepare(`
    SELECT gp.player_id, COUNT(DISTINCT g.abend_id) AS teilnahmen
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE g.status = 'finished'
      AND strftime('%Y', g.finished_at) = ?
      AND g.abend_id IS NOT NULL
    GROUP BY gp.player_id
  `).all(year);
  const teilnahmenMap = {};
  for (const row of teilnahmenRows) teilnahmenMap[row.player_id] = row.teilnahmen;

  const leaderboard = players
    .map(p => ({ id: p.id, name: p.name, emoji: p.emoji, wins: winsMap[p.id] || 0, teilnahmen: teilnahmenMap[p.id] || 0 }))
    .sort((a, b) => b.wins - a.wins || b.teilnahmen - a.teilnahmen);

  const availableYears = db.prepare(
    "SELECT DISTINCT strftime('%Y', finished_at) AS y FROM games WHERE status = 'finished' AND finished_at IS NOT NULL ORDER BY y DESC"
  ).all().map(r => r.y);

  res.json({ year, leaderboard, available_years: availableYears });
});

// ---------------------------------------------------------------------------
// GET /api/stats/streaks — public
// Returns per-player win streak data: { [player_id]: { current, longest } }
// ---------------------------------------------------------------------------
router.get('/streaks', (req, res) => {
  const allGames = db.prepare(
    "SELECT * FROM games WHERE status = 'finished' ORDER BY id ASC"
  ).all();

  const streaks = {};

  for (const game of allGames) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) continue;

    let state;
    let results;
    try {
      state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) {
      continue;
    }

    const winners = results.filter(r => r.winner);
    const isDraw = winners.length === 0;

    for (const r of results) {
      if (!streaks[r.playerId]) streaks[r.playerId] = { current: 0, longest: 0 };
      const s = streaks[r.playerId];
      if (!isDraw && r.winner) {
        s.current++;
        if (s.current > s.longest) s.longest = s.current;
      } else {
        s.current = 0;
      }
    }
  }

  res.json(streaks);
});

// ---------------------------------------------------------------------------
// GET /api/stats/h2h — public
// Query params: a (player_id), b (player_id) — both must be positive integers
// Returns { player_a, player_b, wins_a, wins_b, draws, total }
// ---------------------------------------------------------------------------
router.get('/h2h', (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (!Number.isInteger(a) || a <= 0 || !Number.isInteger(b) || b <= 0) {
    return res.status(400).json({ error: 'a and b must be positive integers' });
  }

  const sharedGames = db.prepare(`
    SELECT g.* FROM games g
    JOIN game_players gpa ON gpa.game_id = g.id AND gpa.player_id = ?
    JOIN game_players gpb ON gpb.game_id = g.id AND gpb.player_id = ?
    WHERE g.status = 'finished'
    ORDER BY g.id ASC
  `).all(a, b);

  let winsA = 0;
  let winsB = 0;
  let draws = 0;

  for (const game of sharedGames) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) continue;

    let state;
    let results;
    try {
      state = reconstructState(game);
      results = gameModule.getFinalResults(state);
    } catch (e) {
      continue;
    }

    const winners = results.filter(r => r.winner);
    const isDraw = winners.length === 0;

    if (isDraw) {
      draws++;
    } else {
      if (winners.some(w => w.playerId === a)) winsA++;
      if (winners.some(w => w.playerId === b)) winsB++;
    }
  }

  res.json({ player_a: a, player_b: b, wins_a: winsA, wins_b: winsB, draws, total: sharedGames.length });
});

// ---------------------------------------------------------------------------
// GET /api/stats/kda-counts — public
// Returns per-player KDA win count: { [player_id]: count }
// ---------------------------------------------------------------------------
router.get('/kda-counts', (req, res) => {
  const kdaGames = db.prepare(
    "SELECT * FROM games WHERE type_key = 'kda' AND status = 'finished' ORDER BY id ASC"
  ).all();

  const kdaCounts = {};
  for (const game of kdaGames) {
    try {
      const state = reconstructState(game);
      if (state && state.gewinner && state.gewinner.id != null) {
        kdaCounts[state.gewinner.id] = (kdaCounts[state.gewinner.id] || 0) + 1;
      }
    } catch (e) { continue; }
  }

  res.json(kdaCounts);
});

// ---------------------------------------------------------------------------
// GET /api/stats/bk-counts — public
// Returns per-player BK loser count: { [player_id]: count }
// ---------------------------------------------------------------------------
router.get('/bk-counts', (req, res) => {
  const bkGames = db.prepare(
    "SELECT * FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' ORDER BY id ASC"
  ).all();

  const bkCounts = {};
  for (const game of bkGames) {
    try {
      const state = reconstructState(game);
      const loserId = getBKLoserId(state);
      if (loserId != null) {
        bkCounts[loserId] = (bkCounts[loserId] || 0) + 1;
      }
    } catch (e) { continue; }
  }

  res.json(bkCounts);
});

module.exports = router;
