'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Create data/ before app.js loads connect-sqlite3 session store (needs the dir to exist)
fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });

const http = require('http');
const app = require('./app');
const db = require('./db');
const seed = require('./db/seed');
const { rebuildActiveGames } = require('./routes/games');

seed(db);
rebuildActiveGames(db);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  const active = require('./routes/games').activeGames.size;
  console.log(`Pegelköpp server listening on port ${PORT} (${active} active game(s) recovered)`);
});
