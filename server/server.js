'use strict';

require('dotenv').config();

const http = require('http');
const app = require('./app');
const db = require('./db');
const seed = require('./db/seed');

seed(db);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Pegelköpp server listening on port ${PORT}`);
});
