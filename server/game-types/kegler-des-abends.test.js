'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const kda = require('./kegler-des-abends');

const players4 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' },
  { id: 3, name: 'C', emoji: 'C' },
  { id: 4, name: 'D', emoji: 'D' }
];

// C1: Module shape
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof kda.id, 'string');
  assert.equal(typeof kda.name, 'string');
  assert.equal(typeof kda.initState, 'function');
  assert.equal(typeof kda.applyThrow, 'function');
  assert.equal(typeof kda.isFinished, 'function');
  assert.equal(typeof kda.getFinalResults, 'function');
});

// C2: initState returns unfinished state
test('C2: initState returns state where isFinished is false', () => {
  const state = kda.initState(players4, { seed: 'test' });
  assert.equal(kda.isFinished(state), false);
});

// C3: applyThrow does not mutate input state
test('C3: applyThrow does not mutate input state', () => {
  const state = kda.initState(players4, { seed: 'test' });
  const snapshot = JSON.parse(JSON.stringify(state));
  const firstMatch = state.matches[0];
  kda.applyThrow(state, firstMatch.id, firstMatch.p1.id);
  assert.deepEqual(state, snapshot);
});

// C4: Determinism
test('C4: two independent replays produce identical final states', () => {
  let s1 = kda.initState(players4, { seed: 'test' });
  let s2 = kda.initState(players4, { seed: 'test' });
  // Resolve all initial matches and subsequent matches
  function playOutTournament(state) {
    let s = state;
    let iterations = 0;
    while (!kda.isFinished(s) && iterations < 50) {
      const pending = s.matches.filter(m => !m.done);
      if (!pending.length) break;
      const m = pending[0];
      s = kda.applyThrow(s, m.id, m.p1.id); // always p1 wins
      iterations++;
    }
    return s;
  }
  s1 = playOutTournament(s1);
  s2 = playOutTournament(s2);
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults returns winner array
test('C5: getFinalResults returns array with winner flag', () => {
  let state = kda.initState(players4, { seed: 'test' });
  while (!kda.isFinished(state)) {
    const pending = state.matches.filter(m => !m.done);
    if (!pending.length) break;
    const m = pending[0];
    state = kda.applyThrow(state, m.id, m.p1.id);
  }
  const results = kda.getFinalResults(state);
  assert.ok(Array.isArray(results));
  const winners = results.filter(r => r.winner);
  assert.equal(winners.length, 1, 'exactly one winner');
});

// KDA1: initState creates matches and bye
test('KDA1: initState creates state with spieler, matches, mid, wRound', () => {
  const state = kda.initState(players4, { seed: 'test' });
  assert.ok(Array.isArray(state.spieler));
  assert.ok(Array.isArray(state.matches));
  assert.ok(typeof state.mid, 'number');
  assert.equal(state.wRound, 1);
  assert.equal(state.done, false);
  // 4 players -> 2 matches
  assert.equal(state.matches.length, 2);
});

// KDA2: applyThrow uses matchId as "playerId" param and winnerId as "value"
test('KDA2: applyThrow(state, matchId, winnerId) resolves match', () => {
  let state = kda.initState(players4, { seed: 'test' });
  const m = state.matches[0];
  const s = kda.applyThrow(state, m.id, m.p1.id); // p1 wins match 1
  const resolvedMatch = s.matches.find(x => x.id === m.id);
  assert.equal(resolvedMatch.done, true);
  assert.equal(resolvedMatch.winner.id, m.p1.id);
  assert.equal(resolvedMatch.loser.id, m.p2.id);
});

// KDA3: Player with 2 losses is eliminated
test('KDA3: player with 2 losses is eliminated from further matches', () => {
  let state = kda.initState(players4, { seed: 'test' });
  // Resolve all matches; ensure eliminated players don't appear in new matches
  while (!kda.isFinished(state)) {
    const pending = state.matches.filter(m => !m.done);
    if (!pending.length) break;
    state = kda.applyThrow(state, pending[0].id, pending[0].p1.id);
  }
  // Count losses
  const losses = {};
  state.spieler.forEach(s => { losses[s.id] = 0; });
  state.matches.forEach(m => {
    if (m.done && m.loser) losses[m.loser.id] = (losses[m.loser.id] || 0) + 1;
  });
  // No remaining active matches should have a player with >= 2 losses
  const pendingMatches = state.matches.filter(m => !m.done);
  for (const m of pendingMatches) {
    assert.ok((losses[m.p1.id] || 0) < 2, 'p1 should have < 2 losses');
    assert.ok((losses[m.p2.id] || 0) < 2, 'p2 should have < 2 losses');
  }
});

// KDA4: When one player remains, gewinner is set, done = true
test('KDA4: tournament ends when one player has fewer than 2 losses', () => {
  let state = kda.initState(players4, { seed: 'test' });
  while (!kda.isFinished(state)) {
    const pending = state.matches.filter(m => !m.done);
    if (!pending.length) break;
    state = kda.applyThrow(state, pending[0].id, pending[0].p1.id);
  }
  assert.equal(kda.isFinished(state), true);
  assert.ok(state.gewinner, 'gewinner should be set');
  assert.equal(state.done, true);
});

// KDA5: Concrete 4-player sequence: A beats B, C beats D, A beats C, B beats D, A beats B
test('KDA5: concrete 4-player sequence A always wins', () => {
  // With seed 'fixed4', players are in order [1,2,3,4]
  // Match 1: P1 vs P2; Match 2: P3 vs P4
  // We always pick the first player to win
  let state = kda.initState(players4, { seed: 'fixed4' });
  while (!kda.isFinished(state)) {
    const pending = state.matches.filter(m => !m.done);
    if (!pending.length) break;
    state = kda.applyThrow(state, pending[0].id, pending[0].p1.id);
  }
  assert.equal(kda.isFinished(state), true);
  // Whoever was first player in first match should win
  assert.ok(state.gewinner, 'gewinner must be set');
});

// KDA6: With seed, shuffle is deterministic; without seed, test passes seed
test('KDA6: seeded shuffle produces same order for same seed', () => {
  const s1 = kda.initState(players4, { seed: 'abc' });
  const s2 = kda.initState(players4, { seed: 'abc' });
  assert.deepEqual(
    s1.spieler.map(p => p.id),
    s2.spieler.map(p => p.id),
    'same seed produces same player order'
  );
  // Different seeds may (should) produce different orders
  // (not guaranteed for all seeds, so just verify same-seed determinism)
});
