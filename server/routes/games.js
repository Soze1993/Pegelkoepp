'use strict';

const { Router } = require('express');
const db = require('../db');
const requireSession = require('../middleware/auth');
const gameTypes = require('../game-types');

const router = Router();

// In-memory active game states. Source of truth = throws table; this is a perf cache.
// Rebuilt at server startup via rebuildActiveGames (see server.js).
const activeGames = new Map();

// ---------------------------------------------------------------------------
// POST /api/games — start a new game (requires session)
// ---------------------------------------------------------------------------
router.post('/', requireSession, (req, res) => {
  const { type_key, player_ids, config } = req.body;

  // Validate type_key
  const gameModule = gameTypes[type_key];
  if (!gameModule) {
    return res.status(400).json({ error: `Unknown game type: '${type_key}'` });
  }

  // Validate player_ids
  if (!Array.isArray(player_ids) || player_ids.length === 0) {
    return res.status(400).json({ error: 'player_ids must be a non-empty array' });
  }

  // Resolve each player — must be active (not archived)
  const getPlayer = db.prepare('SELECT id, name, emoji FROM players WHERE id = ? AND archived = 0');
  const players = player_ids.map(id => getPlayer.get(id)).filter(Boolean);
  if (players.length !== player_ids.length) {
    return res.status(400).json({ error: 'One or more player_ids are invalid or archived' });
  }

  // Insert game row + game_players in a single transaction
  const insertGame = db.prepare('INSERT INTO games (type_key) VALUES (?)');
  const insertGamePlayer = db.prepare('INSERT INTO game_players (game_id, player_id, seat) VALUES (?, ?, ?)');

  const txn = db.transaction(() => {
    const gameResult = insertGame.run(type_key);
    const gameId = gameResult.lastInsertRowid;
    players.forEach((p, i) => insertGamePlayer.run(gameId, p.id, i));
    return gameId;
  });

  const gameId = txn();

  // Initialise in-memory state
  const state = gameModule.initState(players, config);
  activeGames.set(gameId, state);

  res.status(201).json({ id: gameId, type_key, status: 'active' });
});

// ---------------------------------------------------------------------------
// GET /api/games/:id — read current game state (NO auth — TV display needs this)
// ---------------------------------------------------------------------------
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const gameModule = gameTypes[game.type_key];
  if (!gameModule) {
    return res.status(400).json({ error: `Unknown game type: '${game.type_key}'` });
  }

  let state = activeGames.get(game.id);
  if (!state) {
    // Crash recovery / cache eviction — reconstruct from DB
    state = reconstructState(game);
  }

  const finished = gameModule.isFinished(state);
  res.json({
    game,
    state,
    finished,
    results: finished ? gameModule.getFinalResults(state) : null
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/throws — submit a throw (requires session)
// DB-FIRST ordering (CONTEXT.md C2 + BACK-03): INSERT before applyThrow.
// ---------------------------------------------------------------------------
router.post('/:id/throws', requireSession, (req, res) => {
  const gameId = Number(req.params.id);

  // 1. Validate game exists and is active
  const game = db.prepare("SELECT * FROM games WHERE id = ? AND status = 'active'").get(gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found or not active' });
  }

  // 2. Validate body fields — all must be integers
  const { player_id, throw_index, value, meta } = req.body;
  if (!Number.isInteger(player_id) || !Number.isInteger(throw_index) || !Number.isInteger(value)) {
    return res.status(400).json({ error: 'player_id, throw_index, and value must be integers' });
  }

  // 3. INSERT into throws FIRST — synchronous + crash-safe (CONTEXT.md C2 + C3).
  //    If UNIQUE constraint fires → 409 (no state mutation).
  try {
    db.prepare(
      'INSERT INTO throws (game_id, player_id, throw_index, value) VALUES (?, ?, ?, ?)'
    ).run(game.id, player_id, throw_index, value);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Duplicate throw' });
    }
    throw e;
  }

  // 4. ONLY after successful DB insert: update in-memory state
  const gameModule = gameTypes[game.type_key];
  let state = activeGames.get(game.id) || reconstructState(game);
  const newState = gameModule.applyThrow(state, player_id, value, meta);
  activeGames.set(game.id, newState);

  // 5. If game is now finished: update DB + remove from cache
  const finished = gameModule.isFinished(newState);
  if (finished) {
    db.prepare("UPDATE games SET status = 'finished', finished_at = datetime('now') WHERE id = ?").run(game.id);
    activeGames.delete(game.id);
  }

  // 6. Respond
  res.json({ state: newState, finished });
});

// ---------------------------------------------------------------------------
// reconstructState — rebuild game state from DB (throws + players)
//
// NOTE: The throws table does not yet store throw metadata (e.g., the slot for
// grosseHaus, the pudel flag for viergewinnt). Phase 1 reconstructs only the
// games whose modules do not require meta. Persisting meta is a Phase 2 task
// before grosseHaus / kleineHaus / viergewinnt games can be played through
// the API. See SUMMARY.md notes.
// ---------------------------------------------------------------------------
function reconstructState(game) {
  const gameModule = gameTypes[game.type_key];
  const players = db.prepare(
    'SELECT p.id, p.name, p.emoji FROM players p ' +
    'JOIN game_players gp ON p.id = gp.player_id ' +
    'WHERE gp.game_id = ? ORDER BY gp.seat'
  ).all(game.id);
  const throws = db.prepare(
    'SELECT player_id, throw_index, value FROM throws ' +
    'WHERE game_id = ? ORDER BY throw_index ASC'
  ).all(game.id);
  let state = gameModule.initState(players);
  for (const t of throws) {
    state = gameModule.applyThrow(state, t.player_id, t.value);
  }
  return state;
}

// ---------------------------------------------------------------------------
// rebuildActiveGames — called from server.js between seed() and listen()
//
// Queries all active games from DB and populates the activeGames Map by
// replaying each game's throw history via reconstructState.
//
// NOTE: reconstructState queries the module-level `db`. Callers in tests must
// set process.env.DB_PATH before requiring this module so the singleton points
// at the test DB. This holds for our test setup (see games.test.js) and for
// server.js where DB_PATH is read from .env at boot time.
// ---------------------------------------------------------------------------
function rebuildActiveGames(database) {
  // Use the passed-in database param if provided (e.g., from tests with isolated DB).
  // Fall back to the module-level `db` import otherwise.
  const conn = database || db;
  const activeRows = conn.prepare(
    "SELECT id, type_key, status, started_at, finished_at FROM games WHERE status = 'active'"
  ).all();
  for (const game of activeRows) {
    const gameModule = gameTypes[game.type_key];
    if (!gameModule) {
      console.warn(`rebuildActiveGames: skipping game ${game.id} — unknown type_key '${game.type_key}'`);
      continue;
    }
    try {
      const state = reconstructState(game);
      activeGames.set(game.id, state);
    } catch (err) {
      // Some game types (e.g. fuchsjagd, viergewinnt) need metadata not stored in Phase 1.
      // Skip them rather than crashing the startup. A Phase 2 schema migration (meta column)
      // will resolve this. See SUMMARY.md "Known Stubs" section.
      console.warn(`rebuildActiveGames: skipping game ${game.id} (${game.type_key}) — reconstruction failed: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = router;
module.exports.activeGames = activeGames;
module.exports.reconstructState = reconstructState;
module.exports.rebuildActiveGames = rebuildActiveGames;
