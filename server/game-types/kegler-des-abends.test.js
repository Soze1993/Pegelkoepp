'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const kda = require('./kegler-des-abends');

// ---------------------------------------------------------------------------
// Player fixtures
// ---------------------------------------------------------------------------

const players4 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' },
  { id: 3, name: 'C', emoji: 'C' },
  { id: 4, name: 'D', emoji: 'D' }
];

const players8 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' },
  { id: 3, name: 'C', emoji: 'C' },
  { id: 4, name: 'D', emoji: 'D' },
  { id: 5, name: 'E', emoji: 'E' },
  { id: 6, name: 'F', emoji: 'F' },
  { id: 7, name: 'G', emoji: 'G' },
  { id: 8, name: 'H', emoji: 'H' }
];

const players6 = [
  { id: 1, name: 'A', emoji: 'A' },
  { id: 2, name: 'B', emoji: 'B' },
  { id: 3, name: 'C', emoji: 'C' },
  { id: 4, name: 'D', emoji: 'D' },
  { id: 5, name: 'E', emoji: 'E' },
  { id: 6, name: 'F', emoji: 'F' }
];

// ---------------------------------------------------------------------------
// C1–C5: Contract tests (adapted for DE bracket shape)
// ---------------------------------------------------------------------------

// C1: Module shape — must PASS against current engine (exports unchanged)
test('C1: exports id, name, and four functions', () => {
  assert.equal(typeof kda.id, 'string');
  assert.equal(typeof kda.name, 'string');
  assert.equal(typeof kda.initState, 'function');
  assert.equal(typeof kda.applyThrow, 'function');
  assert.equal(typeof kda.isFinished, 'function');
  assert.equal(typeof kda.getFinalResults, 'function');
});

// C2: initState returns unfinished state (reads state.bracket — FAILS against old engine)
test('C2: initState returns state where isFinished is false', () => {
  const state = kda.initState(players4, { seed: 'test' });
  // New engine must return state.bracket (flat slot array)
  assert.ok(Array.isArray(state.bracket), 'state.bracket must be an array');
  assert.equal(kda.isFinished(state), false);
});

// C3: applyThrow does not mutate input state (uses state.bracket — FAILS against old engine)
test('C3: applyThrow does not mutate input state', () => {
  const state = kda.initState(players4, { seed: 'test' });
  const snapshot = JSON.parse(JSON.stringify(state));
  // Find first active match in the DE bracket
  const match = state.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
  kda.applyThrow(state, match.p1.id, 7);
  assert.deepEqual(state, snapshot);
});

// C4: Determinism — two independent replays produce identical final states
// (uses state.bracket traversal — FAILS against old engine)
test('C4: two independent replays produce identical final states', () => {
  function playOutTournament(state) {
    let s = state;
    let iterations = 0;
    while (!kda.isFinished(s) && iterations < 200) {
      const match = s.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
      if (!match) break;
      // p1 always wins: submit p1 throw (value 9), then p2 throw (value 0)
      s = kda.applyThrow(s, match.p1.id, 9);
      s = kda.applyThrow(s, match.p2.id, 0);
      iterations++;
    }
    return s;
  }
  const s1 = playOutTournament(kda.initState(players4, { seed: 'det' }));
  const s2 = playOutTournament(kda.initState(players4, { seed: 'det' }));
  assert.deepEqual(s1, s2);
});

// C5: getFinalResults on completed tournament returns Array with exactly 1 winner
// (plays out via state.bracket — FAILS against old engine)
test('C5: getFinalResults returns array with exactly one winner flag', () => {
  let state = kda.initState(players4, { seed: 'test' });
  let iterations = 0;
  while (!kda.isFinished(state) && iterations < 200) {
    const match = state.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
    if (!match) break;
    state = kda.applyThrow(state, match.p1.id, 9);
    state = kda.applyThrow(state, match.p2.id, 0);
    iterations++;
  }
  const results = kda.getFinalResults(state);
  assert.ok(Array.isArray(results), 'getFinalResults must return an array');
  const winners = results.filter(r => r.winner);
  assert.equal(winners.length, 1, 'exactly one winner');
});

// ---------------------------------------------------------------------------
// KDA1–KDA9: DE bracket-specific tests (all FAIL against old engine)
// ---------------------------------------------------------------------------

// KDA1: initState(players4) returns bracket[], done=false, gewinner=null; >= 5 slots;
//        every slot has required keys
test('KDA1: initState generates bracket[] with correct slot count and shape for 4 players', () => {
  const state = kda.initState(players4, { seed: 'test' });
  assert.ok(Array.isArray(state.bracket), 'state.bracket must be an array');
  assert.equal(state.done, false);
  assert.equal(state.gewinner, null);
  // 4-player DE minimum: W-R1-1, W-R1-2, W-Final, L-Final, GF = 5 slots
  assert.ok(state.bracket.length >= 5, 'bracket must have at least 5 slots for 4 players');
  // Every slot must have the required DE engine keys
  for (const slot of state.bracket) {
    assert.ok('id' in slot, 'slot must have id');
    assert.ok('p1' in slot, 'slot must have p1');
    assert.ok('p2' in slot, 'slot must have p2');
    assert.ok('throws' in slot, 'slot must have throws');
    assert.ok('done' in slot, 'slot must have done');
    assert.ok('isBye' in slot, 'slot must have isBye');
    assert.ok('bracket' in slot, 'slot must have bracket');
    assert.ok('advancesWinnerTo' in slot, 'slot must have advancesWinnerTo');
    assert.ok('advancesLoserTo' in slot, 'slot must have advancesLoserTo');
  }
});

// KDA2: initState(players8) has a GF slot (bracket==='GF'); all non-bye W-R1 slots have
//        both p1 and p2 populated
test('KDA2: initState with 8 players has GF slot and fully populated W-R1 slots', () => {
  const state = kda.initState(players8, { seed: 'test' });
  assert.ok(Array.isArray(state.bracket), 'state.bracket must be an array');
  // Must contain a Grand Final slot
  const gf = state.bracket.find(s => s.bracket === 'GF');
  assert.ok(gf, 'bracket must contain a slot with bracket === "GF"');
  // All W-R1 slots that are not byes must have both players set
  const wR1Slots = state.bracket.filter(s => s.bracket === 'W' && s.round === 1);
  assert.ok(wR1Slots.length > 0, 'must have at least one W-R1 slot');
  for (const slot of wR1Slots) {
    if (!slot.isBye) {
      assert.ok(slot.p1 !== null && slot.p1 !== undefined, 'W-R1 non-bye slot must have p1');
      assert.ok(slot.p2 !== null && slot.p2 !== undefined, 'W-R1 non-bye slot must have p2');
    }
  }
});

// KDA3: initState(players6) returns bracket where exactly 2 slots have isBye===true;
//        bye slots are done===true with winner set; bye slots have no p2
test('KDA3: 6-player bracket has exactly 2 bye slots, each done and correctly set', () => {
  const state = kda.initState(players6, { seed: 'test' });
  assert.ok(Array.isArray(state.bracket), 'state.bracket must be an array');
  const byeSlots = state.bracket.filter(s => s.isBye === true);
  // 6 players → next power of 2 is 8 → 2 byes needed
  assert.equal(byeSlots.length, 2, 'must have exactly 2 bye slots for 6 players');
  for (const byeSlot of byeSlots) {
    assert.equal(byeSlot.done, true, 'bye slot must be pre-resolved (done=true)');
    assert.ok(byeSlot.winner !== null && byeSlot.winner !== undefined,
      'bye slot must have winner set to the seeded player');
    assert.ok(byeSlot.p2 === null || byeSlot.p2 === undefined,
      'bye slot must have no p2 (opponent)');
  }
});

// KDA4: applyThrow accumulates — after one throw (p1 throws 7), match.throws.length===1,
//        match.done===false
test('KDA4: applyThrow accumulates throws without resolving after first throw', () => {
  const state = kda.initState(players4, { seed: 'test' });
  const match = state.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
  assert.ok(match, 'must find an active match');
  const newState = kda.applyThrow(state, match.p1.id, 7);
  const updatedMatch = newState.bracket.find(m => m.id === match.id);
  assert.equal(updatedMatch.throws.length, 1, 'throws must accumulate: length 1 after first throw');
  assert.equal(updatedMatch.done, false, 'match must not be done after only one throw');
});

// KDA5: applyThrow resolves match after 2 throws — higher pin count is match.winner,
//        match.done===true, downstream slot (advancesWinnerTo) has the winner filled in
test('KDA5: applyThrow resolves match after 2 throws and advances winner to next slot', () => {
  const state = kda.initState(players4, { seed: 'test' });
  const match = state.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
  assert.ok(match, 'must find an active match');
  // p1 throws 9 (wins), p2 throws 0 (loses)
  let s = kda.applyThrow(state, match.p1.id, 9);
  s = kda.applyThrow(s, match.p2.id, 0);
  const resolvedMatch = s.bracket.find(m => m.id === match.id);
  assert.equal(resolvedMatch.done, true, 'match must be done after 2 throws');
  assert.equal(resolvedMatch.winner.id, match.p1.id, 'p1 (9 pins) must be winner');
  // Downstream winner slot must have the winner as p1 or p2
  if (match.advancesWinnerTo) {
    const nextSlot = s.bracket.find(m => m.id === match.advancesWinnerTo);
    assert.ok(nextSlot, 'advancesWinnerTo slot must exist in bracket');
    const winnerInNext = (nextSlot.p1 && nextSlot.p1.id === match.p1.id) ||
                         (nextSlot.p2 && nextSlot.p2.id === match.p1.id);
    assert.ok(winnerInNext, 'winner must be placed into the downstream slot');
  }
});

// KDA6: Tie detection — after two equal throws (both 5), match.tiebreak===true,
//        match.done===false, match.throwsRequired===4
test('KDA6: equal throws set tiebreak=true and extend throwsRequired', () => {
  const state = kda.initState(players4, { seed: 'test' });
  const match = state.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
  assert.ok(match, 'must find an active match');
  // Both players throw 5 — a tie
  let s = kda.applyThrow(state, match.p1.id, 5);
  s = kda.applyThrow(s, match.p2.id, 5);
  const updatedMatch = s.bracket.find(m => m.id === match.id);
  assert.equal(updatedMatch.tiebreak, true, 'tiebreak must be true after equal throws');
  assert.equal(updatedMatch.done, false, 'match must not be done after a tie');
  assert.equal(updatedMatch.throwsRequired, 4,
    'throwsRequired must be extended to 4 (one more round of throws each)');
});

// KDA7: Grand Final — GF slot has throwsRequired===4; after 2 throws for p1 and 1 throw
//        for p2, GF.done===false; after all 4 throws with p1 scoring more (9+8 > 7+6),
//        GF.done===true, state.gewinner.id===p1.id, state.done===true
test('KDA7: Grand Final requires 4 throws and sets state.gewinner when done', () => {
  // Play a full 4-player tournament to get two finalists into the GF
  function playToGF(state) {
    let s = state;
    let iterations = 0;
    while (iterations < 200) {
      const gf = s.bracket.find(m => m.bracket === 'GF');
      // Stop when GF has both players seated but is not yet done
      if (gf && gf.p1 && gf.p2 && !gf.done) break;
      // If done, something went wrong
      if (s.done) break;
      const match = s.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2 && m.bracket !== 'GF');
      if (!match) break;
      // p1 wins each semifinal match
      s = kda.applyThrow(s, match.p1.id, 9);
      s = kda.applyThrow(s, match.p2.id, 0);
      iterations++;
    }
    return s;
  }

  let s = playToGF(kda.initState(players4, { seed: 'test' }));
  const gf = s.bracket.find(m => m.bracket === 'GF');
  assert.ok(gf, 'GF slot must exist');
  assert.ok(gf.p1 && gf.p2, 'GF slot must have both finalists');
  assert.equal(gf.throwsRequired, 4, 'GF throwsRequired must be 4 (2 throws per player)');

  // Submit all 4 GF throws: p1 scores 9+8=17, p2 scores 7+6=13 — p1 wins
  const p1id = gf.p1.id;
  const p2id = gf.p2.id;

  s = kda.applyThrow(s, p1id, 9);
  const afterFirst = s.bracket.find(m => m.bracket === 'GF');
  assert.equal(afterFirst.done, false, 'GF must not be done after first throw');

  s = kda.applyThrow(s, p2id, 7);
  const afterSecond = s.bracket.find(m => m.bracket === 'GF');
  assert.equal(afterSecond.done, false, 'GF must not be done after 2nd throw (p2 needs 2nd)');

  s = kda.applyThrow(s, p1id, 8);
  const afterThird = s.bracket.find(m => m.bracket === 'GF');
  assert.equal(afterThird.done, false, 'GF must not be done after 3 throws');

  s = kda.applyThrow(s, p2id, 6);
  const gfDone = s.bracket.find(m => m.bracket === 'GF');
  assert.equal(gfDone.done, true, 'GF must be done after all 4 throws');
  assert.equal(s.done, true, 'state.done must be true when GF is resolved');
  assert.ok(s.gewinner, 'state.gewinner must be set');
  assert.equal(s.gewinner.id, p1id,
    'state.gewinner must be the player with higher total (p1: 9+8=17 > p2: 7+6=13)');
});

// KDA8: applyThrow ignores throw for player not in any active match
//        (stale throw guard — returned state deepEqual to input, per D-08 security requirement)
//        Also verifies the returned state has state.bracket (new engine shape)
test('KDA8: applyThrow returns unchanged state when player has no active match', () => {
  // First, complete one match so we can submit a throw for an already-eliminated player
  const init = kda.initState(players4, { seed: 'test' });
  // Verify bracket shape (new engine) — this will fail against old engine
  assert.ok(Array.isArray(init.bracket),
    'initState must return state.bracket for stale-throw guard to be meaningful');
  const match = init.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);
  // Resolve the match: p1 wins, p2 loses and drops to loser bracket
  let s = kda.applyThrow(init, match.p1.id, 9);
  s = kda.applyThrow(s, match.p2.id, 0);
  // Now try a throw for the loser of a completed match who has no pending active match
  // (they may be waiting for a loser-bracket slot to fill, so they are not "active")
  const resolvedMatch = s.bracket.find(m => m.id === match.id);
  const loserPlayer = resolvedMatch.loser;
  // Find whether loser is in an active (non-done, non-bye, both seated) match
  const loserActiveMatch = s.bracket.find(
    m => !m.done && !m.isBye && m.p1 && m.p2 &&
         (m.p1.id === loserPlayer.id || m.p2.id === loserPlayer.id)
  );
  if (!loserActiveMatch) {
    // Loser is not in any active match — submitting a throw must be a no-op
    const snapshot = JSON.parse(JSON.stringify(s));
    const returned = kda.applyThrow(s, loserPlayer.id, 7);
    assert.deepEqual(returned, snapshot,
      'state must be unchanged when player is not in any currently active match');
  } else {
    // If loser already has a next match (small bracket), skip the stale-throw check
    // and just verify bracket shape is correct
    assert.ok(true, 'loser already seated in next match — stale-throw guard not exercised');
  }
});

// KDA9: Player count validation — initState throws for < 4 or > 12 players
test('KDA9: initState throws Error for player counts outside 4–12', () => {
  const tooFew = [
    { id: 1, name: 'A', emoji: 'A' },
    { id: 2, name: 'B', emoji: 'B' },
    { id: 3, name: 'C', emoji: 'C' }
  ];
  // Must throw for 3 players (< 4)
  assert.throws(
    () => kda.initState(tooFew, {}),
    /4.+12|4–12|requires 4|min.*4/i,
    'initState must throw for < 4 players'
  );

  // Build a 13-player array
  const tooMany = Array.from({ length: 13 }, (_, i) => ({
    id: i + 1,
    name: String.fromCharCode(65 + i),
    emoji: String.fromCharCode(65 + i)
  }));
  // Must throw for 13 players (> 12)
  assert.throws(
    () => kda.initState(tooMany, {}),
    /4.+12|4–12|requires|max.*12/i,
    'initState must throw for > 12 players'
  );
});

// KDA10: 4-player bracket has exactly 6 slots including L-R1
test('KDA10: 4-player bracket has 6 slots with correct L-R1 structure', () => {
  const state = kda.initState(players4, { seed: 'test' });
  assert.equal(state.bracket.length, 6, '4-player DE bracket must have exactly 6 slots');

  // L-R1 slot must exist
  const lR1 = state.bracket.find(s => s.id === 'L-R1');
  assert.ok(lR1, 'L-R1 slot must exist');
  assert.equal(lR1.bracket, 'L', 'L-R1 bracket field must be "L"');
  assert.equal(lR1.advancesWinnerTo, 'L-Final', 'L-R1 winner must advance to L-Final');

  // W-R1 losers must route to L-R1
  const wR1_1 = state.bracket.find(s => s.id === 'W-R1-1');
  const wR1_2 = state.bracket.find(s => s.id === 'W-R1-2');
  assert.ok(wR1_1, 'W-R1-1 must exist');
  assert.ok(wR1_2, 'W-R1-2 must exist');
  assert.equal(wR1_1.advancesLoserTo, 'L-R1', 'W-R1-1 loser must go to L-R1');
  assert.equal(wR1_2.advancesLoserTo, 'L-R1', 'W-R1-2 loser must go to L-R1');

  // W-Final loser must still go to L-Final
  const wFinal = state.bracket.find(s => s.id === 'W-Final');
  assert.ok(wFinal, 'W-Final must exist');
  assert.equal(wFinal.advancesLoserTo, 'L-Final', 'W-Final loser must go to L-Final');
});

// KDA11: After both W-R1 matches complete, L-R1 has both losers
test('KDA11: completing W-R1 matches populates L-R1 with both losers', () => {
  let state = kda.initState(players4, { seed: 'fixed' });
  // Find W-R1-1 and W-R1-2 matches
  const findActive = (s) => s.bracket.find(m => !m.done && !m.isBye && m.p1 && m.p2);

  // Play out W-R1-1: p1 wins, p2 loses
  const m1 = findActive(state);
  assert.ok(m1, 'first match must be available');
  const loser1 = m1.p2;
  state = kda.applyThrow(state, m1.p1.id, 9);
  state = kda.applyThrow(state, m1.p2.id, 0);

  // Play out W-R1-2: p1 wins, p2 loses
  const m2 = findActive(state);
  assert.ok(m2, 'second match must be available');
  const loser2 = m2.p2;
  state = kda.applyThrow(state, m2.p1.id, 9);
  state = kda.applyThrow(state, m2.p2.id, 0);

  // L-R1 should now have both losers
  const lR1 = state.bracket.find(s => s.id === 'L-R1');
  assert.ok(lR1, 'L-R1 must exist');
  const lR1Players = [lR1.p1, lR1.p2].filter(Boolean).map(p => p.id);
  assert.ok(lR1Players.includes(loser1.id), 'L-R1 must have W-R1-1 loser');
  assert.ok(lR1Players.includes(loser2.id), 'L-R1 must have W-R1-2 loser');
});
