'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const grosseHaus = require('./grosse-hausnummer');

const players2 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' }
];

// C1: Module shape
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof grosseHaus.id, 'string');
  assert.equal(typeof grosseHaus.name, 'string');
  assert.equal(typeof grosseHaus.initState, 'function');
  assert.equal(typeof grosseHaus.applyThrow, 'function');
  assert.equal(typeof grosseHaus.isFinished, 'function');
  assert.equal(typeof grosseHaus.getFinalResults, 'function');
});

// C2: initState returns unfinished state
test('C2: initState returns state where isFinished is false', () => {
  const state = grosseHaus.initState(players2);
  assert.equal(grosseHaus.isFinished(state), false);
});

// C3: applyThrow does not mutate input state
test('C3: applyThrow does not mutate input state', () => {
  const state = grosseHaus.initState(players2);
  const snapshot = JSON.parse(JSON.stringify(state));
  grosseHaus.applyThrow(state, 1, 5, { slot: 'h' });
  assert.deepEqual(state, snapshot);
});

// C4: Determinism
test('C4: two independent replays produce identical final states', () => {
  const throws = [
    { playerId: 1, value: 5, meta: { slot: 'h' } },
    { playerId: 2, value: 4, meta: { slot: 'h' } },
    { playerId: 1, value: 3, meta: { slot: 'z' } },
    { playerId: 2, value: 9, meta: { slot: 'z' } },
    { playerId: 1, value: 2, meta: { slot: 'e' } },
    { playerId: 2, value: 1, meta: { slot: 'e' } }
  ];
  let s1 = grosseHaus.initState(players2);
  let s2 = grosseHaus.initState(players2);
  for (const t of throws) {
    s1 = grosseHaus.applyThrow(s1, t.playerId, t.value, t.meta);
    s2 = grosseHaus.applyThrow(s2, t.playerId, t.value, t.meta);
  }
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults flags correct winner
test('C5: getFinalResults flags the correct winner (532 > 491)', () => {
  let state = grosseHaus.initState(players2);
  // P1: h=5, z=3, e=2 => 532; P2: h=4, z=9, e=1 => 491
  const throws = [
    { playerId: 1, value: 5, meta: { slot: 'h' } },
    { playerId: 2, value: 4, meta: { slot: 'h' } },
    { playerId: 1, value: 3, meta: { slot: 'z' } },
    { playerId: 2, value: 9, meta: { slot: 'z' } },
    { playerId: 1, value: 2, meta: { slot: 'e' } },
    { playerId: 2, value: 1, meta: { slot: 'e' } }
  ];
  for (const t of throws) {
    state = grosseHaus.applyThrow(state, t.playerId, t.value, t.meta);
  }
  const results = grosseHaus.getFinalResults(state);
  const p1 = results.find(r => r.playerId === 1);
  const p2 = results.find(r => r.playerId === 2);
  assert.equal(p1.winner, true);
  assert.equal(p2.winner, false);
});

// G1: Round-robin rotation per slot
test('G1: Players rotate one throw per round (round-robin per slot)', () => {
  let state = grosseHaus.initState(players2);
  assert.equal(state.aktSpIdx, 0);
  state = grosseHaus.applyThrow(state, 1, 5, { slot: 'h' });
  assert.equal(state.aktSpIdx, 1, 'after p1 h throw, aktSpIdx = 1');
  state = grosseHaus.applyThrow(state, 2, 7, { slot: 'h' });
  // After both players did 'h', aktSpIdx wraps back to 0
  assert.equal(state.aktSpIdx, 0, 'after p2 h throw, wraps to 0');
});

// G2: Score = h*100 + z*10 + e; 532 beats 491
test('G2: score = h*100+z*10+e; highest wins', () => {
  let state = grosseHaus.initState(players2);
  const throws = [
    { playerId: 1, value: 5, meta: { slot: 'h' } },
    { playerId: 2, value: 4, meta: { slot: 'h' } },
    { playerId: 1, value: 3, meta: { slot: 'z' } },
    { playerId: 2, value: 9, meta: { slot: 'z' } },
    { playerId: 1, value: 2, meta: { slot: 'e' } },
    { playerId: 2, value: 1, meta: { slot: 'e' } }
  ];
  for (const t of throws) state = grosseHaus.applyThrow(state, t.playerId, t.value, t.meta);
  const results = grosseHaus.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).score, 532);
  assert.equal(results.find(r => r.playerId === 2).score, 491);
  assert.equal(results.find(r => r.playerId === 1).winner, true);
});

// G3: Pudel=0 stored as 0, pudel counter incremented; h=0,z=5,e=5 => 55
test('G3: Pudel=0 stores 0 in slot and increments pudel counter', () => {
  let state = grosseHaus.initState([{ id: 1, name: 'A', emoji: 'A' }]);
  state = grosseHaus.applyThrow(state, 1, 0, { slot: 'h' }); // Pudel
  state = grosseHaus.applyThrow(state, 1, 5, { slot: 'z' });
  state = grosseHaus.applyThrow(state, 1, 5, { slot: 'e' });
  const p = state.players.find(x => x.id === 1);
  assert.equal(p.slots.h, 0);
  assert.equal(p.pudel, 1);
  const results = grosseHaus.getFinalResults(state);
  assert.equal(results[0].score, 55); // 0*100 + 5*10 + 5 = 55
});

// G4: applyThrow with missing/invalid meta.slot returns state unchanged
test('G4: applyThrow with missing meta.slot returns state unchanged', () => {
  let state = grosseHaus.initState(players2);
  const snapshot = JSON.parse(JSON.stringify(state));
  const newState = grosseHaus.applyThrow(state, 1, 5, {}); // no slot
  assert.deepEqual(newState, snapshot);
  const newState2 = grosseHaus.applyThrow(state, 1, 5); // no meta at all
  assert.deepEqual(newState2, snapshot);
});
