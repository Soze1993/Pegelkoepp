'use strict';

/**
 * requireSession — Express middleware.
 * Returns 401 if no authenticated session exists.
 * Used to guard all write routes (POST, PUT) in the API.
 */
function requireSession(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = requireSession;
