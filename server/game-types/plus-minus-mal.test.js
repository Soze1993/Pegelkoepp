'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const plusMinus = require('./plus-minus-mal');

const players2 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' }
];

// C1: Module shape
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof plusMinus.id, 'string');
  assert.equal(typeof plusMinus.name, 'string');
  assert.equal(typeof plusMinus.initState, 'function');
  assert.equal(typeof plusMinus.applyThrow, 'function');
  assert.equal(typeof plusMinus.isFinished, 'function');
  assert.equal(typeof plusMinus.getFinalResults, 'function');
});

// C2: initState returns unfinished state
test('C2: initState returns state where isFinished is false', () => {
  const state = plusMinus.initState(players2);
  assert.equal(plusMinus.isFinished(state), false);
});

// C3: applyThrow does not mutate input state
test('C3: applyThrow does not mutate input state', () => {
  const state = plusMinus.initState(players2);
  const snapshot = JSON.parse(JSON.stringify(state));
  plusMinus.applyThrow(state, 1, 5);
  assert.deepEqual(state, snapshot);
});

// C4: Determinism
test('C4: two independent replays produce identical final states', () => {
  // 5 rounds, 2 players = 10 throws
  const throws = [
    { playerId: 1, value: 5 }, { playerId: 2, value: 3 }, // round 1
    { playerId: 1, value: 4 }, { playerId: 2, value: 2 }, // round 2
    { playerId: 1, value: 2 }, { playerId: 2, value: 1 }, // round 3
    { playerId: 1, value: 4 }, { playerId: 2, value: 3 }, // round 4
    { playerId: 1, value: 1 }, { playerId: 2, value: 2 }  // round 5
  ];
  let s1 = plusMinus.initState(players2);
  let s2 = plusMinus.initState(players2);
  for (const t of throws) {
    s1 = plusMinus.applyThrow(s1, t.playerId, t.value);
    s2 = plusMinus.applyThrow(s2, t.playerId, t.value);
  }
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults flags correct winner
test('C5: getFinalResults flags the correct winner', () => {
  // P1 gets [5,3,2,4,1] => ((5+3-2)*4)/1 = 24
  // P2 gets [9,9,1,1,1] => ((9+9-1)*1)/1 = 17
  // P1 wins with 24 > 17
  const players1 = [
    { id: 1, name: 'A', emoji: 'A' },
    { id: 2, name: 'B', emoji: 'B' }
  ];
  let state = plusMinus.initState(players1);
  const throws = [
    { playerId: 1, value: 5 }, { playerId: 2, value: 9 }, // round 1
    { playerId: 1, value: 3 }, { playerId: 2, value: 9 }, // round 2
    { playerId: 1, value: 2 }, { playerId: 2, value: 1 }, // round 3
    { playerId: 1, value: 4 }, { playerId: 2, value: 1 }, // round 4
    { playerId: 1, value: 1 }, { playerId: 2, value: 1 }  // round 5
  ];
  for (const t of throws) state = plusMinus.applyThrow(state, t.playerId, t.value);
  const results = plusMinus.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).winner, true);
});

// P1: 5 rounds, pmRunde starts at 1 and advances when all players threw
test('P1: pmRunde starts at 1, advances after all players throw in a round', () => {
  let state = plusMinus.initState(players2);
  assert.equal(state.pmRunde, 1);
  state = plusMinus.applyThrow(state, 1, 5);
  assert.equal(state.pmRunde, 1, 'still round 1 after only p1 throws');
  state = plusMinus.applyThrow(state, 2, 3);
  assert.equal(state.pmRunde, 2, 'advances to round 2 after both players throw');
});

// P2: Formula applies sequentially: r=w[0]; r+=w[1]; r-=w[2]; r*=w[3]; r/=w[4]
// [5,3,2,4,1]: r=5, r+=3=8, r-=2=6, r*=4=24, r/=1=24 => 24
test('P2: sequential formula: [5,3,2,4,1] => ((5+3-2)*4)/1 = 24', () => {
  const players1 = [{ id: 1, name: 'A', emoji: 'A' }];
  let state = plusMinus.initState(players1);
  for (const v of [5, 3, 2, 4, 1]) {
    state = plusMinus.applyThrow(state, 1, v);
  }
  const results = plusMinus.getFinalResults(state);
  assert.equal(results[0].score, 24);
});

// P3: Pudel on W3 substitutes 9; cap prevents subtraction going below 1
// W1=5, W2=3 → sumW1W2=8 → W3 capped to min(9, 8-1)=7; stored as 7
// 5+3-7=1, ×4=4, ÷1=4
test('P3: Pudel on W3 capped to sumW1W2-1; W3 stored as 7 not 9; score = 4', () => {
  const players1 = [{ id: 1, name: 'A', emoji: 'A' }];
  let state = plusMinus.initState(players1);
  state = plusMinus.applyThrow(state, 1, 5); // round 1
  state = plusMinus.applyThrow(state, 1, 3); // round 2
  state = plusMinus.applyThrow(state, 1, 0); // round 3 = Pudel -> substituted 9, capped to 7
  state = plusMinus.applyThrow(state, 1, 4); // round 4
  state = plusMinus.applyThrow(state, 1, 1); // round 5
  const p = state.players.find(x => x.id === 1);
  assert.equal(p.pudel, 1, 'pudel counter incremented');
  assert.equal(p.wuerfe[2], 7, 'W3 capped to sumW1W2-1 (8-1=7)');
  const results = plusMinus.getFinalResults(state);
  assert.equal(results[0].score, 4); // 5+3-7=1, ×4=4, ÷1=4
});

// P4: isFinished returns true after pmRunde > 5
test('P4: isFinished returns true after pmRunde > 5', () => {
  const players1 = [{ id: 1, name: 'A', emoji: 'A' }];
  let state = plusMinus.initState(players1);
  assert.equal(plusMinus.isFinished(state), false);
  for (let i = 0; i < 5; i++) {
    state = plusMinus.applyThrow(state, 1, 5);
  }
  assert.equal(plusMinus.isFinished(state), true);
});

// P5: Highest pmCalc wins
// P1: [9,9,1,1,1] => ((9+9-1)*1)/1 = 17
// P2: [5,3,2,4,1] => ((5+3-2)*4)/1 = 24 => P2 wins
test('P5: highest pmCalc wins; P2 scores 24 > P1 scores 17', () => {
  let state = plusMinus.initState(players2);
  const throws = [
    { playerId: 1, value: 9 }, { playerId: 2, value: 5 },
    { playerId: 1, value: 9 }, { playerId: 2, value: 3 },
    { playerId: 1, value: 1 }, { playerId: 2, value: 2 },
    { playerId: 1, value: 1 }, { playerId: 2, value: 4 },
    { playerId: 1, value: 1 }, { playerId: 2, value: 1 }
  ];
  for (const t of throws) state = plusMinus.applyThrow(state, t.playerId, t.value);
  const results = plusMinus.getFinalResults(state);
  assert.equal(results.find(r => r.playerId === 1).score, 17);
  assert.equal(results.find(r => r.playerId === 2).score, 24);
  assert.equal(results.find(r => r.playerId === 2).winner, true);
  assert.equal(results.find(r => r.playerId === 1).winner, false);
});

// P6: W1=W2=0 (both pudels) — W3 capped to 0, pmCalc floor saves result to 1
// Worst case: W1=0(pudel), W2=0(pudel), W3=pudel→9 capped to min(9,0)=0
// pmCalc: 0+0-0=0 → floor 1; ×9=9; ÷1=9
test('P6: W1=W2=0 edge case — W3 capped to 0, pmCalc floor gives minimum 1; score = 9', () => {
  const players1 = [{ id: 1, name: 'A', emoji: 'A' }];
  let state = plusMinus.initState(players1);
  state = plusMinus.applyThrow(state, 1, 0); // round 1: pudel → stored 0
  state = plusMinus.applyThrow(state, 1, 0); // round 2: pudel → stored 0
  state = plusMinus.applyThrow(state, 1, 0); // round 3: pudel → 9, capped to 0 (sumW1W2=0)
  state = plusMinus.applyThrow(state, 1, 9); // round 4: ×9
  state = plusMinus.applyThrow(state, 1, 1); // round 5: ÷1
  const p = state.players.find(x => x.id === 1);
  assert.equal(p.wuerfe[2], 0, 'W3 capped to 0 when W1+W2=0');
  const results = plusMinus.getFinalResults(state);
  assert.equal(results[0].score, 9); // 0+0-0=0 → pmCalc floor→1, ×9=9, ÷1=9
});
