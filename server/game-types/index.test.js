'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const gameTypes = require('./index');

// Generic players that satisfy all module requirements
const players = [
  { id: 1, name: 'A', emoji: 'A', team: 'X', role: 'fuchs' },
  { id: 2, name: 'B', emoji: 'B', team: 'O', role: 'jaeger' }
];

// KDA requires minimum 4 players (new DE engine, D-12)
const kdaPlayers = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' },
  { id: 3, name: 'C', emoji: 'C' },
  { id: 4, name: 'D', emoji: 'D' }
];

const EXPECTED_KEYS = [
  'viergewinnt', 'fuchsjagd', 'dreiVollen', 'grosseHaus',
  'kleineHaus', 'plusMinus', 'anker', 'kda', 'bilderkegel'
];

// I1: Exactly 9 keys
test('I1: gameTypes has exactly 9 keys with correct names', () => {
  const keys = Object.keys(gameTypes);
  assert.equal(keys.length, 9, 'Expected exactly 9 game type keys');
  for (const key of EXPECTED_KEYS) {
    assert.ok(key in gameTypes, `Missing key: ${key}`);
  }
  // No extra keys
  for (const key of keys) {
    assert.ok(EXPECTED_KEYS.includes(key), `Unexpected key: ${key}`);
  }
});

// I2: Each entry has correct shape
test('I2: each entry has string id, string name, and four functions', () => {
  for (const key of EXPECTED_KEYS) {
    const mod = gameTypes[key];
    assert.equal(typeof mod.id, 'string', `${key}.id must be string`);
    assert.equal(typeof mod.name, 'string', `${key}.name must be string`);
    assert.equal(typeof mod.initState, 'function', `${key}.initState must be function`);
    assert.equal(typeof mod.applyThrow, 'function', `${key}.applyThrow must be function`);
    assert.equal(typeof mod.isFinished, 'function', `${key}.isFinished must be function`);
    assert.equal(typeof mod.getFinalResults, 'function', `${key}.getFinalResults must be function`);
  }
});

// I3: Each module's id equals its index key
test('I3: each module id matches its index key', () => {
  for (const key of EXPECTED_KEYS) {
    assert.equal(
      gameTypes[key].id,
      key,
      `gameTypes.${key}.id should equal '${key}' but got '${gameTypes[key].id}'`
    );
  }
});

// I4: initState returns an unfinished state for all modules
test('I4: all modules can be initialized and return isFinished=false', () => {
  for (const key of EXPECTED_KEYS) {
    const mod = gameTypes[key];
    // kda requires min 4 players (new DE engine, D-12) and accepts optional config
    const initPlayers = key === 'kda' ? kdaPlayers : players;
    const config = key === 'kda' ? { seed: 'test' } : undefined;
    const state = config !== undefined ? mod.initState(initPlayers, config) : mod.initState(initPlayers);
    assert.equal(
      mod.isFinished(state),
      false,
      `${key}.isFinished(initState(players)) should be false`
    );
  }
});

// I5: applyThrow does not mutate its input state for all modules
test('I5: applyThrow does not mutate input state for all modules', () => {
  // Representative values per game type
  const throwValues = {
    'viergewinnt': { value: 4, meta: undefined },
    'fuchsjagd':   { value: 5, meta: undefined },
    'dreiVollen':  { value: 5, meta: undefined },
    'grosseHaus':  { value: 5, meta: { slot: 'h' } },
    'kleineHaus':  { value: 5, meta: { slot: 'h' } },
    'plusMinus':   { value: 5, meta: undefined },
    'anker':       { value: 5, meta: undefined },
    'kda':         { value: 1, meta: undefined }, // winnerId = first match p1.id
    'bilderkegel': { value: 5, meta: undefined }
  };

  for (const key of EXPECTED_KEYS) {
    const mod = gameTypes[key];
    // kda requires min 4 players (new DE engine, D-12)
    const initPlayers = key === 'kda' ? kdaPlayers : players;
    const config = key === 'kda' ? { seed: 'test' } : undefined;
    const state = config !== undefined ? mod.initState(initPlayers, config) : mod.initState(initPlayers);
    const snap = JSON.parse(JSON.stringify(state));

    const { value, meta } = throwValues[key];

    // Determine the correct playerId/matchId argument
    let firstArgId;
    if (key === 'kda') {
      // For new KDA DE engine: first arg is player_id of a player in an active bracket match
      const activeMatch = state.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
      const playerId = activeMatch ? activeMatch.p1.id : 1;
      mod.applyThrow(state, playerId, value);
    } else if (key === 'fuchsjagd') {
      // Fuchs has id=1 (role:fuchs player)
      mod.applyThrow(state, 1, value, meta);
    } else {
      mod.applyThrow(state, 1, value, meta);
    }

    assert.deepEqual(
      state,
      snap,
      `${key}.applyThrow must not mutate input state`
    );
  }
});
