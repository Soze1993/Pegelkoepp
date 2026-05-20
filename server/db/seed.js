'use strict';

/**
 * Idempotent seed — inserts 12 placeholder Pegelköpp members.
 * Returns immediately if the players table is non-empty (Seed Guard Pattern).
 * Called explicitly from server.js on startup.
 *
 * @param {import('better-sqlite3').Database} db
 */
function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM players').get().n;
  if (count > 0) return; // already seeded — exit immediately

  const insert = db.prepare('INSERT INTO players (name, emoji) VALUES (?, ?)');

  // TODO: replace with actual Pegelköpp member names and emojis (Pegelköpp #2)
  const players = [
    { name: 'Anna',   emoji: '🌟' },
    { name: 'Ben',    emoji: '🔥' },
    { name: 'Clara',  emoji: '🎯' },
    { name: 'David',  emoji: '⚡' },
    { name: 'Eva',    emoji: '🌙' },
    { name: 'Felix',  emoji: '🦊' },
    { name: 'Greta',  emoji: '🌻' },
    { name: 'Henrik', emoji: '🐺' },
    { name: 'Ida',    emoji: '🌈' },
    { name: 'Jonas',  emoji: '🚀' },
    { name: 'Klara',  emoji: '🎵' },
    { name: 'Lukas',  emoji: '🎳' }
  ];

  const insertMany = db.transaction((rows) => {
    for (const p of rows) {
      insert.run(p.name, p.emoji);
    }
  });

  insertMany(players);
}

module.exports = seed;
