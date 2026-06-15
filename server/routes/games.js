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
// GET /api/games — list games (NO auth — read-only; ?status filter optional)
// Must appear BEFORE router.get('/:id', ...) — Express route ordering (Pitfall 1)
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const { status } = req.query;
  const games = status
    ? db.prepare('SELECT id, type_key, status, started_at, finished_at, abend_id FROM games WHERE status = ? ORDER BY id DESC').all(status)
    : db.prepare('SELECT id, type_key, status, started_at, finished_at, abend_id FROM games ORDER BY id DESC').all();
  res.json(games);
});

// ---------------------------------------------------------------------------
// POST /api/games — start a new game (requires session)
// ---------------------------------------------------------------------------
router.post('/', requireSession, (req, res) => {
  const { type_key, player_ids, config, roles } = req.body;

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

  // Abend auto-link (D-04): if no abend_id supplied, auto-link to active abend
  let abendId = (req.body && req.body.abend_id) || null;
  if (!abendId) {
    const active = db.prepare('SELECT id FROM abende WHERE ended_at IS NULL LIMIT 1').get();
    if (active) abendId = active.id;
  }

  // Insert game row + game_players in a single transaction
  // roles: optional { '<playerId>': 'fuchs' } map for fuchsjagd (D-13)
  const insertGame = db.prepare('INSERT INTO games (type_key, abend_id) VALUES (?, ?)');
  const insertGamePlayer = db.prepare(
    'INSERT INTO game_players (game_id, player_id, seat, role) VALUES (?, ?, ?, ?)'
  );

  const txn = db.transaction(() => {
    const gameResult = insertGame.run(type_key, abendId);
    const gameId = gameResult.lastInsertRowid;
    players.forEach((p, i) => {
      const role = (roles && roles[String(p.id)]) || null;
      insertGamePlayer.run(gameId, p.id, i, role);
    });
    return gameId;
  });

  const gameId = txn();

  // Initialise in-memory state (pass players with role for fuchsjagd)
  const playersWithRole = players.map(p => ({
    ...p,
    role: (roles && roles[String(p.id)]) || null
  }));
  // KDA uses game_id as seed so reconstruction after server restart is deterministic
  let configWithSeed = gameModule.id === 'kda'
    ? Object.assign({}, config, { seed: String(gameId) })
    : config;

  // BK: derive exemptPlayerId from last finished BK game (T-WVG-01: server-derived, never trust client)
  // T3: use stored payer_player_id directly — no reconstructState, no exemption-chain corruption
  if (type_key === 'bilderkegel') {
    try {
      const lastBK = db.prepare(
        "SELECT payer_player_id FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' ORDER BY id DESC LIMIT 1"
      ).get();
      if (lastBK && lastBK.payer_player_id != null) {
        configWithSeed = Object.assign({}, configWithSeed, { exemptPlayerId: lastBK.payer_player_id });
      }
    } catch (e) {
      // Non-fatal: graceful degradation — start game without exemptPlayerId
      console.warn('BK exempt lookup failed:', e.message);
    }
  }

  const state = gameModule.initState(playersWithRole, configWithSeed);
  activeGames.set(gameId, state);

  // Broadcast to all connected TVs so they auto-switch to the new game (D-11, D-10)
  const io = req.app.locals.io;
  if (io) io.emit('game:started', { gameId, state, type_key });

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
  //    These game types auto-compute throw_index as MAX(existing)+1 per player per game:
  //    - kda/bilderkegel/grosseHaus/kleineHaus: multi-slot or bracket logic means the
  //      client cannot reliably track the DB index across phase boundaries.
  //    - dreiVollen: Stechen phase re-starts throw_index from 0 on the client, which
  //      would collide with the 3 regular throws already stored (throw_index 0-2).
  //    All other game types use the client-provided throw_index with the UNIQUE constraint
  //    as an idempotency guard.
  let effectiveThrowIndex = throw_index;
  if (game.type_key === 'kda' || game.type_key === 'bilderkegel' || game.type_key === 'grosseHaus' || game.type_key === 'kleineHaus' || game.type_key === 'dreiVollen') {
    const { mx } = db.prepare(
      'SELECT MAX(throw_index) AS mx FROM throws WHERE game_id = ? AND player_id = ?'
    ).get(game.id, player_id);
    effectiveThrowIndex = mx !== null ? mx + 1 : 0;
  }

  try {
    db.prepare(
      'INSERT INTO throws (game_id, player_id, throw_index, value, meta) VALUES (?, ?, ?, ?, ?)'
    ).run(game.id, player_id, effectiveThrowIndex, value, meta ? JSON.stringify(meta) : null);
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
    db.prepare("UPDATE games SET status = 'finished', finished_at = datetime('now','localtime') WHERE id = ?").run(game.id);
    activeGames.delete(game.id);
    // T2: persist payer for BK so exemption survives server restart
    if (game.type_key === 'bilderkegel') {
      try {
        const bkResults = gameModule.getFinalResults(newState);
        const payerEntry = bkResults.find(r => r.payer);
        if (payerEntry) {
          db.prepare('UPDATE games SET payer_player_id = ? WHERE id = ?')
            .run(payerEntry.playerId, game.id);
        }
      } catch (e) { /* non-fatal */ }
    }
  }

  // 6. Emit throw event to TV (D-11: 'throw:applied') — guarded so tests without io pass (Pitfall 3)
  const io = req.app.locals.io;
  if (io) {
    io.to(`game:${gameId}`).emit('throw:applied', { state: newState, finished });
    if (finished) {
      let lastWinner = null;
      try {
        const results = gameModule.getFinalResults(newState);
        const winnerEntry = results.find(r => r.winner);
        if (winnerEntry) {
          if (game.type_key === 'viergewinnt' && winnerEntry.team) {
            const winners = results.filter(r => r.winner);
            const names = winners.map(r => { const p = db.prepare('SELECT name FROM players WHERE id = ?').get(r.playerId); return p ? p.name : null; }).filter(Boolean);
            lastWinner = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names[0] || null;
          } else if (winnerEntry.role === 'jaeger') {
            lastWinner = 'Jäger';
          } else {
            const row = db.prepare('SELECT name FROM players WHERE id = ?').get(winnerEntry.playerId);
            lastWinner = row ? row.name : null;
          }
        }
      } catch (e) { /* non-fatal */ }
      io.to(`game:${gameId}`).emit('game:finished', { state: newState, lastWinner, typeKey: game.type_key });
    }
  }

  // 7. Respond
  res.json({ state: newState, finished });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/undo — delete last throw, recompute state (D-08)
// Requires session (same auth boundary as throws). DB-first ordering.
// ---------------------------------------------------------------------------
router.post('/:id/undo', requireSession, (req, res) => {
  const gameId = Number(req.params.id);

  const game = db.prepare("SELECT * FROM games WHERE id = ? AND status = 'active'").get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found or not active' });

  // ORDER BY id DESC — id is AUTOINCREMENT so highest id = most recently inserted throw
  const lastThrow = db.prepare(
    'SELECT id FROM throws WHERE game_id = ? ORDER BY id DESC LIMIT 1'
  ).get(gameId);

  if (!lastThrow) return res.status(400).json({ error: 'No throws to undo' });

  // DB-FIRST: delete before any in-memory mutation (CONTEXT.md C2)
  db.prepare('DELETE FROM throws WHERE id = ?').run(lastThrow.id);

  // Rebuild state from DB (correct — no stale in-memory state, includes meta)
  const newState = reconstructState(game);
  activeGames.set(gameId, newState);

  const gameModule = gameTypes[game.type_key];
  const finished = gameModule.isFinished(newState);

  // Silent TV update (D-07) — guarded so tests without io pass (Pitfall 3)
  const io = req.app.locals.io;
  if (io) io.to(`game:${gameId}`).emit('undo:applied', { state: newState, finished });

  res.json({ state: newState, finished });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/skip-stechen — skip tiebreaker, no winner (dreiVollen)
// ---------------------------------------------------------------------------
router.post('/:id/skip-stechen', requireSession, (req, res) => {
  const gameId = Number(req.params.id);
  const game = db.prepare("SELECT * FROM games WHERE id = ? AND status = 'active'").get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found or not active' });

  const gameModule = gameTypes[game.type_key];
  if (!gameModule || typeof gameModule.skipStechen !== 'function') {
    return res.status(400).json({ error: 'Game type does not support skipStechen' });
  }

  const state = activeGames.get(gameId) || reconstructState(game);
  const newState = gameModule.skipStechen(state);
  activeGames.set(gameId, newState);

  const finished = gameModule.isFinished(newState);
  if (finished) {
    db.prepare("UPDATE games SET status = 'finished', finished_at = datetime('now','localtime') WHERE id = ?").run(game.id);
    activeGames.delete(gameId);
  }

  const io = req.app.locals.io;
  if (io && finished) {
    let lastWinner = null;
    try {
      const results = gameModule.getFinalResults(newState);
      const winnerEntry = results.find(r => r.winner);
      if (winnerEntry) {
        if (game.type_key === 'viergewinnt' && winnerEntry.team) {
          const winners = results.filter(r => r.winner);
          const names = winners.map(r => { const p = db.prepare('SELECT name FROM players WHERE id = ?').get(r.playerId); return p ? p.name : null; }).filter(Boolean);
          lastWinner = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names[0] || null;
        } else if (winnerEntry.role === 'jaeger') {
          lastWinner = 'Jäger';
        } else {
          const row = db.prepare('SELECT name FROM players WHERE id = ?').get(winnerEntry.playerId);
          lastWinner = row ? row.name : null;
        }
      }
    } catch (e) { /* stechenSkipped — no winner */ }
    io.to(`game:${gameId}`).emit('game:finished', { state: newState, lastWinner, typeKey: game.type_key });
  }

  res.json({ state: newState, finished });
});

// ---------------------------------------------------------------------------
// DELETE /api/games/:id — cancel an active game and persist to DB
// ---------------------------------------------------------------------------
router.delete('/:id', requireSession, (req, res) => {
  const gameId = Number(req.params.id);
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return res.status(404).json({ error: 'not found' });
  if (game.status !== 'active') return res.status(409).json({ error: 'not active' });
  db.prepare("UPDATE games SET status = 'cancelled', finished_at = datetime('now','localtime') WHERE id = ?").run(gameId);
  activeGames.delete(gameId);
  const io = req.app.locals.io;
  if (io) io.to(`game:${gameId}`).emit('game:state', { idle: true, lastWinner: null });
  res.json({ ok: true });
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
  // Include gp.role for fuchsjagd game type (D-13)
  const players = db.prepare(
    'SELECT p.id, p.name, p.emoji, gp.role FROM players p ' +
    'JOIN game_players gp ON p.id = gp.player_id ' +
    'WHERE gp.game_id = ? ORDER BY gp.seat'
  ).all(game.id);
  // Include meta; ORDER BY id ASC for undo correctness (D-13, Pitfall 2)
  const throws = db.prepare(
    'SELECT player_id, throw_index, value, meta FROM throws ' +
    'WHERE game_id = ? ORDER BY id ASC'
  ).all(game.id);
  let reconstructConfig = gameModule.id === 'kda' ? { seed: String(game.id) } : {};
  // T4: for BK games, load exemptPlayerId from the previous finished BK game's payer
  if (game.type_key === 'bilderkegel') {
    const prevBK = db.prepare(
      "SELECT payer_player_id FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' AND id < ? ORDER BY id DESC LIMIT 1"
    ).get(game.id);
    if (prevBK && prevBK.payer_player_id != null) {
      reconstructConfig = Object.assign({}, reconstructConfig, { exemptPlayerId: prevBK.payer_player_id });
    }
  }
  let state = gameModule.initState(players, reconstructConfig);
  for (const t of throws) {
    const parsedMeta = t.meta ? JSON.parse(t.meta) : undefined;
    state = gameModule.applyThrow(state, t.player_id, t.value, parsedMeta);
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
