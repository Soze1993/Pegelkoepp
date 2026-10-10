'use strict';
// Contract test: binds the browser files (public/tv.js, public/index.html) to the
// server game module. The loser helpers of both frontends are extracted from the
// shipped files and run against states produced by the real bilderkegel module.
// (feedback ID 17: a Stechen winner must never be shown as BK loser)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bilderkegel = require('./bilderkegel');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const TV_FILE = path.join(PUBLIC_DIR, 'tv.js');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');

function readSrc(file) {
  return fs.readFileSync(file, 'utf8');
}

// Source text of a top-level function declaration: starts at column 0 with
// "function NAME(" and ends at the first following line that begins with "}".
// Works with CRLF and LF line endings.
function extractFn(src, name, fileLabel) {
  const re = new RegExp('^function ' + name + '\\([\\s\\S]*?\\r?\\n\\}', 'm');
  const m = re.exec(src);
  assert.ok(m, 'function ' + name + ' not found as top-level declaration in ' + fileLabel);
  return m[0];
}

function loadTvHelpers() {
  const src = readSrc(TV_FILE);
  const code = ['bkTotal', 'bkLoserId', 'getBKLoserName', 'bkRowMarks']
    .map(n => extractFn(src, n, 'public/tv.js')).join('\n');
  return new Function(code + '\nreturn { bkLoserId: bkLoserId, getBKLoserName: getBKLoserName, bkRowMarks: bkRowMarks };')();
}

function loadTabletLoserId() {
  const src = readSrc(INDEX_FILE);
  const code = extractFn(src, 'bkLoserId', 'public/index.html');
  return new Function(code + '\nreturn bkLoserId;')();
}

// ---------------------------------------------------------------------------
// Fixtures — produced by the real module, never hand-written
// ---------------------------------------------------------------------------
const P2 = [{ id: 1, name: 'Linden', emoji: 'L' }, { id: 2, name: 'Other', emoji: 'O' }];
const P3 = [{ id: 1, name: 'A', emoji: 'A' }, { id: 2, name: 'B', emoji: 'B' }, { id: 3, name: 'C', emoji: 'C' }];

// 5 Bilder, 2 throws per player and Bild. perPlayer: { id: [v1, v2] }
function playRegular(state, order, perPlayer) {
  for (let bild = 0; bild < 5; bild++) {
    for (const pid of order) {
      state = bilderkegel.applyThrow(state, pid, perPlayer[pid][0], { keinPudel: true });
      state = bilderkegel.applyThrow(state, pid, perPlayer[pid][1], { keinPudel: true });
    }
  }
  return state;
}

function throwSeq(state, seq) {
  for (const [pid, v] of seq) state = bilderkegel.applyThrow(state, pid, v, { keinPudel: true });
  return state;
}

function stechenWinnerSeatedFirst() {
  const s = playRegular(bilderkegel.initState(P2), [1, 2], { 1: [1, 1], 2: [1, 1] });
  return throwSeq(s, [[1, 7], [2, 2]]);
}

function decidedFixtures() {
  // 1) no tie: player 2 lowest
  const noTie = playRegular(bilderkegel.initState(P2), [1, 2], { 1: [1, 1], 2: [0, 0] });
  // 2) Stechen with the winner seated first
  const stechen = stechenWinnerSeatedFirst();
  // 3) exempt player (3) has the lowest total; player 2 is lowest eligible
  const exempt = playRegular(bilderkegel.initState(P3, { exemptPlayerId: 3 }), [1, 2, 3],
    { 1: [2, 1], 2: [1, 1], 3: [0, 0] });
  return [noTie, stechen, exempt];
}

function runningStechen3() {
  const s = playRegular(bilderkegel.initState(P3), [1, 2, 3], { 1: [1, 1], 2: [1, 1], 3: [1, 1] });
  return throwSeq(s, [[1, 8], [2, 3], [3, 3]]);
}

// ---------------------------------------------------------------------------
// TV
// ---------------------------------------------------------------------------
test('FE-TV1: Stechen winner seated first is not the loser on the TV (reported bug)', () => {
  const tv = loadTvHelpers();
  const state = stechenWinnerSeatedFirst();
  assert.equal(tv.bkLoserId(state), 2);
  assert.equal(tv.getBKLoserName(state), 'Other');
  assert.deepEqual(tv.bkRowMarks(state), { activeId: null, loserIds: [2] });
});

test('FE-TV2: TV bkLoserId equals the server getLoserId for decided games', () => {
  const tv = loadTvHelpers();
  for (const state of decidedFixtures()) {
    assert.equal(state.done, true);
    assert.equal(tv.bkLoserId(state), bilderkegel.getLoserId(state));
    assert.notEqual(tv.bkLoserId(state), null);
  }
});

test('FE-TV3: running Stechen marks only the remaining candidates and the next thrower', () => {
  const tv = loadTvHelpers();
  let state = runningStechen3();
  assert.equal(state.stechen, true);
  assert.equal(tv.bkLoserId(state), null);
  const marks = tv.bkRowMarks(state);
  assert.deepEqual(marks.loserIds, [2, 3]);
  assert.equal(marks.activeId, 2);
  state = bilderkegel.applyThrow(state, 2, 6);
  assert.equal(tv.bkRowMarks(state).activeId, 3);
});

test('FE-TV4: regular play keeps the live last-place indicator', () => {
  const tv = loadTvHelpers();
  // before any Bild is scored
  let state = bilderkegel.initState(P3, { exemptPlayerId: 3 });
  let marks = tv.bkRowMarks(state);
  assert.deepEqual(marks.loserIds, []);
  assert.equal(marks.activeId, 1);
  state = bilderkegel.applyThrow(state, 1, 1);
  assert.deepEqual(tv.bkRowMarks(state).loserIds, [], 'one throw does not score a Bild yet');

  // after Bild 0 of everybody: P1 3, P2 2, P3 (exempt) 0
  state = bilderkegel.initState(P3, { exemptPlayerId: 3 });
  state = throwSeq(state, [[1, 2], [1, 1], [2, 1], [2, 1], [3, 0], [3, 0]]);
  marks = tv.bkRowMarks(state);
  assert.deepEqual(marks.loserIds, [2]);
  assert.equal(marks.activeId, state.players[state.aktSpIdx].id);
  assert.equal(tv.bkLoserId(state), null);

  // tie at 0: first player in seat order among non-exempt
  state = bilderkegel.initState(P3, { exemptPlayerId: 1 });
  state = throwSeq(state, [[1, 0], [1, 0], [2, 0], [2, 0], [3, 0], [3, 0]]);
  assert.deepEqual(tv.bkRowMarks(state).loserIds, [2]);
});

test('FE-TV5: public/tv.js compiles', () => {
  assert.doesNotThrow(() => new vm.Script(readSrc(TV_FILE), { filename: 'tv.js' }));
});

test('FE-TV6: renderBilderkegelTV uses bkRowMarks and getBKLoserName', () => {
  const fn = extractFn(readSrc(TV_FILE), 'renderBilderkegelTV', 'public/tv.js');
  assert.ok(/bkRowMarks\(state\)/.test(fn), 'renderBilderkegelTV must call bkRowMarks(state)');
  assert.ok(/getBKLoserName\(state\)/.test(fn), 'renderBilderkegelTV must call getBKLoserName(state)');
});
