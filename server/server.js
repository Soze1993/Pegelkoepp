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
    socket.emit('game:state', { gameId: activeGame.id, state, idle: false });
  } else {
    // Idle screen: no active game (D-04)
    // lastWinner: null for now — proper winner query lands in plan 02-04 Task 2
    socket.emit('game:state', { idle: true, lastWinner: null });
  }
});

server.listen(PORT, () => {
  const active = require('./routes/games').activeGames.size;
  console.log(`Pegelköpp server listening on port ${PORT} (${active} active game(s) recovered)`);
});
