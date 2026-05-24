'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const bilderkegel = require('./bilderkegel');

const players2 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' }
];

// C1: Module shape
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof bilderkegel.id, 'string');
  assert.equal(typeof bilderkegel.name, 'string');
  assert.equal(typeof bilderkegel.initState, 'function');
  assert.equal(typeof bilderkegel.applyThrow, 'function');
  assert.equal(typeof bilderkegel.isFinished, 'function');
  assert.equal(typeof bilderkegel.getFinalResults, 'function');
});

// C2: initState returns unfinished state
test('C2: initState returns state where isFinished is false', () => {
  const state = bilderkegel.initState(players2);
  assert.equal(bilderkegel.isFinished(state), false);
});

// C3: applyThrow does not mutate input state
test('C3: applyThrow does not mutate input state', () => {
  const state = bilderkegel.initState(players2);
  const snapshot = JSON.parse(JSON.stringify(state));
  bilderkegel.applyThrow(state, 1, 5);
  assert.deepEqual(state, snapshot);
});

// C4: Determinism
test('C4: two independent replays produce identical final states', () => {
  // 2 players, 5 pictures, 2 throws each per player per picture = 20 throws total
  const throws = [];
  for (let pic = 0; pic < 5; pic++) {
    // P1: 2 throws per picture
    throws.push({ playerId: 1, value: 5 });
    throws.push({ playerId: 1, value: 4 });
    // P2: 2 throws per picture
    throws.push({ playerId: 2, value: 3 });
    throws.push({ playerId: 2, value: 2 });
  }
  let s1 = bilderkegel.initState(players2);
  let s2 = bilderkegel.initState(players2);
  for (const t of throws) {
    s1 = bilderkegel.applyThrow(s1, t.playerId, t.value);
    s2 = bilderkegel.applyThrow(s2, t.playerId, t.value);
  }
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults includes winner and payer flags
test('C5: getFinalResults returns winner and payer flags', () => {
  let state = bilderkegel.initState(players2);
  // P1 gets 5,5 per picture = 50 total; P2 gets 3,3 per picture = 30 total
  for (let pic = 0; pic < 5; pic++) {
    state = bilderkegel.applyThrow(state, 1, 5);
    state = bilderkegel.applyThrow(state, 1, 5);
    state = bilderkegel.applyThrow(state, 2, 3);
    state = bilderkegel.applyThrow(state, 2, 3);
  }
  const results = bilderkegel.getFinalResults(state);
  const p1 = results.find(r => r.playerId === 1);
  const p2 = results.find(r => r.playerId === 2);
  assert.equal(p1.winner, true, 'P1 has most points');
  assert.equal(p2.payer, true, 'P2 has fewest points');
  assert.equal(p1.payer, false);
  assert.equal(p2.winner, false);
});

// BK1: BK_BILDER constant
test('BK1: module has 5 pictures defined (volle, kleeblatt, hint_kranz, damen, bauern)', () => {
  // Verify by checking state gets 5 picture slots
  const state = bilderkegel.initState([{ id: 1, name: 'A', emoji: 'A' }]);
  const p = state.players[0];
  assert.equal(p.bildPts.length, 5);
  assert.equal(p.wuerfe.length, 5);
});

// BK2: 2 throws per picture before rotating
test('BK2: 2 throws per picture, then rotates to next player', () => {
  let state = bilderkegel.initState(players2);
  assert.equal(state.aktSpIdx, 0);
  assert.equal(state.aktBildIdx, 0);
  state = bilderkegel.applyThrow(state, 1, 5); // P1 first throw for pic 0
  assert.equal(state.aktSpIdx, 0, 'still P1 after 1st throw');
  state = bilderkegel.applyThrow(state, 1, 4); // P1 second throw for pic 0
  assert.equal(state.aktSpIdx, 1, 'rotated to P2 after 2nd throw');
  assert.equal(state.aktWurfNr, 0, 'wurfNr reset to 0');
  assert.equal(state.aktBildIdx, 0, 'still on picture 0');
});

// BK3: bildPts[idx] = sum of 2 throws after completing picture
test('BK3: bildPts[idx] = sum of 2 throws after completing picture round', () => {
  let state = bilderkegel.initState(players2);
  state = bilderkegel.applyThrow(state, 1, 5); // P1: throw 1 of pic 0
  state = bilderkegel.applyThrow(state, 1, 4); // P1: throw 2 of pic 0 -> bildPts[0]=9
  const p1 = state.players.find(p => p.id === 1);
  assert.equal(p1.bildPts[0], 9);
});

// BK4: isFinished after all players complete all 5 pictures
test('BK4: isFinished returns true after all players complete all 5 pictures', () => {
  let state = bilderkegel.initState(players2);
  for (let pic = 0; pic < 5; pic++) {
    state = bilderkegel.applyThrow(state, 1, 5);
    state = bilderkegel.applyThrow(state, 1, 4);
    state = bilderkegel.applyThrow(state, 2, 3);
    state = bilderkegel.applyThrow(state, 2, 2);
  }
  assert.equal(bilderkegel.isFinished(state), true);
});

// BK5: getFinalResults — highest is winner, lowest is payer
// Uses values below max per Bild to ensure 2 throws always:
// Volle max=12 (use 4+4=8), Kleeblatt max=6 (use 2+2=4), Hint.Kranz max=5 (use 2+2=4),
// Damen max=4 (use 1+1=2), Bauern max=2 (use 1+0=1; 1 throw won't trigger early since value<max)
// P1 total: 4+4+4+2+1=15 ... let's use safe values 3+3 per pic but cap aware
// Safe: use value 1 per throw — never reaches any max early
test('BK5: highest total = winner:true, lowest total = payer:true', () => {
  let state = bilderkegel.initState(players2);
  // P1: 3+3 per pic, but Bauern max=2 so throw1=1, throw2=1 (both below max=2... wait max is 2 pins which means 1+1=2)
  // Actually: use throw values 1 for P1 and 0 for P2 — safe everywhere
  // P1: 2 throws of 1 per pic = 2 per pic * 5 pics = 10 total
  // P2: 2 throws of 0 per pic = 0 per pic * 5 pics = 0 total
  for (let pic = 0; pic < 5; pic++) {
    state = bilderkegel.applyThrow(state, 1, 1);
    state = bilderkegel.applyThrow(state, 1, 1);
    state = bilderkegel.applyThrow(state, 2, 0);
    state = bilderkegel.applyThrow(state, 2, 0);
  }
  const results = bilderkegel.getFinalResults(state);
  const p1 = results.find(r => r.playerId === 1);
  const p2 = results.find(r => r.playerId === 2);
  assert.equal(p1.score, 10, 'P1 scores 10');
  assert.equal(p2.score, 0, 'P2 scores 0');
  assert.equal(p1.winner, true);
  assert.equal(p1.payer, false);
  assert.equal(p2.winner, false);
  assert.equal(p2.payer, true);
});

// BK6: Pudel = 0 contributes 0, increments pudel counter
test('BK6: Pudel value=0 contributes 0 to bildPts and increments pudel counter', () => {
  let state = bilderkegel.initState(players2);
  state = bilderkegel.applyThrow(state, 1, 0); // Pudel
  state = bilderkegel.applyThrow(state, 1, 5); // second throw
  const p = state.players.find(p => p.id === 1);
  assert.equal(p.pudel, 1, 'pudel counter incremented');
  assert.equal(p.bildPts[0], 5, 'bildPts = 0 + 5 = 5');
});

// BK7: Kleeblatt max=6 in 1 throw — no second throw
test('BK7: Kleeblatt (bildIdx=1) max score in first throw skips second throw', () => {
  const player = { id: 1, name: 'A', emoji: 'A' };
  let state = bilderkegel.initState([player]);
  // Complete Volle (pic 0) first: 2 throws
  state = bilderkegel.applyThrow(state, 1, 5);
  state = bilderkegel.applyThrow(state, 1, 4);
  // Now on Kleeblatt (pic 1), max = 6 pins
  assert.equal(state.aktBildIdx, 1, 'on Kleeblatt');
  state = bilderkegel.applyThrow(state, 1, 6); // max score — should auto-advance
  assert.equal(state.aktBildIdx, 2, 'advanced to next Bild without second throw');
  assert.equal(state.aktWurfNr, 0, 'wurfNr reset');
});

// BK8: Volle always gets 2 throws even if throw 1 = 9
test('BK8: Volle (bildIdx=0) always gets 2 throws even with max pins', () => {
  const player = { id: 1, name: 'A', emoji: 'A' };
  let state = bilderkegel.initState([player]);
  // Volle: max possible is 9 (9 pins) but BK_MAX[0]=12 so 2 throws always
  state = bilderkegel.applyThrow(state, 1, 9);
  assert.equal(state.aktBildIdx, 0, 'still on Volle after 9 pins');
  assert.equal(state.aktWurfNr, 1, 'still on throw 2');
  state = bilderkegel.applyThrow(state, 1, 3);
  assert.equal(state.aktBildIdx, 1, 'moved to Kleeblatt after 2nd throw');
});
