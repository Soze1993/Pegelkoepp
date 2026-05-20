'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const anker = require('./anker');

const players2 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' }
];

// C1: Module shape
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof anker.id, 'string');
  assert.equal(typeof anker.name, 'string');
  assert.equal(typeof anker.initState, 'function');
  assert.equal(typeof anker.applyThrow, 'function');
  assert.equal(typeof anker.isFinished, 'function');
  assert.equal(typeof anker.getFinalResults, 'function');
});

// C2: initState returns unfinished state
test('C2: initState returns state where isFinished is false', () => {
  const state = anker.initState(players2);
  assert.equal(anker.isFinished(state), false);
});

// C3: applyThrow does not mutate input state
test('C3: applyThrow does not mutate input state', () => {
  const state = anker.initState(players2);
  const snapshot = JSON.parse(JSON.stringify(state));
  anker.applyThrow(state, 1, 5);
  assert.deepEqual(state, snapshot);
});

// C4: Determinism
test('C4: two independent replays produce identical final states', () => {
  const throws = [
    { playerId: 1, value: 10 }, { playerId: 1, value: 10 },
    { playerId: 1, value: 10 }, { playerId: 1, value: 10 },
    { playerId: 2, value: 5 }, { playerId: 2, value: 5 },
    { playerId: 2, value: 5 }, { playerId: 2, value: 5 }, { playerId: 2, value: 5 }
  ];
  let s1 = anker.initState(players2, { maxRunden: 1 });
  let s2 = anker.initState(players2, { maxRunden: 1 });
  for (const t of throws) {
    s1 = anker.applyThrow(s1, t.playerId, t.value);
    s2 = anker.applyThrow(s2, t.playerId, t.value);
  }
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults flags correct winner
test('C5: getFinalResults flags the correct winner', () => {
  let state = anker.initState(players2, { maxRunden: 1 });
  // P1 round: [10,10,10,10] = 40 (ends early)
  // P2 round: [5,5,5,5,5] = 25
  const throws1 = [10, 10, 10, 10];
  const throws2 = [5, 5, 5, 5, 5];
  for (const v of throws1) state = anker.applyThrow(state, 1, v);
  for (const v of throws2) state = anker.applyThrow(state, 2, v);
  const results = anker.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).winner, true);
  assert.equal(results.find(r => r.playerId === 2).winner, false);
});

// A1: initState accepts config; default maxRunden is 3
test('A1: initState accepts config.maxRunden; default is 3', () => {
  const state2 = anker.initState(players2, { maxRunden: 2 });
  assert.equal(state2.maxRunden, 2);
  const stateDefault = anker.initState(players2);
  assert.equal(stateDefault.maxRunden, 3);
});

// A2: Round ends early at cumulative >= 40
test('A2: round ends when cumulative round points >= 40', () => {
  let state = anker.initState([{ id: 1, name: 'A', emoji: 'A' }], { maxRunden: 1 });
  // Throw 10+10+10+10 = 40 => round ends on 4th throw
  state = anker.applyThrow(state, 1, 10);
  state = anker.applyThrow(state, 1, 10);
  state = anker.applyThrow(state, 1, 10);
  assert.equal(anker.isFinished(state), false, 'Not finished after 30 pts');
  state = anker.applyThrow(state, 1, 10);
  assert.equal(anker.isFinished(state), true, 'Finished after 40 pts hits');
});

// A3: value=0 increments pudel, contributes 0
test('A3: value=0 increments pudel and contributes 0 points', () => {
  let state = anker.initState([{ id: 1, name: 'A', emoji: 'A' }], { maxRunden: 1 });
  state = anker.applyThrow(state, 1, 0); // Pudel
  const p = state.players.find(x => x.id === 1);
  assert.equal(p.pudel, 1);
  assert.equal(p.runden[0][0], 0);
});

// A4: [10,10,10,10] = 40 pts -> round ends on 4th throw (no 5th needed)
test('A4: four 10-point throws (40 pts) ends round without 5th throw', () => {
  let state = anker.initState([{ id: 1, name: 'A', emoji: 'A' }], { maxRunden: 1 });
  for (const v of [10, 10, 10, 10]) state = anker.applyThrow(state, 1, v);
  assert.equal(anker.isFinished(state), true);
  const p = state.players.find(x => x.id === 1);
  assert.equal(p.runden[0].length, 4, 'Only 4 throws recorded');
});

// A5: After all players play all maxRunden, isFinished returns true
test('A5: isFinished returns true after all players complete all rounds', () => {
  let state = anker.initState(players2, { maxRunden: 2 });
  // Each player needs to complete 2 rounds (at most 5 throws each)
  // Use 5 throws per round per player
  const doRound = (st, pid) => {
    for (let i = 0; i < 5; i++) st = anker.applyThrow(st, pid, 1);
    return st;
  };
  // Round 1
  state = doRound(state, 1);
  assert.equal(anker.isFinished(state), false);
  state = doRound(state, 2);
  assert.equal(anker.isFinished(state), false);
  // Round 2
  state = doRound(state, 1);
  state = doRound(state, 2);
  assert.equal(anker.isFinished(state), true);
});

// A6: getFinalResults sums runden arrays; highest total wins
test('A6: getFinalResults sums runden across rounds; highest total wins', () => {
  let state = anker.initState(players2, { maxRunden: 2 });
  // P1: round1=[10,10,10,10]=40, round2=[5,5,5,5,5]=25 => total=65
  // P2: round1=[1,1,1,1,1]=5, round2=[1,1,1,1,1]=5 => total=10
  const doRound = (st, pid, vals) => {
    for (const v of vals) st = anker.applyThrow(st, pid, v);
    return st;
  };
  state = doRound(state, 1, [10, 10, 10, 10]);       // P1 round1 ends at 40
  state = doRound(state, 2, [1, 1, 1, 1, 1]);        // P2 round1
  state = doRound(state, 1, [5, 5, 5, 5, 5]);        // P1 round2
  state = doRound(state, 2, [1, 1, 1, 1, 1]);        // P2 round2
  const results = anker.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).score, 65);
  assert.equal(results.find(r => r.playerId === 1).winner, true);
});
