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
