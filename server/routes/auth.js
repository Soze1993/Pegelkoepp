'use strict';

const { Router } = require('express');
const bcrypt = require('bcryptjs');
const router = Router();

// POST /api/auth/login
// Verifies PIN against stored bcrypt hash, regenerates session to prevent fixation
router.post('/login', async (req, res) => {
  const { pin } = req.body || {};
  const hash = process.env.PIN_HASH;
  if (!pin || !hash) return res.status(400).json({ error: 'Bad request' });
  const ok = await bcrypt.compare(String(pin), hash);
  if (!ok) return res.status(401).json({ error: 'Falscher PIN' });
  // Regenerate session to prevent session fixation (RESEARCH.md Security Domain)
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.authenticated = true;
    req.session.save((saveErr) => {
      if (saveErr) return res.status(500).json({ error: 'Session error' });
      res.json({ ok: true });
    });
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/status
router.get('/status', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

module.exports = router;
