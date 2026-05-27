'use strict';

// Seeded LCG (linear congruential generator) shuffle
// Produces a deterministic Fisher-Yates shuffle from a string seed
function seededShuffle(arr, seed) {
  const a = arr.slice();
  // Convert seed string to a numeric seed
  let s = 0;
  for (let i = 0; i < String(seed).length; i++) {
    s = (s * 31 + String(seed).charCodeAt(i)) >>> 0;
  }
  if (s === 0) s = 1;

  // LCG parameters (same as Numerical Recipes)
  function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  }

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Random Fisher-Yates shuffle (used when no seed provided)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ---------------------------------------------------------------------------
// Private bracket helpers
// ---------------------------------------------------------------------------

// Find a slot by id in the bracket array
function findSlot(bracket, id) {
  return bracket.find(s => s.id === id) || null;
}

// Advance a player into a downstream slot (p1 first, then p2)
function advancePlayer(bracket, slotId, player) {
  if (!slotId) return;
  const slot = findSlot(bracket, slotId);
  if (!slot) return;
  if (slot.p1 === null || slot.p1 === undefined) {
    slot.p1 = player;
  } else {
    slot.p2 = player;
  }
}

// Create a slot template with all required fields
function makeSlot(id, bracket, round, opts) {
  return Object.assign({
    id,
    round,
    bracket,
    p1: null,
    p2: null,
    throws: [],
    winner: null,
    loser: null,
    done: false,
    isBye: false,
    tiebreak: false,
    advancesWinnerTo: null,
    advancesLoserTo: null,
    throwsRequired: 2
  }, opts);
}

// ---------------------------------------------------------------------------
// buildBracket: generate all match slots for a given player array
// Players are already seeded/shuffled; null entries = byes
// ---------------------------------------------------------------------------

function buildBracket(seededPlayers) {
  const n = seededPlayers.length; // must be power of 2 (4, 8, or 16)
  const bracket = [];

  if (n === 4) {
    // 4-player DE bracket:
    // W-R1: 2 matches  → winners to W-Final, losers to L-Final
    // W-Final: 1 match → winner to GF, loser to L-Final
    // L-Final: 1 match → winner to GF
    // GF: 1 match
    // Total: 5 slots

    bracket.push(makeSlot('W-R1-1', 'W', 1, {
      p1: seededPlayers[0],
      p2: seededPlayers[3],
      advancesWinnerTo: 'W-Final',
      advancesLoserTo: 'L-R1'
    }));
    bracket.push(makeSlot('W-R1-2', 'W', 1, {
      p1: seededPlayers[1],
      p2: seededPlayers[2],
      advancesWinnerTo: 'W-Final',
      advancesLoserTo: 'L-R1'
    }));
    bracket.push(makeSlot('W-Final', 'W', 2, {
      advancesWinnerTo: 'GF',
      advancesLoserTo: 'L-Final'
    }));
    bracket.push(makeSlot('L-R1', 'L', 1, {
      advancesWinnerTo: 'L-Final',
      advancesLoserTo: null
    }));
    bracket.push(makeSlot('L-Final', 'L', 2, {
      advancesWinnerTo: 'GF',
      advancesLoserTo: null
    }));
    bracket.push(makeSlot('GF', 'GF', 1, {
      advancesWinnerTo: null,
      advancesLoserTo: null,
      throwsRequired: 4
    }));

  } else if (n === 8) {
    // 8-player DE bracket:
    // W-R1: 4 matches  → winners to W-R2, losers to L-R1
    // W-R2: 2 matches  → winners to W-Semi, losers to L-R2
    // W-Semi: 1 match  → winner to W-Final, loser to L-R4
    // W-Final: 1 match → winner to GF, loser to L-R5
    // L-R1: 2 matches  → winners to L-R2 (feed-in round)
    // L-R2: 2 matches  → winners to L-R3
    // L-R3: 1 match    → winner to L-R4
    // L-R4: 1 match    → winner to L-R5
    // L-R5: 1 match    → winner to GF
    // GF: 1 match
    // Total: 17 slots

    // Standard seeding pairs: 1v8, 4v5, 2v7, 3v6
    bracket.push(makeSlot('W-R1-1', 'W', 1, {
      p1: seededPlayers[0], p2: seededPlayers[7],
      advancesWinnerTo: 'W-R2-1', advancesLoserTo: 'L-R1-2'
    }));
    bracket.push(makeSlot('W-R1-2', 'W', 1, {
      p1: seededPlayers[3], p2: seededPlayers[4],
      advancesWinnerTo: 'W-R2-1', advancesLoserTo: 'L-R1-1'
    }));
    bracket.push(makeSlot('W-R1-3', 'W', 1, {
      p1: seededPlayers[1], p2: seededPlayers[6],
      advancesWinnerTo: 'W-R2-2', advancesLoserTo: 'L-R1-2'
    }));
    bracket.push(makeSlot('W-R1-4', 'W', 1, {
      p1: seededPlayers[2], p2: seededPlayers[5],
      advancesWinnerTo: 'W-R2-2', advancesLoserTo: 'L-R1-1'
    }));

    bracket.push(makeSlot('W-R2-1', 'W', 2, {
      advancesWinnerTo: 'W-Semi', advancesLoserTo: 'L-R2-2'
    }));
    bracket.push(makeSlot('W-R2-2', 'W', 2, {
      advancesWinnerTo: 'W-Semi', advancesLoserTo: 'L-R2-1'
    }));

    bracket.push(makeSlot('W-Semi', 'W', 3, {
      advancesWinnerTo: 'W-Final', advancesLoserTo: 'L-R4'
    }));
    bracket.push(makeSlot('W-Final', 'W', 4, {
      advancesWinnerTo: 'GF', advancesLoserTo: 'L-R5'
    }));

    // L bracket (feed-in round — losers of W-R1 play each other)
    bracket.push(makeSlot('L-R1-1', 'L', 1, {
      advancesWinnerTo: 'L-R2-1', advancesLoserTo: null
    }));
    bracket.push(makeSlot('L-R1-2', 'L', 1, {
      advancesWinnerTo: 'L-R2-2', advancesLoserTo: null
    }));

    // L-R2: L-R1 winners vs losers of W-R2
    bracket.push(makeSlot('L-R2-1', 'L', 2, {
      advancesWinnerTo: 'L-R3', advancesLoserTo: null
    }));
    bracket.push(makeSlot('L-R2-2', 'L', 2, {
      advancesWinnerTo: 'L-R3', advancesLoserTo: null
    }));

    bracket.push(makeSlot('L-R3', 'L', 3, {
      advancesWinnerTo: 'L-R4', advancesLoserTo: null
    }));
    bracket.push(makeSlot('L-R4', 'L', 4, {
      advancesWinnerTo: 'L-R5', advancesLoserTo: null
    }));
    bracket.push(makeSlot('L-R5', 'L', 5, {
      advancesWinnerTo: 'GF', advancesLoserTo: null
    }));

    bracket.push(makeSlot('GF', 'GF', 1, {
      advancesWinnerTo: null, advancesLoserTo: null, throwsRequired: 4
    }));

  } else if (n === 16) {
    // 16-player DE bracket (used for 9–12 actual players, rest are byes):
    // W-R1: 8 matches  → winners to W-R2, losers to L-R1
    // W-R2: 4 matches  → winners to W-QF, losers to L-R2
    // W-QF: 2 matches  → winners to W-Semi, losers to L-R4
    // W-Semi: 1 match  → winner to W-Final, loser to L-R6
    // W-Final: 1 match → winner to GF, loser to L-R7
    // L-R1: 4 matches  (losers from W-R1 play each other)
    // L-R2: 4 matches  (L-R1 winners vs losers from W-R2)
    // L-R3: 2 matches  (L-R2 winners play each other)
    // L-R4: 2 matches  (L-R3 winners vs losers from W-QF)
    // L-R5: 1 match    (2 L-R4 winners)
    // L-R6: 1 match    (L-R5 winner vs loser of W-Semi)
    // L-R7: 1 match    (L-R6 winner vs loser of W-Final)
    // GF: 1 match
    // Total: 31 slots

    // Standard seeding pairs for 16: 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11
    const pairs = [
      [0, 15], [7, 8], [3, 12], [4, 11],
      [1, 14], [6, 9], [2, 13], [5, 10]
    ];

    const lR1WinnerTargets = ['L-R2-1', 'L-R2-2', 'L-R2-3', 'L-R2-4'];
    const lR1LoserTargets  = ['L-R1-2', 'L-R1-1', 'L-R1-4', 'L-R1-3'];
    const wR2LoserTargets  = ['L-R2-4', 'L-R2-3', 'L-R2-2', 'L-R2-1'];
    const wR2WinnerTargets = ['W-QF-1', 'W-QF-1', 'W-QF-2', 'W-QF-2'];

    for (let i = 0; i < 8; i++) {
      const [a, b] = pairs[i];
      // Group: slots 0-3 go to W-R2-1/2 (top half), slots 4-7 go to W-R2-3/4 (bottom half)
      const wR2Target = i < 2 ? 'W-R2-1' : (i < 4 ? 'W-R2-2' : (i < 6 ? 'W-R2-3' : 'W-R2-4'));
      const lR1Target = i < 2 ? 'L-R1-1' : (i < 4 ? 'L-R1-2' : (i < 6 ? 'L-R1-3' : 'L-R1-4'));
      bracket.push(makeSlot(`W-R1-${i + 1}`, 'W', 1, {
        p1: seededPlayers[a],
        p2: seededPlayers[b],
        advancesWinnerTo: wR2Target,
        advancesLoserTo: lR1Target
      }));
    }

    // W-R2: 4 matches
    bracket.push(makeSlot('W-R2-1', 'W', 2, { advancesWinnerTo: 'W-QF-1', advancesLoserTo: 'L-R2-4' }));
    bracket.push(makeSlot('W-R2-2', 'W', 2, { advancesWinnerTo: 'W-QF-1', advancesLoserTo: 'L-R2-3' }));
    bracket.push(makeSlot('W-R2-3', 'W', 2, { advancesWinnerTo: 'W-QF-2', advancesLoserTo: 'L-R2-2' }));
    bracket.push(makeSlot('W-R2-4', 'W', 2, { advancesWinnerTo: 'W-QF-2', advancesLoserTo: 'L-R2-1' }));

    // W-QF: 2 matches
    bracket.push(makeSlot('W-QF-1', 'W', 3, { advancesWinnerTo: 'W-Semi', advancesLoserTo: 'L-R4-2' }));
    bracket.push(makeSlot('W-QF-2', 'W', 3, { advancesWinnerTo: 'W-Semi', advancesLoserTo: 'L-R4-1' }));

    bracket.push(makeSlot('W-Semi', 'W', 4, { advancesWinnerTo: 'W-Final', advancesLoserTo: 'L-R6' }));
    bracket.push(makeSlot('W-Final', 'W', 5, { advancesWinnerTo: 'GF', advancesLoserTo: 'L-R7' }));

    // L-R1: 4 matches (losers from W-R1 play each other in pairs)
    bracket.push(makeSlot('L-R1-1', 'L', 1, { advancesWinnerTo: 'L-R2-1', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R1-2', 'L', 1, { advancesWinnerTo: 'L-R2-2', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R1-3', 'L', 1, { advancesWinnerTo: 'L-R2-3', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R1-4', 'L', 1, { advancesWinnerTo: 'L-R2-4', advancesLoserTo: null }));

    // L-R2: 4 matches (L-R1 winners vs W-R2 losers)
    bracket.push(makeSlot('L-R2-1', 'L', 2, { advancesWinnerTo: 'L-R3-1', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R2-2', 'L', 2, { advancesWinnerTo: 'L-R3-1', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R2-3', 'L', 2, { advancesWinnerTo: 'L-R3-2', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R2-4', 'L', 2, { advancesWinnerTo: 'L-R3-2', advancesLoserTo: null }));

    // L-R3: 2 matches
    bracket.push(makeSlot('L-R3-1', 'L', 3, { advancesWinnerTo: 'L-R4-1', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R3-2', 'L', 3, { advancesWinnerTo: 'L-R4-2', advancesLoserTo: null }));

    // L-R4: 2 matches (L-R3 winners vs W-QF losers)
    bracket.push(makeSlot('L-R4-1', 'L', 4, { advancesWinnerTo: 'L-R5', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R4-2', 'L', 4, { advancesWinnerTo: 'L-R5', advancesLoserTo: null }));

    bracket.push(makeSlot('L-R5', 'L', 5, { advancesWinnerTo: 'L-R6', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R6', 'L', 6, { advancesWinnerTo: 'L-R7', advancesLoserTo: null }));
    bracket.push(makeSlot('L-R7', 'L', 7, { advancesWinnerTo: 'GF', advancesLoserTo: null }));

    bracket.push(makeSlot('GF', 'GF', 1, {
      advancesWinnerTo: null, advancesLoserTo: null, throwsRequired: 4
    }));
  }

  return bracket;
}

// ---------------------------------------------------------------------------
// resolveByeSlots: auto-advance W-R1 slots where the padded player slot is
// null (i.e., only one player was assigned — no opponent).
// Only W-R1 slots can be byes (null padding only occurs there).
// ---------------------------------------------------------------------------

function resolveByeSlots(bracket) {
  for (const slot of bracket) {
    if (!slot.done && slot.round === 1 && slot.bracket === 'W') {
      if (slot.p1 && (slot.p2 === null || slot.p2 === undefined)) {
        slot.isBye = true;
        slot.done = true;
        slot.winner = slot.p1;
        advancePlayer(bracket, slot.advancesWinnerTo, slot.winner);
      } else if (slot.p2 && (slot.p1 === null || slot.p1 === undefined)) {
        slot.isBye = true;
        slot.done = true;
        slot.winner = slot.p2;
        advancePlayer(bracket, slot.advancesWinnerTo, slot.winner);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// autoResolveByes: after a match resolves, any downstream slot that has
// exactly one player and no remaining feeder slots can ever send a second
// player becomes a bye (e.g. L-R1-2 when the corresponding W-R1 was a bye).
// Runs iteratively until stable so cascading byes are handled correctly.
// ---------------------------------------------------------------------------

function autoResolveByes(bracket) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const slot of bracket) {
      if (slot.done || slot.isBye) continue;
      const hasP1 = slot.p1 != null;
      const hasP2 = slot.p2 != null;
      if (hasP1 && hasP2) continue; // 2 players — real match, skip
      // All slots that could still send a player into this slot
      const feeders = bracket.filter(s =>
        s.advancesWinnerTo === slot.id || s.advancesLoserTo === slot.id
      );
      if (!feeders.every(s => s.done)) continue;
      // All feeders are done — no more players will ever arrive
      if (!hasP1 && !hasP2) {
        // 0 players: mark done so downstream slots don't wait, but not isBye (no player involved)
        slot.done = true;
      } else {
        // 1 player: treat as bye, advance them
        const player = hasP1 ? slot.p1 : slot.p2;
        slot.isBye = true;
        slot.done = true;
        slot.winner = player;
        slot.p1 = player;
        slot.p2 = null;
        advancePlayer(bracket, slot.advancesWinnerTo, slot.winner);
      }
      changed = true;
    }
  }
}

// ---------------------------------------------------------------------------
// module.exports
// ---------------------------------------------------------------------------

module.exports = {
  id: 'kda',
  name: 'Kegler des Abends',

  initState(players, config = {}) {
    // D-12: validate player count
    if (players.length < 4 || players.length > 12) {
      throw new Error('KDA requires 4–12 players (per D-12)');
    }

    const seed = (config && config.seed != null) ? String(config.seed) : null;
    const pl = (seed !== null ? seededShuffle : shuffle)(
      players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji })),
      seed
    );

    // Determine bracket size (next power of 2 >= player count, minimum 4)
    let size = 4;
    while (size < pl.length) size *= 2;

    // Pad to bracket size with null (bye positions)
    const seededPlayers = pl.slice();
    while (seededPlayers.length < size) seededPlayers.push(null);

    const bracket = buildBracket(seededPlayers);

    resolveByeSlots(bracket);
    autoResolveByes(bracket);

    return {
      bracket,
      done: false,
      gewinner: null,
      pudelCounts: {},
      _seed: seed
    };
  },

  applyThrow(state, player_id, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    // Find active match for this player (not done, not bye, both players seated)
    const match = s.bracket.find(m =>
      !m.done && !m.isBye && m.p1 && m.p2 &&
      (m.p1.id === player_id || m.p2.id === player_id)
    );
    // Stray throw guard (D-08, security T-06-02-02, T-06-02-04)
    if (!match) return s;

    // Pin count validation (security T-06-02-01)
    if (typeof value !== 'number' || value < 0 || value > 9) return s;

    // Track Pudel
    if (value === 0 && !(meta && meta.keinPudel)) {
      s.pudelCounts[player_id] = (s.pudelCounts[player_id] || 0) + 1;
    }

    // Record throw
    const throwIndex = match.throws.length;
    match.throws.push({ playerId: player_id, throwIndex, value });

    // Determine required throw count
    const req = match.throwsRequired || (match.bracket === 'GF' ? 4 : 2);

    if (match.throws.length >= req) {
      // Sum pin counts per player
      const p1Total = match.throws
        .filter(t => t.playerId === match.p1.id)
        .reduce((sum, t) => sum + t.value, 0);
      const p2Total = match.throws
        .filter(t => t.playerId === match.p2.id)
        .reduce((sum, t) => sum + t.value, 0);

      if (p1Total === p2Total) {
        // Tie — extend by one more round of throws (2 more)
        match.tiebreak = true;
        match.throwsRequired = req + 2;
      } else {
        // Winner determined
        match.winner = p1Total > p2Total ? match.p1 : match.p2;
        match.loser  = p1Total > p2Total ? match.p2 : match.p1;
        match.done   = true;

        // Advance routing
        advancePlayer(s.bracket, match.advancesWinnerTo, match.winner);
        if (match.advancesLoserTo) {
          advancePlayer(s.bracket, match.advancesLoserTo, match.loser);
        }
        // Resolve any downstream slot that now has 1 player and no more feeders
        autoResolveByes(s.bracket);

        // Check tournament completion
        const gf = s.bracket.find(m => m.bracket === 'GF');
        if (gf && gf.done) {
          s.done = true;
          s.gewinner = gf.winner;
        }
      }
    }

    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    // Collect all unique players from bracket slots
    const seen = new Set();
    const allPlayers = [];
    for (const slot of state.bracket) {
      for (const p of [slot.p1, slot.p2]) {
        if (p && !seen.has(p.id)) {
          seen.add(p.id);
          allPlayers.push(p);
        }
      }
    }
    return allPlayers.map(p => ({
      playerId: p.id,
      score: state.gewinner && p.id === state.gewinner.id ? 0 : -1,
      winner: state.gewinner ? p.id === state.gewinner.id : false,
      pudel: state.pudelCounts ? (state.pudelCounts[p.id] || 0) : 0
    }));
  }
};
