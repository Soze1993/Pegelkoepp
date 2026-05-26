'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolated tmp DB dir — MUST be set before requiring ../db/index
let tmpDir;
let dbCounter = 0;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pegel-test-'));
  // Set initial DB_PATH — each freshDb() will switch to a new file
  process.env.DB_PATH = path.join(tmpDir, `test-${dbCounter}.db`);
});

after(() => {
  // Clean up require cache
  try {
    delete require.cache[require.resolve('./index')];
    delete require.cache[require.resolve('./seed')];
  } catch (_) {}
  // Clean up tmp dir
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}
});

/**
 * Get a fresh DB instance with a fresh SQLite file.
 * Each call uses a unique file path to avoid shared state between tests.
 */
function freshDb() {
  dbCounter++;
  const dbPath = path.join(tmpDir, `test-${dbCounter}.db`);
  process.env.DB_PATH = dbPath;
  delete require.cache[require.resolve('./index')];
  return require('./index');
}

// ---------------------------------------------------------------------------
// Test 1: WAL journal mode
// ---------------------------------------------------------------------------
test('DB sets journal_mode to WAL', () => {
  const db = freshDb();
  const mode = db.pragma('journal_mode', { simple: true });
  assert.equal(mode.toLowerCase(), 'wal', `Expected journal_mode=wal, got: ${mode}`);
});

// ---------------------------------------------------------------------------
// Test 2: foreign_keys ON
// ---------------------------------------------------------------------------
test('DB sets foreign_keys ON', () => {
  const db = freshDb();
  const fk = db.pragma('foreign_keys', { simple: true });
  assert.equal(fk, 1, `Expected foreign_keys=1, got: ${fk}`);
});

// ---------------------------------------------------------------------------
// Test 3: All 7 tables exist (excluding SQLite internal tables like sqlite_sequence)
// Phase 4 added: abende table (via migrations array)
// Quick 260526-wvg added: feedback table
// ---------------------------------------------------------------------------
test('All 7 tables exist after init', () => {
  const db = freshDb();
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map(r => r.name);
  const expected = ['abende', 'feedback', 'game_players', 'game_type_defs', 'games', 'players', 'throws'];
  for (const t of expected) {
    assert.ok(tables.includes(t), `Missing table: ${t} (found: ${tables.join(', ')})`);
  }
  assert.equal(tables.length, 7, `Expected 7 tables, found ${tables.length}: ${tables.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Test 4: UNIQUE constraint on throws (game_id, player_id, throw_index)
// ---------------------------------------------------------------------------
test('throws table has UNIQUE constraint on (game_id, player_id, throw_index)', () => {
  const db = freshDb();

  // Insert a game and player to satisfy FK constraints
  db.prepare("INSERT INTO games (type_key) VALUES ('test')").run();
  db.prepare("INSERT INTO players (name, emoji) VALUES ('TestPlayer', '🎳')").run();
  const gameId = db.prepare("SELECT id FROM games WHERE type_key='test'").get().id;
  const playerId = db.prepare("SELECT id FROM players WHERE name='TestPlayer'").get().id;

  // Insert first throw — should succeed
  db.prepare(
    'INSERT INTO throws (game_id, player_id, throw_index, value) VALUES (?, ?, ?, ?)'
  ).run(gameId, playerId, 0, 5);

  // Insert duplicate — must throw with UNIQUE in message
  assert.throws(
    () => {
      db.prepare(
        'INSERT INTO throws (game_id, player_id, throw_index, value) VALUES (?, ?, ?, ?)'
      ).run(gameId, playerId, 0, 7);
    },
    (err) => {
      assert.ok(
        err.message.toUpperCase().includes('UNIQUE'),
        `Expected UNIQUE error, got: ${err.message}`
      );
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// Test 5: seed() inserts exactly 12 players on first call
// ---------------------------------------------------------------------------
test('seed() inserts exactly 12 players on first call', () => {
  const db = freshDb();
  // Fresh cache for seed too
  delete require.cache[require.resolve('./seed')];
  const seed = require('./seed');

  // Ensure players table is empty
  const before = db.prepare('SELECT COUNT(*) as n FROM players').get().n;
  assert.equal(before, 0, `Expected 0 players before seed, got ${before}`);

  seed(db);

  const after = db.prepare('SELECT COUNT(*) as n FROM players').get().n;
  assert.equal(after, 12, `Expected 12 players after seed, got ${after}`);
});

// ---------------------------------------------------------------------------
// Test 6: seed() is idempotent — calling twice does not duplicate
// ---------------------------------------------------------------------------
test('seed() is idempotent — calling twice does not add duplicates', () => {
  const db = freshDb();
  delete require.cache[require.resolve('./seed')];
  const seed = require('./seed');

  seed(db);
  seed(db); // second call must be a no-op

  const count = db.prepare('SELECT COUNT(*) as n FROM players').get().n;
  assert.equal(count, 12, `Expected 12 players after double seed, got ${count}`);
});

// ---------------------------------------------------------------------------
// Test 7: All seeded players have non-empty name, emoji, and archived=0
// ---------------------------------------------------------------------------
test('All seeded players have non-empty name, emoji and archived=0', () => {
  const db = freshDb();
  delete require.cache[require.resolve('./seed')];
  const seed = require('./seed');

  seed(db);

  const players = db.prepare('SELECT name, emoji, archived FROM players').all();
  for (const p of players) {
    assert.ok(p.name && p.name.length > 0, `Player has empty name: ${JSON.stringify(p)}`);
    assert.ok(p.emoji && p.emoji.length > 0, `Player has empty emoji: ${JSON.stringify(p)}`);
    assert.equal(p.archived, 0, `Player should not be archived: ${JSON.stringify(p)}`);
  }
});

// ---------------------------------------------------------------------------
// Test 8: Tests use an isolated DB path — real DB is never touched
// ---------------------------------------------------------------------------
test('Tests use isolated tmp DB path, not data/kegelclub.db', () => {
  const dbPath = process.env.DB_PATH;
  assert.ok(dbPath, 'DB_PATH env var must be set');
  assert.ok(!dbPath.includes('kegelclub'), `DB_PATH must not reference kegelclub.db, got: ${dbPath}`);
  assert.ok(
    dbPath.includes('pegel-test-') || dbPath.includes('test-'),
    `DB_PATH should be in tmp dir, got: ${dbPath}`
  );
});

// ---------------------------------------------------------------------------
// DB05: throws table has meta column and game_players has role column after migration
//        Status: RED — Wave 1 (plan 02-02) adds ALTER TABLE migration in db/index.js
// ---------------------------------------------------------------------------
test('DB05: throws table has meta column and game_players has role column after migration', () => {
  const db = freshDb();

  // Assert throws.meta column exists (added by Phase 2 migration — D-12, D-13)
  const throwsCols = db.prepare('PRAGMA table_info(throws)').all();
  const hasMeta = throwsCols.some(c => c.name === 'meta');
  assert.ok(hasMeta, 'Wave 1 migration not yet implemented: throws table is missing meta column');

  // Assert game_players.role column exists (added by Phase 2 migration — D-13)
  const gpCols = db.prepare('PRAGMA table_info(game_players)').all();
  const hasRole = gpCols.some(c => c.name === 'role');
  assert.ok(hasRole, 'Wave 1 migration not yet implemented: game_players table is missing role column');
});

// ---------------------------------------------------------------------------
// DB06: migrations are idempotent — re-requiring db/index.js (which runs migrations)
//        twice does not throw, and the meta column exists after both requires.
//        Status: RED — Wave 1 (plan 02-02) adds idempotent ALTER TABLE block in db/index.js.
//        Until Wave 1: throws.meta column does not exist so the assertion fails (RED).
// ---------------------------------------------------------------------------
test('DB06: migrations are idempotent — re-requiring db/index does not throw and meta column persists', () => {
  // Require db/index once — this runs schema + any migration block
  dbCounter++;
  const dbPath = path.join(tmpDir, `test-${dbCounter}.db`);
  process.env.DB_PATH = dbPath;
  delete require.cache[require.resolve('./index')];
  const db1 = require('./index');

  // Require again with the SAME DB_PATH — migrations must be idempotent (no throw)
  delete require.cache[require.resolve('./index')];
  let db2;
  try {
    db2 = require('./index');
  } catch (e) {
    assert.fail(`Wave 1 migration not yet implemented: second require of db/index threw: ${e.message}`);
  }

  // After Wave 1: throws.meta column must exist (migration ran on first require)
  const throwsCols = db2.prepare('PRAGMA table_info(throws)').all();
  const hasMeta = throwsCols.some(c => c.name === 'meta');
  assert.ok(hasMeta, 'Wave 1 migration not yet implemented: throws.meta column missing after idempotent re-require');
});
