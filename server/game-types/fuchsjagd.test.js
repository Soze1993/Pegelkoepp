'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fuchsjagd = require('./fuchsjagd');

const players = [
  { id: 1, name: 'Fuchs', emoji: 'F', role: 'fuchs' },
  { id: 2, name: 'Jaeger1', emoji: 'J', role: 'jaeger' },
  { id: 3, name: 'Jaeger2', emoji: 'J', role: 'jaeger' }
];

const players2 = [
  { id: 1, name: 'Fuchs', emoji: 'F', role: 'fuchs' },
  { id: 2, name: 'Jaeger1', emoji: 'J', role: 'jaeger' }
];

// C1: Module shape
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof fuchsjagd.id, 'string');
  assert.equal(typeof fuchsjagd.name, 'string');
  assert.equal(typeof fuchsjagd.initState, 'function');
  assert.equal(typeof fuchsjagd.applyThrow, 'function');
  assert.equal(typeof fuchsjagd.isFinished, 'function');
  assert.equal(typeof fuchsjagd.getFinalResults, 'function');
});

// C2: initState returns unfinished state
test('C2: initState returns state where isFinished is false', () => {
  const state = fuchsjagd.initState(players2);
  assert.equal(fuchsjagd.isFinished(state), false);
});

// C3: applyThrow does not mutate input state
test('C3: applyThrow does not mutate input state', () => {
  const state = fuchsjagd.initState(players2);
  const snapshot = JSON.parse(JSON.stringify(state));
  fuchsjagd.applyThrow(state, 1, 5);
  assert.deepEqual(state, snapshot);
});

// C4: Determinism
test('C4: two independent replays produce identical final states', () => {
  // Fuchs 3+3=6; Jaeger 7 -> fp=-1 -> hunters win
  const throws = [
    { playerId: 1, value: 3 },
    { playerId: 1, value: 3 },
    { playerId: 2, value: 7 }
  ];
  let s1 = fuchsjagd.initState(players2);
  let s2 = fuchsjagd.initState(players2);
  for (const t of throws) {
    s1 = fuchsjagd.applyThrow(s1, t.playerId, t.value);
    s2 = fuchsjagd.applyThrow(s2, t.playerId, t.value);
  }
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults returns winner info
test('C5: getFinalResults returns results with winner flag', () => {
  let state = fuchsjagd.initState(players2);
  // Hunters win: Fuchs 3+3=6, Jaeger throws 7
  state = fuchsjagd.applyThrow(state, 1, 3);
  state = fuchsjagd.applyThrow(state, 1, 3);
  state = fuchsjagd.applyThrow(state, 2, 7);
  assert.equal(fuchsjagd.isFinished(state), true);
  const results = fuchsjagd.getFinalResults(state);
  assert.ok(Array.isArray(results));
  assert.ok(results.some(r => r.winner));
});

// FJ1: initState shape
test('FJ1: initState creates correct state shape', () => {
  const state = fuchsjagd.initState(players);
  assert.ok(state.fuchs, 'fuchs exists');
  assert.ok(Array.isArray(state.jaeger), 'jaeger is array');
  assert.equal(state.jaeger.length, 2);
  assert.equal(state.fp, 0);
  assert.equal(state.phase, 'start');
  assert.equal(state.startW, 0);
  assert.equal(state.jIdx, 0);
  assert.equal(state.jPhase, 'jaeger');
  assert.equal(state.done, false);
  assert.equal(state.winner, null);
});

// FJ2: Start phase - two Fuchs throws transition to jagd
test('FJ2: two Fuchs throws in start phase transition to jagd', () => {
  let state = fuchsjagd.initState(players2);
  assert.equal(state.phase, 'start');
  state = fuchsjagd.applyThrow(state, 1, 5); // first fox throw
  assert.equal(state.fp, 5);
  assert.equal(state.startW, 1);
  assert.equal(state.phase, 'start', 'still start after 1st fox throw');
  state = fuchsjagd.applyThrow(state, 1, 4); // second fox throw
  assert.equal(state.fp, 9);
  assert.equal(state.startW, 2);
  assert.equal(state.phase, 'jagd', 'phase flips to jagd after 2 fox throws');
  assert.equal(state.jIdx, 0);
  assert.equal(state.jPhase, 'jaeger');
});

// FJ3: Hunter win - fp <= 0 after jaeger throw
test('FJ3: hunters win when fp drops to 0 or below', () => {
  let state = fuchsjagd.initState(players2);
  // Fuchs throws 3+3=6
  state = fuchsjagd.applyThrow(state, 1, 3);
  state = fuchsjagd.applyThrow(state, 1, 3);
  // Jaeger throws 6 -> fp=0
  state = fuchsjagd.applyThrow(state, 2, 6);
  assert.equal(state.done, true);
  assert.equal(state.winner, 'jaeger');
});

// FJ3b: Hunter win with fp going negative
test('FJ3b: hunters win when fp goes negative', () => {
  let state = fuchsjagd.initState(players2);
  state = fuchsjagd.applyThrow(state, 1, 3); // fp=3
  state = fuchsjagd.applyThrow(state, 1, 3); // fp=6, phase=jagd
  state = fuchsjagd.applyThrow(state, 2, 7); // fp=-1 -> hunters win
  assert.equal(state.done, true);
  assert.equal(state.winner, 'jaeger');
});

// FJ4: Fox win path - after jPhase='fuchs', fox throws, jIdx advances; after >=6 hunter throws fox wins
test('FJ4: fox wins after jPhase-fuchs rotation when total hunter throws >= 6', () => {
  // With 1 hunter: jaeger and fuchs alternate; after 6 hunter throws with fp > 0, fox wins
  // Fuchs: 9+9=18 fp; each jaeger throw is 1 (fp stays 17,16,...13 after 5 throws); then 6th jaeger throw of 1 -> fp=12; fox escapes
  let state = fuchsjagd.initState(players2);
  state = fuchsjagd.applyThrow(state, 1, 9); // start 1
  state = fuchsjagd.applyThrow(state, 1, 9); // start 2 -> fp=18, jagd
  // Now jPhase='jaeger', jIdx=0 (only 1 hunter)
  // Round: jaeger throws 1 (fp=17), then fox throws (fp increments)
  // Repeat until 6 hunter throws with fp > 0
  for (let i = 0; i < 5; i++) {
    state = fuchsjagd.applyThrow(state, 2, 1); // jaeger throws 1, fp -= 1
    if (state.done) break;
    state = fuchsjagd.applyThrow(state, 1, 0); // fuchs throws 0
    if (state.done) break;
  }
  if (!state.done) {
    // 6th hunter throw
    state = fuchsjagd.applyThrow(state, 2, 1);
  }
  assert.equal(state.done, true);
  assert.equal(state.winner, 'fuchs');
});

// FJ5: REPLAY DETERMINISM - hunter win sequence
test('FJ5: replay determinism - hunter win sequence', () => {
  const throws = [
    { playerId: 1, value: 3 },
    { playerId: 1, value: 3 },
    { playerId: 2, value: 7 }
  ];
  let s1 = fuchsjagd.initState(players2);
  let s2 = fuchsjagd.initState(players2);
  for (const t of throws) {
    s1 = fuchsjagd.applyThrow(s1, t.playerId, t.value);
    s2 = fuchsjagd.applyThrow(s2, t.playerId, t.value);
  }
  assert.deepEqual(s1, s2, 'Two replays of hunter win are identical');
  assert.equal(s1.winner, 'jaeger');
  assert.equal(s1.done, true);
});

// FJ6: REPLAY DETERMINISM - fox win sequence
test('FJ6: replay determinism - fox win sequence', () => {
  // Fox: 9+9=18; 1 jaeger who throws 1 each time; fox throws 0; after 6 hunter throws, fox wins
  const throws = [
    { playerId: 1, value: 9 }, // start 1
    { playerId: 1, value: 9 }, // start 2 -> fp=18, jagd
    { playerId: 2, value: 1 }, // jaeger throw 1
    { playerId: 1, value: 0 }, // fox throw
    { playerId: 2, value: 1 }, // jaeger throw 2
    { playerId: 1, value: 0 }, // fox throw
    { playerId: 2, value: 1 }, // jaeger throw 3
    { playerId: 1, value: 0 }, // fox throw
    { playerId: 2, value: 1 }, // jaeger throw 4
    { playerId: 1, value: 0 }, // fox throw
    { playerId: 2, value: 1 }, // jaeger throw 5
    { playerId: 1, value: 0 }, // fox throw
    { playerId: 2, value: 1 }, // jaeger throw 6 -> fox wins (fp > 0)
  ];
  let s1 = fuchsjagd.initState(players2);
  let s2 = fuchsjagd.initState(players2);
  for (const t of throws) {
    if (!s1.done) s1 = fuchsjagd.applyThrow(s1, t.playerId, t.value);
    if (!s2.done) s2 = fuchsjagd.applyThrow(s2, t.playerId, t.value);
  }
  assert.deepEqual(s1, s2, 'Two replays of fox win are identical');
  assert.equal(s1.winner, 'fuchs');
  assert.equal(s1.done, true);
});
