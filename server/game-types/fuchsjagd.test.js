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
  // Fuchs 3+3=6 start; jagd: jaeger throws 7 -> fp=-1 -> hunters win
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
  // Hunters win: Fuchs 3+3=6 start; jagd: jaeger 7 -> fp=-1
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
  assert.equal(state.jPhase, 'jaeger', 'jaeger throws first each jagd round');
});

// FJ3: Hunter win - fp <= 0 after jaeger throw
test('FJ3: hunters win when fp drops to 0 or below', () => {
  let state = fuchsjagd.initState(players2);
  state = fuchsjagd.applyThrow(state, 1, 3); // start 1
  state = fuchsjagd.applyThrow(state, 1, 3); // start 2 -> fp=6, jagd jPhase='jaeger'
  state = fuchsjagd.applyThrow(state, 2, 6); // jaeger throws 6 -> fp=0
  assert.equal(state.done, true);
  assert.equal(state.winner, 'jaeger');
});

// FJ3b: Hunter win with fp going negative
test('FJ3b: hunters win when fp goes negative', () => {
  let state = fuchsjagd.initState(players2);
  state = fuchsjagd.applyThrow(state, 1, 3); // start 1
  state = fuchsjagd.applyThrow(state, 1, 3); // start 2 -> fp=6, jagd
  state = fuchsjagd.applyThrow(state, 2, 7); // jaeger throws 7 -> fp=-1
  assert.equal(state.done, true);
  assert.equal(state.winner, 'jaeger');
});

// FJ4: Fox wins — 1 Jäger, pattern J→F×6 then J(final); Fuchs makes 6 jagd throws
test('FJ4: fox wins after 6 jagd rounds with 1 jaeger — jaeger first, fuchs second, jaeger final', () => {
  // fp=18; pattern: J(1)→F(0) ×6 → J(1,final) → done=fuchs
  let state = fuchsjagd.initState(players2);
  state = fuchsjagd.applyThrow(state, 1, 9); // start 1
  state = fuchsjagd.applyThrow(state, 1, 9); // start 2 -> fp=18, jagd jPhase='jaeger'
  for (let i = 0; i < 6; i++) {
    state = fuchsjagd.applyThrow(state, 2, 1); // jaeger throws 1
    if (state.done) break;
    state = fuchsjagd.applyThrow(state, 1, 0); // fuchs jagd throw
    if (state.done) break;
  }
  // After Fuchs's 6th jagd throw, finalRound=true; one last jaeger throw
  assert.equal(state.finalRound, true, 'finalRound set after 6 fuchs jagd throws');
  assert.equal(state.done, false, 'not done yet — final jaeger throw pending');
  state = fuchsjagd.applyThrow(state, 2, 1); // final jaeger throw
  assert.equal(state.done, true);
  assert.equal(state.winner, 'fuchs');
  assert.equal(state.fuchs.w.length - 2, 6, 'fuchs made exactly 6 jagd throws');
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
  // Fox: 9+9=18; 1 jaeger; pattern J→F ×6 then J(final) -> fox wins
  const throws = [
    { playerId: 1, value: 9 }, // start 1
    { playerId: 1, value: 9 }, // start 2 -> fp=18, jagd jPhase='jaeger'
    { playerId: 2, value: 1 }, // jaeger 1
    { playerId: 1, value: 0 }, // fuchs jagd 1
    { playerId: 2, value: 1 }, // jaeger 2
    { playerId: 1, value: 0 }, // fuchs jagd 2
    { playerId: 2, value: 1 }, // jaeger 3
    { playerId: 1, value: 0 }, // fuchs jagd 3
    { playerId: 2, value: 1 }, // jaeger 4
    { playerId: 1, value: 0 }, // fuchs jagd 4
    { playerId: 2, value: 1 }, // jaeger 5
    { playerId: 1, value: 0 }, // fuchs jagd 5
    { playerId: 2, value: 1 }, // jaeger 6
    { playerId: 1, value: 0 }, // fuchs jagd 6 -> finalRound=true
    { playerId: 2, value: 1 }, // jaeger final -> fox wins (fp=12 > 0)
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

// FJ7: Multi-Jäger turn order — J1→F→J2→F repeating, then ONE final Jäger throw
test('FJ7: 2-jaeger: interleaved J1→F→J2→F×3, then one final Jäger throw ends the game', () => {
  // fp=12; 3 rounds of (J1→F→J2→F) = 6 fuchs jagd throws → J1 (next in sequence) gets ONE final throw → done=fuchs
  let state = fuchsjagd.initState(players);
  state = fuchsjagd.applyThrow(state, 1, 6); // start 1: fp=6
  state = fuchsjagd.applyThrow(state, 1, 6); // start 2: fp=12, jagd jPhase='jaeger' jIdx=0
  for (let round = 0; round < 3; round++) {
    state = fuchsjagd.applyThrow(state, 2, 1); // J1 throws
    assert.equal(state.jPhase, 'fuchs', `round ${round + 1}: after J1, jPhase=fuchs`);
    state = fuchsjagd.applyThrow(state, 1, 0); // F responds to J1
    assert.equal(state.jIdx, 1, `round ${round + 1}: after F responds to J1, jIdx=1 (J2 next)`);
    state = fuchsjagd.applyThrow(state, 3, 1); // J2 throws
    assert.equal(state.jPhase, 'fuchs', `round ${round + 1}: after J2, jPhase=fuchs`);
    state = fuchsjagd.applyThrow(state, 1, 0); // F responds to J2
  }
  // After 6 Fuchs jagd throws: finalRound=true, jIdx=0 (J1 is next)
  assert.equal(state.finalRound, true, 'finalRound set after 6 fuchs jagd throws');
  assert.equal(state.jIdx, 0, 'J1 is next — gets the single final throw');
  assert.equal(state.done, false, 'game not done yet — one final Jäger throw pending');
  // ONE final Jäger throw — game ends immediately after
  state = fuchsjagd.applyThrow(state, 2, 1); // J1 final throw (fp still > 0 → fox wins)
  assert.equal(state.done, true, 'game ends after the one final Jäger throw');
  assert.equal(state.winner, 'fuchs');
  assert.equal(state.fuchs.w.length - 2, 6, 'fuchs made exactly 6 jagd throws');
});
