'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Create data/ before app.js loads connect-sqlite3 session store (needs the dir to exist)
fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const db = require('./db');
const seed = require('./db/seed');
const { rebuildActiveGames } = require('./routes/games');

seed(db);
rebuildActiveGames(db);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Attach Socket.io to the same http.Server Express uses (D-09)
// cors: false — TV page is served from the same Express server, no cross-origin needed
const io = new Server(server, { cors: { origin: false } });
app.locals.io = io;  // Must be set BEFORE server.listen so route handlers can read it

io.on('connection', (socket) => {
  // Allow any client (tablet or TV) to join a game room after game:started
  socket.on('join', (gameId) => { socket.join(`game:${gameId}`); });

  // Find most recently started active game (D-10: highest id where status='active')
  const activeGame = db.prepare(
    "SELECT id FROM games WHERE status = 'active' ORDER BY id DESC LIMIT 1"
  ).get();

  if (activeGame) {
    // Lazy require to avoid circular dependency at module-load time (RESEARCH.md A1)
    const { activeGames, reconstructState } = require('./routes/games');
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(activeGame.id);
    const state = activeGames.get(activeGame.id) || reconstructState(game);
    socket.join(`game:${activeGame.id}`);
    socket.emit('game:state', { gameId: activeGame.id, state, idle: false, type_key: game.type_key });
  } else {
    // Idle screen: no active game (D-04)
    // Query the most recently finished game and derive the winner name (plan 02-04 Task 2)
    let lastWinner = null;
    try {
      const lastGame = db.prepare(
        "SELECT id FROM games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT 1"
      ).get();
      if (lastGame) {
        const { reconstructState } = require('./routes/games');
        const gameTypes = require('./game-types');
        const finishedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(lastGame.id);
        const finalState = reconstructState(finishedGame);
        const gameModule = gameTypes[finishedGame.type_key];
        if (gameModule && typeof gameModule.getFinalResults === 'function') {
          const results = gameModule.getFinalResults(finalState);
          const winners = results.filter(r => r.winner);
          if (winners.length > 1) {
            const names = winners.map(r => {
              const p = db.prepare('SELECT name FROM players WHERE id = ?').get(r.playerId);
              return p ? p.name : null;
            }).filter(Boolean);
            lastWinner = names.length > 1
              ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1]
              : names[0] || null;
          } else if (winners.length === 1) {
            const winnerRow = db.prepare('SELECT name FROM players WHERE id = ?').get(winners[0].playerId);
            lastWinner = winnerRow ? winnerRow.name : null;
          }
        }
      }
    } catch (e) {
      // Fallback to null — do not crash on legacy data or reconstruction failure (T-02-Reconstruct)
      console.warn('lastWinner computation failed:', e.message);
      lastWinner = null;
    }
    socket.emit('game:state', { idle: true, lastWinner });
  }
});

server.listen(PORT, () => {
  const active = require('./routes/games').activeGames.size;
  console.log(`Pegelköpp server listening on port ${PORT} (${active} active game(s) recovered)`);
});
