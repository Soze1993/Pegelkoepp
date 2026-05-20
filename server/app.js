'use strict';

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const app = express();

// --- Middleware (order matters) ---

// Update Helmet CSP to allow WebSocket upgrades (ws: and wss:) in connect-src
// Default Helmet 8 connect-src 'self' does NOT cover ws:/wss: — Socket.io upgrades are silently blocked without this.
// All other Helmet defaults remain unchanged via spread of getDefaultDirectives().
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'connect-src': ["'self'", 'ws:', 'wss:']
    }
  }
}));
app.use(morgan('dev'));
app.use(cors({ origin: process.env.CORS_ORIGIN || false, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware with connect-sqlite3 store
// SESSION_DIR can be overridden in tests to use a tmp path
// Fallback secret exists ONLY so dev server starts without .env; production must provide one
const sessionDir = process.env.SESSION_DIR || './data';
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: sessionDir }),
  secret: process.env.SESSION_SECRET || 'dev-only-secret-replace-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// --- Routes (public routes before any future auth gates) ---

// TV display — unauthenticated (auth boundary: CONTEXT.md + SKELETON.md)
app.get('/tv', (req, res) => res.sendFile(path.join(__dirname, '../public/tv.html')));

// Static files (serves public/index.html for GET /)
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/games', require('./routes/games'));

// --- Error middleware — LAST (Express 5: async errors auto-forwarded, no express-async-errors needed) ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
