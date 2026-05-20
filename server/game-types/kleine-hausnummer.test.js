'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const kleineHaus = require('./kleine-hausnummer');

const players2 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' }
];

// C1: Module shape
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof kleineHaus.id, 'string');
  assert.equal(typeof kleineHaus.name, 'string');
  assert.equal(typeof kleineHaus.initState, 'function');
  assert.equal(typeof kleineHaus.applyThrow, 'function');
  assert.equal(typeof kleineHaus.isFinished, 'function');
  assert.equal(typeof kleineHaus.getFinalResults, 'function');
});

// C2: initState returns unfinished state
test('C2: initState returns state where isFinished is false', () => {
  const state = kleineHaus.initState(players2);
  assert.equal(kleineHaus.isFinished(state), false);
});

// C3: applyThrow does not mutate input state
test('C3: applyThrow does not mutate input state', () => {
  const state = kleineHaus.initState(players2);
  const snapshot = JSON.parse(JSON.stringify(state));
  kleineHaus.applyThrow(state, 1, 5, { slot: 'h' });
  assert.deepEqual(state, snapshot);
});

// C4: Determinism
test('C4: two independent replays produce identical final states', () => {
  const throws = [
    { playerId: 1, value: 1, meta: { slot: 'h' } },
    { playerId: 2, value: 5, meta: { slot: 'h' } },
    { playerId: 1, value: 2, meta: { slot: 'z' } },
    { playerId: 2, value: 6, meta: { slot: 'z' } },
    { playerId: 1, value: 3, meta: { slot: 'e' } },
    { playerId: 2, value: 7, meta: { slot: 'e' } }
  ];
  let s1 = kleineHaus.initState(players2);
  let s2 = kleineHaus.initState(players2);
  for (const t of throws) {
    s1 = kleineHaus.applyThrow(s1, t.playerId, t.value, t.meta);
    s2 = kleineHaus.applyThrow(s2, t.playerId, t.value, t.meta);
  }
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults flags correct winner (lowest wins)
test('C5: getFinalResults flags the correct winner (lowest score wins)', () => {
  let state = kleineHaus.initState(players2);
  // P1: 1,2,3 => 123; P2: 5,6,7 => 567 — P1 wins
  const throws = [
    { playerId: 1, value: 1, meta: { slot: 'h' } },
    { playerId: 2, value: 5, meta: { slot: 'h' } },
    { playerId: 1, value: 2, meta: { slot: 'z' } },
    { playerId: 2, value: 6, meta: { slot: 'z' } },
    { playerId: 1, value: 3, meta: { slot: 'e' } },
    { playerId: 2, value: 7, meta: { slot: 'e' } }
  ];
  for (const t of throws) state = kleineHaus.applyThrow(state, t.playerId, t.value, t.meta);
  const results = kleineHaus.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).winner, true);
  assert.equal(results.find(r => r.playerId === 2).winner, false);
});

// K1: Pudel substitutes 9 in slot, increments pudel counter
test('K1: Pudel value=0 substitutes 9 into slot and increments pudel', () => {
  let state = kleineHaus.initState([{ id: 1, name: 'A', emoji: 'A' }]);
  state = kleineHaus.applyThrow(state, 1, 0, { slot: 'h' }); // Pudel -> 9
  const p = state.players.find(x => x.id === 1);
  assert.equal(p.slots.h, 9, 'Pudel substitutes 9 in h slot');
  assert.equal(p.pudel, 1, 'pudel counter incremented');
});

// K2: Lowest score wins; {h:1,z:2,e:3}=123 beats {h:5,z:6,e:7}=567
test('K2: lowest valid score wins; 123 beats 567', () => {
  let state = kleineHaus.initState(players2);
  const throws = [
    { playerId: 1, value: 1, meta: { slot: 'h' } },
    { playerId: 2, value: 5, meta: { slot: 'h' } },
    { playerId: 1, value: 2, meta: { slot: 'z' } },
    { playerId: 2, value: 6, meta: { slot: 'z' } },
    { playerId: 1, value: 3, meta: { slot: 'e' } },
    { playerId: 2, value: 7, meta: { slot: 'e' } }
  ];
  for (const t of throws) state = kleineHaus.applyThrow(state, t.playerId, t.value, t.meta);
  const results = kleineHaus.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).score, 123);
  assert.equal(results.find(r => r.playerId === 2).score, 567);
  assert.equal(results.find(r => r.playerId === 1).winner, true);
});

// K3: Full Pudel sweep -> 999; loses to any non-999 valid score
test('K3: full Pudel sweep gives 999; loses to non-999 player', () => {
  let state = kleineHaus.initState(players2);
  // P1 gets all Pudels -> 999; P2 gets 1,2,3 -> 123
  const throws = [
    { playerId: 1, value: 0, meta: { slot: 'h' } }, // Pudel -> 9
    { playerId: 2, value: 1, meta: { slot: 'h' } },
    { playerId: 1, value: 0, meta: { slot: 'z' } }, // Pudel -> 9
    { playerId: 2, value: 2, meta: { slot: 'z' } },
    { playerId: 1, value: 0, meta: { slot: 'e' } }, // Pudel -> 9
    { playerId: 2, value: 3, meta: { slot: 'e' } }
  ];
  for (const t of throws) state = kleineHaus.applyThrow(state, t.playerId, t.value, t.meta);
  const results = kleineHaus.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).score, 999);
  assert.equal(results.find(r => r.playerId === 2).score, 123);
  assert.equal(results.find(r => r.playerId === 2).winner, true, 'P2 wins with 123 < 999');
  assert.equal(results.find(r => r.playerId === 1).winner, false);
});
