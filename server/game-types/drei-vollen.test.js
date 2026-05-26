'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dreiVollen = require('./drei-vollen');

const players2 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' }
];

// C1: Module shape
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof dreiVollen.id, 'string');
  assert.equal(typeof dreiVollen.name, 'string');
  assert.equal(typeof dreiVollen.initState, 'function');
  assert.equal(typeof dreiVollen.applyThrow, 'function');
  assert.equal(typeof dreiVollen.isFinished, 'function');
  assert.equal(typeof dreiVollen.getFinalResults, 'function');
});

// C2: initState returns unfinished state
test('C2: initState returns state where isFinished is false', () => {
  const state = dreiVollen.initState(players2);
  assert.equal(dreiVollen.isFinished(state), false);
});

// C3: applyThrow does not mutate input state
test('C3: applyThrow does not mutate input state', () => {
  const state = dreiVollen.initState(players2);
  const snapshot = JSON.parse(JSON.stringify(state));
  dreiVollen.applyThrow(state, 1, 5);
  assert.deepEqual(state, snapshot);
});

// C4: Determinism - two independent replays produce identical results
test('C4: two independent replays produce identical final states', () => {
  const throws = [
    { playerId: 1, value: 5 },
    { playerId: 1, value: 3 },
    { playerId: 1, value: 2 },
    { playerId: 2, value: 4 },
    { playerId: 2, value: 4 },
    { playerId: 2, value: 1 }
  ];
  let s1 = dreiVollen.initState(players2);
  let s2 = dreiVollen.initState(players2);
  for (const t of throws) {
    s1 = dreiVollen.applyThrow(s1, t.playerId, t.value);
    s2 = dreiVollen.applyThrow(s2, t.playerId, t.value);
  }
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults flags correct winner
test('C5: getFinalResults flags the correct winner', () => {
  let state = dreiVollen.initState(players2);
  // Player 1: 5+3+2 = 10, Player 2: 4+4+1 = 9
  for (const [pid, val] of [[1,5],[1,3],[1,2],[2,4],[2,4],[2,1]]) {
    state = dreiVollen.applyThrow(state, pid, val);
  }
  const results = dreiVollen.getFinalResults(state);
  const p1 = results.find(r => r.playerId === 1);
  const p2 = results.find(r => r.playerId === 2);
  assert.equal(p1.winner, true);
  assert.equal(p2.winner, false);
});

// D1: Player throws [5,3,2] wins over [4,4,1], isFinished only after last throw
test('D1: first player wins 10 vs 9; isFinished only after all throws', () => {
  let state = dreiVollen.initState(players2);
  // Player 1 throws
  state = dreiVollen.applyThrow(state, 1, 5);
  state = dreiVollen.applyThrow(state, 1, 3);
  state = dreiVollen.applyThrow(state, 1, 2);
  assert.equal(dreiVollen.isFinished(state), false, 'Not finished after first player');
  // Player 2 throws
  state = dreiVollen.applyThrow(state, 2, 4);
  state = dreiVollen.applyThrow(state, 2, 4);
  assert.equal(dreiVollen.isFinished(state), false, 'Not finished after 2 of 3 throws');
  state = dreiVollen.applyThrow(state, 2, 1);
  assert.equal(dreiVollen.isFinished(state), true, 'Finished after all throws');
  const results = dreiVollen.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).winner, true);
});

// D2: Pudel increments count and contributes 0
test('D2: Pudel value=0 increments pudel count, contributes 0 to sum', () => {
  let state = dreiVollen.initState([{ id: 1, name: 'A', emoji: 'A' }]);
  state = dreiVollen.applyThrow(state, 1, 0); // Pudel
  state = dreiVollen.applyThrow(state, 1, 5);
  state = dreiVollen.applyThrow(state, 1, 3);
  const p = state.players.find(x => x.id === 1);
  assert.equal(p.pudel, 1);
  assert.equal(p.wuerfe.reduce((a,b) => a+b, 0), 8);
});

// D3: wuerfe array grows per throw; advance after length >= 3
test('D3: wuerfe grows 1 per throw; player advances only after 3rd throw', () => {
  let state = dreiVollen.initState(players2);
  state = dreiVollen.applyThrow(state, 1, 5);
  assert.equal(state.players.find(p => p.id === 1).wuerfe.length, 1);
  assert.equal(state.aktSpIdx, 0, 'Still player 1 after 1 throw');
  state = dreiVollen.applyThrow(state, 1, 3);
  assert.equal(state.aktSpIdx, 0, 'Still player 1 after 2 throws');
  state = dreiVollen.applyThrow(state, 1, 2);
  assert.equal(state.aktSpIdx, 1, 'Advances to player 2 after 3 throws');
});

// DV1: initState returns unfinished state
test('DV1: initState returns unfinished state', () => {
  const s = dreiVollen.initState(players2);
  assert.equal(dreiVollen.isFinished(s), false);
  assert.equal(s.stechen, false);
});

// DV2: tie triggers stechen state
test('DV2: tie triggers stechen state', () => {
  let s = dreiVollen.initState(players2);
  // Both players score 15
  s = dreiVollen.applyThrow(s, 1, 5); s = dreiVollen.applyThrow(s, 1, 5); s = dreiVollen.applyThrow(s, 1, 5);
  s = dreiVollen.applyThrow(s, 2, 5); s = dreiVollen.applyThrow(s, 2, 5); s = dreiVollen.applyThrow(s, 2, 5);
  assert.equal(s.done, false, 'not done on tie');
  assert.equal(s.stechen, true, 'stechen flag set');
  assert.deepEqual(s.stechenPlayers.sort(), [1, 2]);
});

// DV3: applyThrow does not mutate input
test('DV3: applyThrow does not mutate input', () => {
  const s = dreiVollen.initState(players2);
  const snap = JSON.parse(JSON.stringify(s));
  dreiVollen.applyThrow(s, 1, 5);
  assert.deepEqual(s, snap);
});

// DreiVollen Turnier-Rekord top6Sum

// Helper: drive a dreiVollen game with N players, each with specified scores as 3 throws (v, v, v) split
function playDVGame(playerScores) {
  // playerScores: [{id, score}, ...] where score is total (split evenly across 3 throws)
  const players = playerScores.map(({ id }, i) => ({ id, name: 'P' + id, emoji: String(id) }));
  let state = dreiVollen.initState(players);
  for (const { id, score } of playerScores) {
    // distribute score across 3 throws (integer; last absorbs remainder)
    const base = Math.floor(score / 3);
    const rem = score - base * 2;
    state = dreiVollen.applyThrow(state, id, base);
    state = dreiVollen.applyThrow(state, id, base);
    state = dreiVollen.applyThrow(state, id, rem);
  }
  // resolve stechen if needed (skip it for top6Sum tests — winner doesn't affect top6Sum)
  if (state.stechen) {
    state = dreiVollen.skipStechen(state);
  }
  return state;
}

// T6-1: 6 players → top6Sum = sum of all 6 (exactly 6 players)
test('T6-1: getFinalResults with 6 players — top6Sum = sum of all 6 scores', () => {
  const scores = [15, 12, 18, 9, 21, 6]; // sum = 81
  const ps = scores.map((score, i) => ({ id: i + 1, score }));
  const state = playDVGame(ps);
  const results = dreiVollen.getFinalResults(state);
  const expected = scores.reduce((a, b) => a + b, 0);
  assert.ok(results[0].top6Sum !== undefined, 'top6Sum should be present with 6 players');
  assert.equal(results[0].top6Sum, expected, `top6Sum should be ${expected}`);
  // All entries must have the same top6Sum
  assert.ok(results.every(r => r.top6Sum === expected), 'All result entries must have same top6Sum');
});

// T6-2: 7 players → top6Sum = sum of top 6 only (excludes lowest scorer)
test('T6-2: getFinalResults with 7 players — top6Sum = sum of top 6 (not all 7)', () => {
  // Scores: [20, 18, 16, 14, 12, 10, 2] → top 6 sum = 90; all 7 = 92
  const allScores = [20, 18, 16, 14, 12, 10, 2];
  const ps = allScores.map((score, i) => ({ id: i + 1, score }));
  const state = playDVGame(ps);
  const results = dreiVollen.getFinalResults(state);
  const top6 = allScores.slice().sort((a, b) => b - a).slice(0, 6).reduce((a, b) => a + b, 0);
  assert.ok(results[0].top6Sum !== undefined, 'top6Sum should be present with 7 players');
  assert.equal(results[0].top6Sum, top6, `top6Sum should be ${top6} (top 6 only, not all 7)`);
});

// T6-3: 5 players → top6Sum is absent (field undefined)
test('T6-3: getFinalResults with 5 players — top6Sum is undefined on all results', () => {
  const ps = [10, 12, 8, 15, 9].map((score, i) => ({ id: i + 1, score }));
  const state = playDVGame(ps);
  const results = dreiVollen.getFinalResults(state);
  assert.ok(results.every(r => r.top6Sum === undefined), 'top6Sum must be absent with 5 players');
});

// T6-4: 6 players with stechenSkipped → top6Sum still present
test('T6-4: getFinalResults with 6 players stechenSkipped — top6Sum still present', () => {
  // All 6 players with the same score will trigger stechen → we skip it
  const ps = [15, 15, 12, 10, 8, 5].map((score, i) => ({ id: i + 1, score }));
  const state = playDVGame(ps);
  // playDVGame calls skipStechen if stechen is active; state should be done
  assert.equal(state.done, true);
  const results = dreiVollen.getFinalResults(state);
  const allScores = ps.map(p => p.score);
  const expected = allScores.slice().sort((a, b) => b - a).slice(0, 6).reduce((a, b) => a + b, 0);
  assert.ok(results[0].top6Sum !== undefined, 'top6Sum should be present even with stechenSkipped');
  assert.equal(results[0].top6Sum, expected);
});

// DV4: skipStechen marks done and no winner
test('DV4: skipStechen marks done and no winner', () => {
  let s = dreiVollen.initState(players2);
  s = dreiVollen.applyThrow(s, 1, 5); s = dreiVollen.applyThrow(s, 1, 5); s = dreiVollen.applyThrow(s, 1, 5);
  s = dreiVollen.applyThrow(s, 2, 5); s = dreiVollen.applyThrow(s, 2, 5); s = dreiVollen.applyThrow(s, 2, 5);
  s = dreiVollen.skipStechen(s);
  assert.equal(s.done, true);
  const results = dreiVollen.getFinalResults(s);
  assert.ok(results.every(r => r.winner === false), 'no winner when skipped');
});
